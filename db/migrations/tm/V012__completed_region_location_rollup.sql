CREATE TABLE IF NOT EXISTS analytics.snapshot_completed_region_location_facts (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  reference_date DATE NOT NULL,
  region TEXT,
  location TEXT,
  total_task_count BIGINT NOT NULL,
  within_task_count BIGINT NOT NULL,
  handling_time_days_sum NUMERIC NOT NULL,
  handling_time_days_count BIGINT NOT NULL,
  processing_time_days_sum NUMERIC NOT NULL,
  processing_time_days_count BIGINT NOT NULL
) PARTITION BY LIST (snapshot_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_snapshot_completed_region_location_facts_key
  ON ONLY analytics.snapshot_completed_region_location_facts(snapshot_id, reference_date, region, location);

CREATE INDEX IF NOT EXISTS ix_snapshot_completed_region_location_facts_date
  ON ONLY analytics.snapshot_completed_region_location_facts(snapshot_id, reference_date);

CREATE INDEX IF NOT EXISTS ix_snapshot_completed_region_location_facts_region_loc
  ON ONLY analytics.snapshot_completed_region_location_facts(snapshot_id, region, location);

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
      'snapshot_completed_region_location_facts',
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

CREATE OR REPLACE PROCEDURE analytics.populate_snapshot_completed_region_location_rollup_table(
  p_snapshot_id BIGINT,
  p_completed_dashboard_facts_table REGCLASS,
  p_completed_region_location_facts_table REGCLASS
)
LANGUAGE plpgsql
AS $procedure$
BEGIN
  EXECUTE format(
    $region_location$
    INSERT INTO %s (
      snapshot_id,
      reference_date,
      region,
      location,
      total_task_count,
      within_task_count,
      handling_time_days_sum,
      handling_time_days_count,
      processing_time_days_sum,
      processing_time_days_count
    )
    SELECT
      $1,
      reference_date,
      region,
      location,
      SUM(total_task_count)::bigint AS total_task_count,
      SUM(within_task_count)::bigint AS within_task_count,
      SUM(handling_time_days_sum)::numeric AS handling_time_days_sum,
      SUM(handling_time_days_count)::bigint AS handling_time_days_count,
      SUM(processing_time_days_sum)::numeric AS processing_time_days_sum,
      SUM(processing_time_days_count)::bigint AS processing_time_days_count
    FROM %s
    WHERE snapshot_id = $1
    GROUP BY
      reference_date,
      region,
      location
    $region_location$,
    p_completed_region_location_facts_table,
    p_completed_dashboard_facts_table
  )
  USING p_snapshot_id;
END;
$procedure$;

CREATE OR REPLACE PROCEDURE analytics.create_snapshot_completed_region_location_indexes(
  p_snapshot_id BIGINT,
  p_completed_region_location_facts_partition_name TEXT
)
LANGUAGE plpgsql
AS $procedure$
BEGIN
  EXECUTE format(
    'CREATE UNIQUE INDEX IF NOT EXISTS %I ON analytics.%I(reference_date, region, location)',
    format('ux_scrlf_p_%s_key', p_snapshot_id),
    p_completed_region_location_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON analytics.%I(reference_date)',
    format('ix_scrlf_p_%s_ref_date', p_snapshot_id),
    p_completed_region_location_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON analytics.%I(region, location)',
    format('ix_scrlf_p_%s_region_loc', p_snapshot_id),
    p_completed_region_location_facts_partition_name
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
  v_completed_region_location_facts_partition_name TEXT;
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
    v_completed_region_location_facts_partition_name := format(
      'snapshot_completed_region_location_facts_p_%s',
      v_snapshot_id
    );
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

    CALL analytics.populate_snapshot_completed_region_location_rollup_table(
      v_snapshot_id,
      format('analytics.%I', v_completed_dashboard_facts_partition_name)::REGCLASS,
      format('analytics.%I', v_completed_region_location_facts_partition_name)::REGCLASS
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

    CALL analytics.create_snapshot_completed_region_location_indexes(
      v_snapshot_id,
      v_completed_region_location_facts_partition_name
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
  v_rollup_partition_name TEXT;
  v_source_partition REGCLASS;
  v_rollup_partition REGCLASS;
  v_has_rollup_rows BOOLEAN;
BEGIN
  FOR v_snapshot IN
    SELECT snapshot_id
    FROM analytics.snapshot_batches
    WHERE status = 'succeeded'
    ORDER BY snapshot_id
  LOOP
    v_source_partition_name := format('snapshot_completed_dashboard_facts_p_%s', v_snapshot.snapshot_id);
    v_rollup_partition_name := format('snapshot_completed_region_location_facts_p_%s', v_snapshot.snapshot_id);
    v_source_partition := to_regclass(format('analytics.%I', v_source_partition_name));

    IF v_source_partition IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS analytics.%I (LIKE analytics.snapshot_completed_region_location_facts INCLUDING DEFAULTS INCLUDING CONSTRAINTS)',
      v_rollup_partition_name
    );
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = format('ck_%s_snapshot_id', v_rollup_partition_name)
    ) THEN
      EXECUTE format(
        'ALTER TABLE analytics.%I ADD CONSTRAINT %I CHECK (snapshot_id = %s)',
        v_rollup_partition_name,
        format('ck_%s_snapshot_id', v_rollup_partition_name),
        v_snapshot.snapshot_id
      );
    END IF;

    v_rollup_partition := format('analytics.%I', v_rollup_partition_name)::REGCLASS;

    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM analytics.%I WHERE snapshot_id = $1)',
      v_rollup_partition_name
    )
    INTO v_has_rollup_rows
    USING v_snapshot.snapshot_id;

    IF NOT v_has_rollup_rows THEN
      CALL analytics.populate_snapshot_completed_region_location_rollup_table(
        v_snapshot.snapshot_id,
        v_source_partition,
        v_rollup_partition
      );
    END IF;

    CALL analytics.create_snapshot_completed_region_location_indexes(
      v_snapshot.snapshot_id,
      v_rollup_partition_name
    );

    EXECUTE format('ANALYZE analytics.%I', v_rollup_partition_name);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_inherits
      WHERE inhparent = 'analytics.snapshot_completed_region_location_facts'::REGCLASS
        AND inhrelid = v_rollup_partition
    ) THEN
      EXECUTE format(
        'ALTER TABLE analytics.snapshot_completed_region_location_facts ATTACH PARTITION analytics.%I FOR VALUES IN (%s)',
        v_rollup_partition_name,
        v_snapshot.snapshot_id
      );
    END IF;
  END LOOP;
END;
$$;
