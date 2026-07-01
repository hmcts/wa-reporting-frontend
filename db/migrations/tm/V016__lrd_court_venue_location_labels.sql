SET LOCAL lock_timeout = '20min';

SELECT pg_advisory_xact_lock(hashtext('analytics_run_snapshot_refresh_batch_lock'));

CREATE TABLE IF NOT EXISTS analytics.court_venue_case_type_lookup (
  epimms_id TEXT NOT NULL,
  ccd_case_type TEXT NOT NULL,
  service_code TEXT NOT NULL,
  court_type_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  region_id TEXT,
  PRIMARY KEY (epimms_id, ccd_case_type)
);

CREATE INDEX IF NOT EXISTS ix_court_venue_case_type_lookup_case_type
  ON analytics.court_venue_case_type_lookup(ccd_case_type);

CREATE TABLE IF NOT EXISTS analytics.court_venue_epimms_lookup (
  epimms_id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  region_id TEXT
);

CREATE TABLE IF NOT EXISTS analytics.location_reference_sync_state (
  singleton_id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_id),
  last_synced_at TIMESTAMPTZ NOT NULL,
  case_type_lookup_rows INTEGER NOT NULL,
  epimms_lookup_rows INTEGER NOT NULL
);

ALTER TABLE analytics.snapshot_open_task_rows
  ADD COLUMN IF NOT EXISTS location_id TEXT;

ALTER TABLE analytics.snapshot_completed_task_rows
  ADD COLUMN IF NOT EXISTS location_id TEXT;

