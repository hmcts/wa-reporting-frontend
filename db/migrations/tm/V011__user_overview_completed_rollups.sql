CREATE TABLE IF NOT EXISTS analytics.snapshot_user_completed_daily_totals (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  tasks INTEGER NOT NULL,
  within_due INTEGER NOT NULL,
  beyond_due INTEGER NOT NULL,
  handling_time_sum NUMERIC NOT NULL,
  handling_time_count INTEGER NOT NULL,
  days_beyond_sum NUMERIC NOT NULL,
  days_beyond_count INTEGER NOT NULL
) PARTITION BY LIST (snapshot_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_snapshot_user_completed_daily_totals_snapshot_date
  ON ONLY analytics.snapshot_user_completed_daily_totals(snapshot_id, completed_date);

CREATE TABLE IF NOT EXISTS analytics.snapshot_user_completed_slicer_daily_facts (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  jurisdiction_label TEXT,
  role_category_label TEXT,
  region TEXT,
  location TEXT,
  task_name TEXT,
  work_type TEXT,
  completed_date DATE NOT NULL,
  tasks INTEGER NOT NULL,
  within_due INTEGER NOT NULL,
  beyond_due INTEGER NOT NULL,
  handling_time_sum NUMERIC NOT NULL,
  handling_time_count INTEGER NOT NULL,
  days_beyond_sum NUMERIC NOT NULL,
  days_beyond_count INTEGER NOT NULL
) PARTITION BY LIST (snapshot_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_snapshot_user_completed_slicer_daily_facts_snapshot_key
  ON ONLY analytics.snapshot_user_completed_slicer_daily_facts(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    completed_date
  );

CREATE INDEX IF NOT EXISTS ix_snapshot_user_completed_slicer_daily_facts_snapshot_date
  ON ONLY analytics.snapshot_user_completed_slicer_daily_facts(snapshot_id, completed_date);

CREATE INDEX IF NOT EXISTS ix_snapshot_user_completed_slicer_daily_facts_snapshot_slicers
  ON ONLY analytics.snapshot_user_completed_slicer_daily_facts(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX IF NOT EXISTS ix_snapshot_user_completed_slicer_daily_facts_snapshot_task_name
  ON ONLY analytics.snapshot_user_completed_slicer_daily_facts(snapshot_id, task_name);

CREATE OR REPLACE FUNCTION analytics.snapshot_partition_catalog(p_snapshot_id BIGINT)
RETURNS TABLE (
  parent_table REGCLASS,
  partition_name TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    format('analytics.%I', base_table_name)::REGCLASS AS parent_table,
    format('%s_p_%s', base_table_name, p_snapshot_id) AS partition_name
  FROM unnest(
    ARRAY[
      'snapshot_open_task_rows',
      'snapshot_completed_task_rows',
      'snapshot_user_completed_facts',
      'snapshot_user_completed_daily_totals',
      'snapshot_user_completed_slicer_daily_facts',
      'snapshot_completed_dashboard_facts',
      'snapshot_outstanding_due_status_daily_facts',
      'snapshot_outstanding_created_assignment_daily_facts',
      'snapshot_open_due_daily_facts',
      'snapshot_task_event_daily_facts',
      'snapshot_wait_time_by_assigned_date',
      'snapshot_overview_filter_facts',
      'snapshot_outstanding_filter_facts',
      'snapshot_completed_filter_facts',
      'snapshot_user_filter_facts'
    ]::TEXT[]
  ) WITH ORDINALITY AS base_tables(base_table_name, ord)
  ORDER BY ord;
$$;

CREATE OR REPLACE PROCEDURE analytics.populate_snapshot_user_completed_rollup_tables(
  p_snapshot_id BIGINT,
  p_user_completed_facts_table REGCLASS,
  p_user_completed_daily_totals_table REGCLASS,
  p_user_completed_slicer_daily_facts_table REGCLASS
)
LANGUAGE plpgsql
AS $procedure$
BEGIN
  EXECUTE format(
    $daily_totals$
    INSERT INTO %s (
      snapshot_id,
      completed_date,
      tasks,
      within_due,
      beyond_due,
      handling_time_sum,
      handling_time_count,
      days_beyond_sum,
      days_beyond_count
    )
    SELECT
      $1,
      completed_date,
      SUM(tasks)::int AS tasks,
      SUM(within_due)::int AS within_due,
      SUM(beyond_due)::int AS beyond_due,
      SUM(handling_time_sum)::numeric AS handling_time_sum,
      SUM(handling_time_count)::int AS handling_time_count,
      SUM(days_beyond_sum)::numeric AS days_beyond_sum,
      SUM(days_beyond_count)::int AS days_beyond_count
    FROM %s
    WHERE snapshot_id = $1
      AND completed_date IS NOT NULL
      AND (role_category_label IS NULL OR UPPER(role_category_label) <> 'JUDICIAL')
    GROUP BY completed_date
    $daily_totals$,
    p_user_completed_daily_totals_table,
    p_user_completed_facts_table
  )
  USING p_snapshot_id;

  EXECUTE format(
    $slicer_daily_facts$
    INSERT INTO %s (
      snapshot_id,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      completed_date,
      tasks,
      within_due,
      beyond_due,
      handling_time_sum,
      handling_time_count,
      days_beyond_sum,
      days_beyond_count
    )
    SELECT
      $1,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      completed_date,
      SUM(tasks)::int AS tasks,
      SUM(within_due)::int AS within_due,
      SUM(beyond_due)::int AS beyond_due,
      SUM(handling_time_sum)::numeric AS handling_time_sum,
      SUM(handling_time_count)::int AS handling_time_count,
      SUM(days_beyond_sum)::numeric AS days_beyond_sum,
      SUM(days_beyond_count)::int AS days_beyond_count
    FROM %s
    WHERE snapshot_id = $1
      AND completed_date IS NOT NULL
      AND (role_category_label IS NULL OR UPPER(role_category_label) <> 'JUDICIAL')
    GROUP BY
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      completed_date
    $slicer_daily_facts$,
    p_user_completed_slicer_daily_facts_table,
    p_user_completed_facts_table
  )
  USING p_snapshot_id;
END;
$procedure$;

CREATE OR REPLACE PROCEDURE analytics.create_snapshot_user_completed_rollup_indexes(
  p_snapshot_id BIGINT,
  p_user_completed_daily_totals_partition_name TEXT,
  p_user_completed_slicer_daily_facts_partition_name TEXT
)
LANGUAGE plpgsql
AS $procedure$
BEGIN
  EXECUTE format(
    'CREATE UNIQUE INDEX %I ON analytics.%I(completed_date)',
    format('ux_sucdt_p_%s_key', p_snapshot_id),
    p_user_completed_daily_totals_partition_name
  );

  EXECUTE format(
    'CREATE UNIQUE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type, completed_date)',
    format('ux_sucsdf_p_%s_key', p_snapshot_id),
    p_user_completed_slicer_daily_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(completed_date)',
    format('ix_sucsdf_p_%s_completed_date', p_snapshot_id),
    p_user_completed_slicer_daily_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    format('ix_sucsdf_p_%s_slicers', p_snapshot_id),
    p_user_completed_slicer_daily_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(task_name)',
    format('ix_sucsdf_p_%s_task_name', p_snapshot_id),
    p_user_completed_slicer_daily_facts_partition_name
  );
END;
$procedure$;

CREATE OR REPLACE PROCEDURE analytics.run_snapshot_refresh_batch()
LANGUAGE plpgsql
AS $procedure$
DECLARE
  v_snapshot_id BIGINT;
  v_lock_key BIGINT := hashtext('analytics_run_snapshot_refresh_batch_lock');
  v_batch_failed BOOLEAN := FALSE;
  v_batch_error_message TEXT;
  v_open_rows_partition_name TEXT;
  v_completed_rows_partition_name TEXT;
  v_user_completed_facts_partition_name TEXT;
  v_user_completed_daily_totals_partition_name TEXT;
  v_user_completed_slicer_daily_facts_partition_name TEXT;
  v_completed_dashboard_facts_partition_name TEXT;
  v_outstanding_due_status_partition_name TEXT;
  v_outstanding_created_assignment_partition_name TEXT;
  v_open_due_daily_partition_name TEXT;
  v_task_event_daily_partition_name TEXT;
  v_wait_time_partition_name TEXT;
  v_overview_filter_partition_name TEXT;
  v_outstanding_filter_partition_name TEXT;
  v_completed_filter_partition_name TEXT;
  v_user_filter_partition_name TEXT;
  v_partition RECORD;
  v_prev_work_mem TEXT;
  v_prev_hash_mem_multiplier TEXT;
  v_prev_enable_sort TEXT;
BEGIN
  IF NOT pg_try_advisory_lock(v_lock_key) THEN
    RAISE NOTICE 'Analytics snapshot batch already running; skipping trigger.';
    RETURN;
  END IF;

  BEGIN
    v_snapshot_id := nextval('analytics.snapshot_id_seq');

    INSERT INTO analytics.snapshot_batches (
      snapshot_id,
      status
    )
    VALUES (
      v_snapshot_id,
      'running'
    );

    UPDATE analytics.snapshot_state
    SET in_progress_snapshot_id = v_snapshot_id
    WHERE singleton_id = TRUE;
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(v_lock_key);
      RAISE;
  END;

  COMMIT;

  BEGIN
    -- Keep refresh staging and index builds in memory where possible.
    PERFORM set_config('work_mem', '256MB', TRUE);
    PERFORM set_config('maintenance_work_mem', '1GB', TRUE);

    CALL analytics.create_snapshot_refresh_temp_tables();

    v_open_rows_partition_name := format('snapshot_open_task_rows_p_%s', v_snapshot_id);
    v_completed_rows_partition_name := format('snapshot_completed_task_rows_p_%s', v_snapshot_id);
    v_user_completed_facts_partition_name := format('snapshot_user_completed_facts_p_%s', v_snapshot_id);
    v_user_completed_daily_totals_partition_name := format(
      'snapshot_user_completed_daily_totals_p_%s',
      v_snapshot_id
    );
    v_user_completed_slicer_daily_facts_partition_name := format(
      'snapshot_user_completed_slicer_daily_facts_p_%s',
      v_snapshot_id
    );
    v_completed_dashboard_facts_partition_name := format('snapshot_completed_dashboard_facts_p_%s', v_snapshot_id);
    v_outstanding_due_status_partition_name := format('snapshot_outstanding_due_status_daily_facts_p_%s', v_snapshot_id);
    v_outstanding_created_assignment_partition_name := format(
      'snapshot_outstanding_created_assignment_daily_facts_p_%s',
      v_snapshot_id
    );
    v_open_due_daily_partition_name := format('snapshot_open_due_daily_facts_p_%s', v_snapshot_id);
    v_task_event_daily_partition_name := format('snapshot_task_event_daily_facts_p_%s', v_snapshot_id);
    v_wait_time_partition_name := format('snapshot_wait_time_by_assigned_date_p_%s', v_snapshot_id);
    v_overview_filter_partition_name := format('snapshot_overview_filter_facts_p_%s', v_snapshot_id);
    v_outstanding_filter_partition_name := format('snapshot_outstanding_filter_facts_p_%s', v_snapshot_id);
    v_completed_filter_partition_name := format('snapshot_completed_filter_facts_p_%s', v_snapshot_id);
    v_user_filter_partition_name := format('snapshot_user_filter_facts_p_%s', v_snapshot_id);

    CALL analytics.create_snapshot_detached_partitions(v_snapshot_id);

    CALL analytics.populate_snapshot_detached_tables(
      v_snapshot_id,
      format('analytics.%I', v_open_rows_partition_name)::REGCLASS,
      format('analytics.%I', v_completed_rows_partition_name)::REGCLASS,
      format('analytics.%I', v_user_completed_facts_partition_name)::REGCLASS,
      format('analytics.%I', v_completed_dashboard_facts_partition_name)::REGCLASS,
      format('analytics.%I', v_outstanding_due_status_partition_name)::REGCLASS,
      format('analytics.%I', v_outstanding_created_assignment_partition_name)::REGCLASS,
      format('analytics.%I', v_open_due_daily_partition_name)::REGCLASS,
      format('analytics.%I', v_task_event_daily_partition_name)::REGCLASS,
      format('analytics.%I', v_wait_time_partition_name)::REGCLASS
    );

    CALL analytics.populate_snapshot_user_completed_rollup_tables(
      v_snapshot_id,
      format('analytics.%I', v_user_completed_facts_partition_name)::REGCLASS,
      format('analytics.%I', v_user_completed_daily_totals_partition_name)::REGCLASS,
      format('analytics.%I', v_user_completed_slicer_daily_facts_partition_name)::REGCLASS
    );

    CALL analytics.create_snapshot_core_indexes(
      v_snapshot_id,
      v_open_rows_partition_name,
      v_completed_rows_partition_name,
      v_user_completed_facts_partition_name,
      v_completed_dashboard_facts_partition_name,
      v_outstanding_due_status_partition_name,
      v_outstanding_created_assignment_partition_name,
      v_open_due_daily_partition_name,
      v_task_event_daily_partition_name,
      v_wait_time_partition_name
    );

    CALL analytics.create_snapshot_user_completed_rollup_indexes(
      v_snapshot_id,
      v_user_completed_daily_totals_partition_name,
      v_user_completed_slicer_daily_facts_partition_name
    );

    -- Bias facet aggregation toward in-memory hash aggregate.
    SELECT
      current_setting('work_mem'),
      current_setting('hash_mem_multiplier'),
      current_setting('enable_sort')
    INTO
      v_prev_work_mem,
      v_prev_hash_mem_multiplier,
      v_prev_enable_sort;

    PERFORM set_config('work_mem', '1GB', TRUE);
    PERFORM set_config('hash_mem_multiplier', '4', TRUE);
    PERFORM set_config('enable_sort', 'off', TRUE);

    CALL analytics.refresh_snapshot_filter_facts_from_tables(
      v_snapshot_id,
      format('analytics.%I', v_open_due_daily_partition_name)::REGCLASS,
      format('analytics.%I', v_task_event_daily_partition_name)::REGCLASS,
      format('analytics.%I', v_open_rows_partition_name)::REGCLASS,
      format('analytics.%I', v_completed_rows_partition_name)::REGCLASS,
      format('analytics.%I', v_overview_filter_partition_name)::REGCLASS,
      format('analytics.%I', v_outstanding_filter_partition_name)::REGCLASS,
      format('analytics.%I', v_completed_filter_partition_name)::REGCLASS,
      format('analytics.%I', v_user_filter_partition_name)::REGCLASS
    );

    -- Restore baseline refresh-session settings for index creation and cleanup.
    PERFORM set_config('enable_sort', v_prev_enable_sort, TRUE);
    PERFORM set_config('work_mem', v_prev_work_mem, TRUE);
    PERFORM set_config('hash_mem_multiplier', v_prev_hash_mem_multiplier, TRUE);

    CALL analytics.create_snapshot_filter_indexes(
      v_snapshot_id,
      v_overview_filter_partition_name,
      v_outstanding_filter_partition_name,
      v_completed_filter_partition_name,
      v_user_filter_partition_name
    );

    FOR v_partition IN
      SELECT *
      FROM analytics.snapshot_partition_catalog(v_snapshot_id)
    LOOP
      EXECUTE format('ANALYZE analytics.%I', v_partition.partition_name);
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      v_batch_failed := TRUE;
      v_batch_error_message := SQLERRM;
  END;

  IF v_batch_failed THEN
    UPDATE analytics.snapshot_batches
    SET status = 'failed', completed_at = clock_timestamp(), error_message = v_batch_error_message
    WHERE snapshot_id = v_snapshot_id;

    UPDATE analytics.snapshot_state
    SET in_progress_snapshot_id = NULL
    WHERE singleton_id = TRUE AND in_progress_snapshot_id = v_snapshot_id;

    COMMIT;
    PERFORM pg_advisory_unlock(v_lock_key);
    RAISE EXCEPTION 'Analytics snapshot batch % failed: %', v_snapshot_id, v_batch_error_message;
  END IF;

  COMMIT;

  v_batch_failed := FALSE;
  v_batch_error_message := NULL;

  BEGIN
    FOR v_partition IN
      SELECT *
      FROM analytics.snapshot_partition_catalog(v_snapshot_id)
    LOOP
      EXECUTE format(
        'ALTER TABLE %s ATTACH PARTITION analytics.%I FOR VALUES IN (%s)',
        v_partition.parent_table,
        v_partition.partition_name,
        v_snapshot_id
      );
    END LOOP;

    UPDATE analytics.snapshot_batches
    SET status = 'succeeded', completed_at = clock_timestamp(), error_message = NULL
    WHERE snapshot_id = v_snapshot_id;

    UPDATE analytics.snapshot_state
    SET published_snapshot_id = v_snapshot_id,
        published_at = clock_timestamp(),
        in_progress_snapshot_id = NULL
    WHERE singleton_id = TRUE;
  EXCEPTION
    WHEN OTHERS THEN
      v_batch_failed := TRUE;
      v_batch_error_message := SQLERRM;
  END;

  IF v_batch_failed THEN
    FOR v_partition IN
      SELECT *
      FROM analytics.snapshot_partition_catalog(v_snapshot_id)
    LOOP
      BEGIN
        EXECUTE format('DROP TABLE IF EXISTS analytics.%I', v_partition.partition_name);
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Failed to drop detached snapshot table % after failed publish of %: %',
            v_partition.partition_name,
            v_snapshot_id,
            SQLERRM;
      END;
    END LOOP;

    UPDATE analytics.snapshot_batches
    SET status = 'failed', completed_at = clock_timestamp(), error_message = v_batch_error_message
    WHERE snapshot_id = v_snapshot_id;

    UPDATE analytics.snapshot_state
    SET in_progress_snapshot_id = NULL
    WHERE singleton_id = TRUE AND in_progress_snapshot_id = v_snapshot_id;

    COMMIT;
    PERFORM pg_advisory_unlock(v_lock_key);
    RAISE EXCEPTION 'Analytics snapshot batch % failed during publish: %', v_snapshot_id, v_batch_error_message;
  END IF;

  COMMIT;

  CALL analytics.cleanup_snapshot_retention();

  PERFORM pg_advisory_unlock(v_lock_key);
END;
$procedure$;

DO $$
DECLARE
  v_snapshot RECORD;
  v_source_partition_name TEXT;
  v_daily_partition_name TEXT;
  v_slicer_partition_name TEXT;
  v_source_partition REGCLASS;
  v_daily_partition REGCLASS;
  v_slicer_partition REGCLASS;
BEGIN
  FOR v_snapshot IN
    SELECT snapshot_id
    FROM analytics.snapshot_batches
    WHERE status = 'succeeded'
    ORDER BY snapshot_id
  LOOP
    v_source_partition_name := format('snapshot_user_completed_facts_p_%s', v_snapshot.snapshot_id);
    v_daily_partition_name := format('snapshot_user_completed_daily_totals_p_%s', v_snapshot.snapshot_id);
    v_slicer_partition_name := format('snapshot_user_completed_slicer_daily_facts_p_%s', v_snapshot.snapshot_id);
    v_source_partition := to_regclass(format('analytics.%I', v_source_partition_name));

    IF v_source_partition IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS analytics.%I (LIKE analytics.snapshot_user_completed_daily_totals INCLUDING DEFAULTS INCLUDING CONSTRAINTS)',
      v_daily_partition_name
    );
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = format('ck_%s_snapshot_id', v_daily_partition_name)
    ) THEN
      EXECUTE format(
        'ALTER TABLE analytics.%I ADD CONSTRAINT %I CHECK (snapshot_id = %s)',
        v_daily_partition_name,
        format('ck_%s_snapshot_id', v_daily_partition_name),
        v_snapshot.snapshot_id
      );
    END IF;

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS analytics.%I (LIKE analytics.snapshot_user_completed_slicer_daily_facts INCLUDING DEFAULTS INCLUDING CONSTRAINTS)',
      v_slicer_partition_name
    );
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = format('ck_%s_snapshot_id', v_slicer_partition_name)
    ) THEN
      EXECUTE format(
        'ALTER TABLE analytics.%I ADD CONSTRAINT %I CHECK (snapshot_id = %s)',
        v_slicer_partition_name,
        format('ck_%s_snapshot_id', v_slicer_partition_name),
        v_snapshot.snapshot_id
      );
    END IF;

    v_daily_partition := format('analytics.%I', v_daily_partition_name)::REGCLASS;
    v_slicer_partition := format('analytics.%I', v_slicer_partition_name)::REGCLASS;

    IF NOT EXISTS (SELECT 1 FROM analytics.snapshot_user_completed_daily_totals WHERE snapshot_id = v_snapshot.snapshot_id) THEN
      CALL analytics.populate_snapshot_user_completed_rollup_tables(
        v_snapshot.snapshot_id,
        v_source_partition,
        v_daily_partition,
        v_slicer_partition
      );
    END IF;

    CALL analytics.create_snapshot_user_completed_rollup_indexes(
      v_snapshot.snapshot_id,
      v_daily_partition_name,
      v_slicer_partition_name
    );

    EXECUTE format('ANALYZE analytics.%I', v_daily_partition_name);
    EXECUTE format('ANALYZE analytics.%I', v_slicer_partition_name);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_inherits
      WHERE inhparent = 'analytics.snapshot_user_completed_daily_totals'::REGCLASS
        AND inhrelid = v_daily_partition
    ) THEN
      EXECUTE format(
        'ALTER TABLE analytics.snapshot_user_completed_daily_totals ATTACH PARTITION analytics.%I FOR VALUES IN (%s)',
        v_daily_partition_name,
        v_snapshot.snapshot_id
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_inherits
      WHERE inhparent = 'analytics.snapshot_user_completed_slicer_daily_facts'::REGCLASS
        AND inhrelid = v_slicer_partition
    ) THEN
      EXECUTE format(
        'ALTER TABLE analytics.snapshot_user_completed_slicer_daily_facts ATTACH PARTITION analytics.%I FOR VALUES IN (%s)',
        v_slicer_partition_name,
        v_snapshot.snapshot_id
      );
    END IF;
  END LOOP;
END;
$$;
