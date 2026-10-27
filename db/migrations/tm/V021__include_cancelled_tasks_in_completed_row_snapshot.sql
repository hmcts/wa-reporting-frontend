SET LOCAL lock_timeout = '20min';

SELECT pg_advisory_xact_lock(hashtext('analytics_run_snapshot_refresh_batch_lock'));

ALTER TABLE analytics.snapshot_completed_task_rows
  ADD COLUMN event_date DATE;

UPDATE analytics.snapshot_completed_task_rows
SET event_date = completed_date;

ALTER PROCEDURE analytics.create_snapshot_filter_indexes(BIGINT, TEXT, TEXT, TEXT, TEXT)
  RENAME TO create_snapshot_filter_indexes_only;

CREATE OR REPLACE PROCEDURE analytics.populate_snapshot_cancelled_task_rows(p_snapshot_id BIGINT)
LANGUAGE plpgsql
AS $procedure$
DECLARE
  v_completed_rows_table REGCLASS;
  v_completed_rows_partition_name TEXT;
BEGIN
  v_completed_rows_partition_name := format('snapshot_completed_task_rows_p_%s', p_snapshot_id);
  v_completed_rows_table := format('analytics.%I', v_completed_rows_partition_name)::REGCLASS;

  EXECUTE format(
    'UPDATE %s SET event_date = completed_date WHERE snapshot_id = $1',
    v_completed_rows_table
  )
  USING p_snapshot_id;

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
      created_date,
      first_assigned_date,
      due_date,
      completed_date,
      event_date,
      handling_time_days,
      is_within_sla,
      termination_process_label,
      outcome,
      major_priority,
      assignee,
      number_of_reassignments,
      within_due_sort_value
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
      created_date,
      first_assigned_date,
      due_date,
      completed_date,
      last_updated_date::date,
      handling_time_days,
      is_within_sla,
      termination_process_label,
      outcome_lower,
      major_priority,
      assignee,
      number_of_reassignments,
      within_due_sort_value
    FROM tmp_snapshot_source
    WHERE outcome_lower = 'cancelled'
    $cancelled_rows_insert$,
    v_completed_rows_table
  )
  USING p_snapshot_id;

  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(case_id, event_date DESC)',
    format('ix_sctr_p_%s_case_event_date', p_snapshot_id),
    v_completed_rows_partition_name
  );
END;
$procedure$;

CREATE OR REPLACE PROCEDURE analytics.create_snapshot_filter_indexes(
  p_snapshot_id BIGINT,
  p_overview_filter_partition_name TEXT,
  p_outstanding_filter_partition_name TEXT,
  p_completed_filter_partition_name TEXT,
  p_user_filter_partition_name TEXT
)
LANGUAGE plpgsql
AS $procedure$
BEGIN
  CALL analytics.create_snapshot_filter_indexes_only(
    p_snapshot_id,
    p_overview_filter_partition_name,
    p_outstanding_filter_partition_name,
    p_completed_filter_partition_name,
    p_user_filter_partition_name
  );
  CALL analytics.populate_snapshot_cancelled_task_rows(p_snapshot_id);
END;
$procedure$;