CREATE OR REPLACE PROCEDURE analytics.create_snapshot_refresh_temp_tables()
LANGUAGE plpgsql
AS $procedure$
BEGIN
  CREATE TEMP TABLE tmp_snapshot_source
  ON COMMIT DROP
  AS
  SELECT
    source.task_id,
    source.task_name,
    source.case_type_id,
    source.jurisdiction_label,
    source.case_type_label,
    source.role_category_label,
    source.case_id,
    source.region,
    NULLIF(BTRIM(source.location), '') AS location_id,
    COALESCE(
      case_type_location.site_name,
      epimms_location.site_name,
      NULLIF(BTRIM(source.location), '')
    ) AS location,
    source.state,
    source.termination_reason,
    LOWER(COALESCE(source.termination_reason, '')) AS termination_reason_lower,
    source.termination_process_label,
    source.outcome,
    source.work_type,
    source.is_within_sla,
    source.created_date,
    source.due_date,
    source.completed_date,
    source.first_assigned_date,
    source.major_priority,
    source.assignee,
    COALESCE(source.number_of_reassignments, 0) AS number_of_reassignments,
    CASE
      WHEN source.wait_time IS NULL THEN NULL
      ELSE (EXTRACT(EPOCH FROM source.wait_time) / EXTRACT(EPOCH FROM INTERVAL '1 day'))::double precision
    END AS wait_time_days,
    CASE
      WHEN source.handling_time IS NULL THEN NULL
      ELSE (EXTRACT(EPOCH FROM source.handling_time) / EXTRACT(EPOCH FROM INTERVAL '1 day'))::double precision
    END AS handling_time_days,
    CASE
      WHEN source.processing_time IS NULL THEN NULL
      ELSE (EXTRACT(EPOCH FROM source.processing_time) / EXTRACT(EPOCH FROM INTERVAL '1 day'))::double precision
    END AS processing_time_days,
    (
      COALESCE(
        EXTRACT(EPOCH FROM source.due_date_to_completed_diff_time) / EXTRACT(EPOCH FROM INTERVAL '1 day'),
        0
      ) * -1
    )::double precision AS days_beyond_due,
    CASE
      WHEN source.is_within_sla = 'Yes' THEN 1
      WHEN source.is_within_sla = 'No' THEN 2
      ELSE 3
    END AS within_due_sort_value
  FROM cft_task_db.reportable_task source
  LEFT JOIN analytics.court_venue_case_type_lookup case_type_location
    ON case_type_location.epimms_id = NULLIF(BTRIM(source.location), '')
   AND case_type_location.ccd_case_type = source.case_type_id
  LEFT JOIN analytics.court_venue_epimms_lookup epimms_location
    ON epimms_location.epimms_id = NULLIF(BTRIM(source.location), '');

  CREATE TEMP TABLE tmp_snapshot_fact_source
  ON COMMIT DROP
  AS
  SELECT
    task_name,
    case_type_id,
    jurisdiction_label,
    role_category_label,
    region,
    location_id,
    location,
    work_type,
    major_priority AS priority,
    termination_reason_lower,
    created_date,
    due_date,
    completed_date,
    handling_time_days,
    processing_time_days,
    CASE
      WHEN state = 'ASSIGNED' THEN 'Assigned'
      WHEN state IN ('UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'Unassigned'
      ELSE NULL
    END AS assignment_state,
    CASE
      WHEN termination_reason_lower = 'completed' THEN 'completed'
      WHEN state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'open'
      ELSE 'other'
    END AS task_status,
    CASE
      WHEN is_within_sla = 'Yes' THEN TRUE
      WHEN is_within_sla = 'No' THEN FALSE
      ELSE NULL
    END AS sla_flag
  FROM tmp_snapshot_source;
END;
$procedure$;

CREATE OR REPLACE PROCEDURE analytics.populate_snapshot_detached_tables(
  p_snapshot_id BIGINT,
  p_open_rows_table REGCLASS,
  p_completed_rows_table REGCLASS,
  p_user_completed_facts_table REGCLASS,
  p_completed_dashboard_facts_table REGCLASS,
  p_outstanding_due_status_table REGCLASS,
  p_outstanding_created_assignment_table REGCLASS,
  p_open_due_table REGCLASS,
  p_task_event_table REGCLASS,
  p_wait_time_table REGCLASS
)
LANGUAGE plpgsql
AS $procedure$
DECLARE
  v_prev_work_mem TEXT;
  v_prev_hash_mem_multiplier TEXT;
  v_prev_enable_sort TEXT;
BEGIN
  EXECUTE format(
    $open_rows_insert$
    INSERT INTO %s (
      snapshot_id,
      task_id,
      case_id,
      task_name,
      case_type_label,
      jurisdiction_label,
      role_category_label,
      region,
      location_id,
      location,
      work_type,
      state,
      created_date,
      first_assigned_date,
      due_date,
      major_priority,
      assignee,
      number_of_reassignments
    )
    SELECT
      $1,
      task_id,
      case_id,
      task_name,
      case_type_label,
      jurisdiction_label,
      role_category_label,
      region,
      location_id,
      location,
      work_type,
      state,
      created_date,
      first_assigned_date,
      due_date,
      major_priority,
      assignee,
      number_of_reassignments
    FROM tmp_snapshot_source
    WHERE state NOT IN ('COMPLETED', 'TERMINATED')
    $open_rows_insert$,
    p_open_rows_table
  )
  USING p_snapshot_id;

  EXECUTE format(
    $completed_rows_insert$
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
      handling_time_days,
      is_within_sla,
      termination_process_label,
      outcome,
      major_priority,
      assignee,
      number_of_reassignments,
      within_due_sort_value
    FROM tmp_snapshot_source
    WHERE termination_reason_lower = 'completed'
    $completed_rows_insert$,
    p_completed_rows_table
  )
  USING p_snapshot_id;

  EXECUTE format(
    $user_completed_insert$
    INSERT INTO %s (
      snapshot_id,
      assignee,
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
      assignee,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      completed_date,
      COUNT(*)::int AS tasks,
      SUM(CASE WHEN is_within_sla = 'Yes' THEN 1 ELSE 0 END)::int AS within_due,
      SUM(CASE WHEN is_within_sla = 'No' THEN 1 ELSE 0 END)::int AS beyond_due,
      COALESCE(SUM(COALESCE(handling_time_days, 0)), 0)::numeric AS handling_time_sum,
      COUNT(handling_time_days)::int AS handling_time_count,
      COALESCE(SUM(days_beyond_due), 0)::numeric AS days_beyond_sum,
      COUNT(*)::int AS days_beyond_count
    FROM tmp_snapshot_source
    WHERE completed_date IS NOT NULL
      AND termination_reason_lower = 'completed'
    GROUP BY
      assignee,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      completed_date
    $user_completed_insert$,
    p_user_completed_facts_table
  )
  USING p_snapshot_id;

  SELECT
    current_setting('work_mem'),
    current_setting('hash_mem_multiplier'),
    current_setting('enable_sort')
  INTO
    v_prev_work_mem,
    v_prev_hash_mem_multiplier,
    v_prev_enable_sort;

  -- Bias aggregate fact builds toward in-memory hash aggregate.
  PERFORM set_config('work_mem', '1GB', TRUE);
  PERFORM set_config('hash_mem_multiplier', '4', TRUE);
  PERFORM set_config('enable_sort', 'off', TRUE);

  EXECUTE format(
    $outstanding_due_status_insert$
    INSERT INTO %s (
      snapshot_id,
      due_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      open_task_count,
      completed_task_count
    )
    SELECT
      $1,
      due_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      SUM(CASE WHEN task_status = 'open' THEN 1 ELSE 0 END)::bigint AS open_task_count,
      SUM(CASE WHEN task_status = 'completed' THEN 1 ELSE 0 END)::bigint AS completed_task_count
    FROM tmp_snapshot_fact_source
    WHERE due_date IS NOT NULL
      AND task_status IN ('open', 'completed')
    GROUP BY
      due_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type
    $outstanding_due_status_insert$,
    p_outstanding_due_status_table
  )
  USING p_snapshot_id;

  EXECUTE format(
    $outstanding_created_assignment_insert$
    INSERT INTO %s (
      snapshot_id,
      reference_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      assignment_state,
      task_count
    )
    SELECT
      $1,
      created_date AS reference_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      assignment_state,
      COUNT(*)::bigint AS task_count
    FROM tmp_snapshot_fact_source
    WHERE created_date IS NOT NULL
      AND task_status = 'open'
    GROUP BY
      created_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      assignment_state
    $outstanding_created_assignment_insert$,
    p_outstanding_created_assignment_table
  )
  USING p_snapshot_id;

  EXECUTE format(
    $completed_dashboard_insert$
    INSERT INTO %s (
      snapshot_id,
      reference_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      total_task_count,
      within_task_count,
      handling_time_days_sum,
      handling_time_days_sum_squares,
      handling_time_days_count,
      processing_time_days_sum,
      processing_time_days_sum_squares,
      processing_time_days_count
    )
    SELECT
      $1,
      completed_date AS reference_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      COUNT(*)::bigint AS total_task_count,
      SUM(CASE WHEN sla_flag IS TRUE THEN 1 ELSE 0 END)::bigint AS within_task_count,
      COALESCE(SUM(COALESCE(handling_time_days, 0)), 0)::numeric AS handling_time_days_sum,
      COALESCE(
        SUM(COALESCE(handling_time_days, 0)::numeric * COALESCE(handling_time_days, 0)::numeric),
        0
      )::numeric AS handling_time_days_sum_squares,
      COUNT(handling_time_days)::bigint AS handling_time_days_count,
      COALESCE(SUM(COALESCE(processing_time_days, 0)), 0)::numeric AS processing_time_days_sum,
      COALESCE(
        SUM(COALESCE(processing_time_days, 0)::numeric * COALESCE(processing_time_days, 0)::numeric),
        0
      )::numeric AS processing_time_days_sum_squares,
      COUNT(processing_time_days)::bigint AS processing_time_days_count
    FROM tmp_snapshot_fact_source
    WHERE completed_date IS NOT NULL
      AND termination_reason_lower = 'completed'
    GROUP BY
      completed_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type
    $completed_dashboard_insert$,
    p_completed_dashboard_facts_table
  )
  USING p_snapshot_id;

  EXECUTE format(
    $open_due_insert$
    INSERT INTO %s (
      snapshot_id,
      due_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      priority,
      assignment_state,
      task_count
    )
    SELECT
      $1,
      due_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      priority,
      assignment_state,
      COUNT(*)::bigint AS task_count
    FROM tmp_snapshot_fact_source
    WHERE due_date IS NOT NULL
      AND task_status = 'open'
    GROUP BY
      due_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      priority,
      assignment_state
    $open_due_insert$,
    p_open_due_table
  )
  USING p_snapshot_id;

  EXECUTE format(
    $task_event_insert$
    INSERT INTO %s (
      snapshot_id,
      event_date,
      event_type,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      task_count
    )
    SELECT
      $1,
      created_date AS event_date,
      'created'::text AS event_type,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      COUNT(*)::bigint AS task_count
    FROM tmp_snapshot_fact_source
    WHERE created_date IS NOT NULL
    GROUP BY
      created_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type

    UNION ALL

    SELECT
      $1,
      completed_date AS event_date,
      'completed'::text AS event_type,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      COUNT(*)::bigint AS task_count
    FROM tmp_snapshot_fact_source
    WHERE completed_date IS NOT NULL
      AND termination_reason_lower = 'completed'
    GROUP BY
      completed_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type

    UNION ALL

    SELECT
      $1,
      completed_date AS event_date,
      'cancelled'::text AS event_type,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      COUNT(*)::bigint AS task_count
    FROM tmp_snapshot_fact_source
    WHERE completed_date IS NOT NULL
      AND termination_reason_lower = 'deleted'
    GROUP BY
      completed_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type
    $task_event_insert$,
    p_task_event_table
  )
  USING p_snapshot_id;

  -- Restore baseline refresh-session settings for subsequent statements.
  PERFORM set_config('enable_sort', v_prev_enable_sort, TRUE);
  PERFORM set_config('work_mem', v_prev_work_mem, TRUE);
  PERFORM set_config('hash_mem_multiplier', v_prev_hash_mem_multiplier, TRUE);

  EXECUTE format(
    $wait_time_insert$
    INSERT INTO %s (
      snapshot_id,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      reference_date,
      total_wait_time_days_sum,
      assigned_task_count
    )
    SELECT
      $1,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      first_assigned_date AS reference_date,
      COALESCE(SUM(COALESCE(wait_time_days, 0)), 0)::numeric AS total_wait_time_days_sum,
      COUNT(*)::bigint AS assigned_task_count
    FROM tmp_snapshot_source
    WHERE state = 'ASSIGNED'
      AND wait_time_days IS NOT NULL
    GROUP BY
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      first_assigned_date
    $wait_time_insert$,
    p_wait_time_table
  )
  USING p_snapshot_id;
END;
$procedure$;
