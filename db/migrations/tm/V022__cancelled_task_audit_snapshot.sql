SET LOCAL lock_timeout = '20min';

SELECT pg_advisory_xact_lock(hashtext('analytics_run_snapshot_refresh_batch_lock'));

CREATE TABLE analytics.snapshot_cancelled_task_rows (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  case_id TEXT,
  task_name TEXT,
  jurisdiction_label TEXT,
  role_category_label TEXT,
  region TEXT,
  location_id TEXT,
  location TEXT,
  work_type TEXT,
  last_updated_date DATE,
  termination_process_label TEXT,
  outcome TEXT,
  assignee TEXT,
  number_of_reassignments INTEGER NOT NULL DEFAULT 0
) PARTITION BY LIST (snapshot_id);


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
      'snapshot_cancelled_task_rows',
      'snapshot_user_completed_facts',
      'snapshot_user_completed_daily_totals',
      'snapshot_user_completed_slicer_daily_facts',
      'snapshot_completed_dashboard_facts',
      'snapshot_completed_daily_metrics_facts',
      'snapshot_completed_region_location_facts',
      'snapshot_outstanding_due_status_daily_facts',
      'snapshot_outstanding_created_assignment_daily_facts',
      'snapshot_open_due_daily_facts',
      'snapshot_task_event_daily_facts',
      'snapshot_task_event_service_daily_facts',
      'snapshot_wait_time_by_assigned_date',
      'snapshot_overview_filter_facts',
      'snapshot_outstanding_filter_facts',
      'snapshot_completed_filter_facts',
      'snapshot_user_filter_facts'
    ]::TEXT[]
  ) WITH ORDINALITY AS base_tables(base_table_name, ord)
  ORDER BY ord;
$$;


CREATE OR REPLACE PROCEDURE analytics.populate_snapshot_cancelled_task_rows(
  p_snapshot_id BIGINT,
  p_cancelled_rows_table REGCLASS
)
LANGUAGE plpgsql
AS $procedure$
BEGIN
  EXECUTE format(
    $cancelled_rows_insert$
    INSERT INTO %s (
      snapshot_id,
      task_id,
      case_id,
      task_name,
      jurisdiction_label,
      role_category_label,
      region,
      location_id,
      location,
      work_type,
      last_updated_date,
      termination_process_label,
      outcome,
      assignee,
      number_of_reassignments
    )
    SELECT
      $1,
      task_id,
      case_id,
      task_name,
      jurisdiction_label,
      role_category_label,
      region,
      location_id,
      location,
      work_type,
      last_updated_date,
      termination_process_label,
      outcome_lower,
      assignee,
      number_of_reassignments
    FROM tmp_snapshot_source
    WHERE outcome_lower = 'cancelled'
    $cancelled_rows_insert$,
    p_cancelled_rows_table
  )
  USING p_snapshot_id;
END;
$procedure$;

CREATE OR REPLACE PROCEDURE analytics.create_snapshot_cancelled_task_rows_indexes(
  p_snapshot_id BIGINT,
  p_cancelled_rows_partition_name TEXT
)
LANGUAGE plpgsql
AS $procedure$
BEGIN
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    format('ix_scatr_p_%s_slicers', p_snapshot_id),
    p_cancelled_rows_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(case_id, last_updated_date DESC)',
    format('ix_scatr_p_%s_case_id_updated', p_snapshot_id),
    p_cancelled_rows_partition_name
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
  v_cancelled_rows_partition_name TEXT;
  v_user_completed_facts_partition_name TEXT;
  v_user_completed_daily_totals_partition_name TEXT;
  v_user_completed_slicer_daily_facts_partition_name TEXT;
  v_completed_dashboard_facts_partition_name TEXT;
  v_completed_daily_metrics_facts_partition_name TEXT;
  v_completed_region_location_facts_partition_name TEXT;
  v_outstanding_due_status_partition_name TEXT;
  v_outstanding_created_assignment_partition_name TEXT;
  v_open_due_daily_partition_name TEXT;
  v_task_event_daily_partition_name TEXT;
  v_task_event_service_daily_partition_name TEXT;
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
    v_cancelled_rows_partition_name := format('snapshot_cancelled_task_rows_p_%s', v_snapshot_id);
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
    v_completed_daily_metrics_facts_partition_name := format(
      'snapshot_completed_daily_metrics_facts_p_%s',
      v_snapshot_id
    );
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
    v_task_event_service_daily_partition_name := format(
      'snapshot_task_event_service_daily_facts_p_%s',
      v_snapshot_id
    );
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

    CALL analytics.populate_snapshot_cancelled_task_rows(
      v_snapshot_id,
      format('analytics.%I', v_cancelled_rows_partition_name)::REGCLASS
    );

    CALL analytics.populate_snapshot_user_completed_rollup_tables(
      v_snapshot_id,
      format('analytics.%I', v_user_completed_facts_partition_name)::REGCLASS,
      format('analytics.%I', v_user_completed_daily_totals_partition_name)::REGCLASS,
      format('analytics.%I', v_user_completed_slicer_daily_facts_partition_name)::REGCLASS
    );

    CALL analytics.populate_snapshot_completed_daily_metrics_rollup_table(
      v_snapshot_id,
      format('analytics.%I', v_completed_dashboard_facts_partition_name)::REGCLASS,
      format('analytics.%I', v_completed_daily_metrics_facts_partition_name)::REGCLASS
    );

    CALL analytics.populate_snapshot_completed_region_location_rollup_table(
      v_snapshot_id,
      format('analytics.%I', v_completed_dashboard_facts_partition_name)::REGCLASS,
      format('analytics.%I', v_completed_region_location_facts_partition_name)::REGCLASS
    );

    CALL analytics.populate_snapshot_task_event_service_daily_rollup_table(
      v_snapshot_id,
      format('analytics.%I', v_task_event_daily_partition_name)::REGCLASS,
      format('analytics.%I', v_task_event_service_daily_partition_name)::REGCLASS
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

    CALL analytics.create_snapshot_cancelled_task_rows_indexes(
      v_snapshot_id,
      v_cancelled_rows_partition_name
    );

    CALL analytics.create_snapshot_user_completed_rollup_indexes(
      v_snapshot_id,
      v_user_completed_daily_totals_partition_name,
      v_user_completed_slicer_daily_facts_partition_name
    );

    CALL analytics.create_snapshot_completed_daily_metrics_indexes(
      v_snapshot_id,
      v_completed_daily_metrics_facts_partition_name
    );

    CALL analytics.create_snapshot_completed_region_location_indexes(
      v_snapshot_id,
      v_completed_region_location_facts_partition_name
    );

    CALL analytics.create_snapshot_task_event_service_daily_indexes(
      v_snapshot_id,
      v_task_event_service_daily_partition_name
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
