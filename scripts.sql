CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- Clean cutover: direct-to-snapshot analytics model.
-- This script is intentionally rerunnable from scratch via explicit drops.
-- ============================================================================

DROP PROCEDURE IF EXISTS analytics.run_snapshot_refresh_batch();

-- Snapshot tables
DROP TABLE IF EXISTS analytics.snapshot_wait_time_by_assigned_date CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_open_task_facts CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_task_daily_facts CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_user_completed_facts CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_task_rows CASCADE;

-- Metadata/state
DROP TABLE IF EXISTS analytics.snapshot_state CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_batches CASCADE;
DROP SEQUENCE IF EXISTS analytics.snapshot_id_seq;

-- Snapshot metadata
CREATE SEQUENCE analytics.snapshot_id_seq;

CREATE TABLE analytics.snapshot_batches (
  snapshot_id BIGINT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  error_message TEXT
);

CREATE TABLE analytics.snapshot_state (
  singleton_id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_id),
  published_snapshot_id BIGINT REFERENCES analytics.snapshot_batches(snapshot_id),
  published_at TIMESTAMPTZ,
  in_progress_snapshot_id BIGINT REFERENCES analytics.snapshot_batches(snapshot_id)
);

INSERT INTO analytics.snapshot_state (singleton_id) VALUES (TRUE);

-- Snapshot data tables
CREATE TABLE analytics.snapshot_task_rows (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  LIKE cft_task_db.reportable_task INCLUDING DEFAULTS,
  priority_bucket TEXT,
  priority_sort_value SMALLINT,
  within_due_sort_value SMALLINT
);

CREATE TABLE analytics.snapshot_user_completed_facts (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  assignee TEXT,
  jurisdiction_label TEXT,
  role_category_label TEXT,
  region TEXT,
  location TEXT,
  task_name TEXT,
  work_type TEXT,
  completed_date DATE,
  tasks INTEGER NOT NULL,
  within_due INTEGER NOT NULL,
  beyond_due INTEGER NOT NULL,
  handling_time_sum NUMERIC,
  handling_time_count INTEGER NOT NULL,
  days_beyond_sum NUMERIC,
  days_beyond_count INTEGER NOT NULL
);

CREATE TABLE analytics.snapshot_task_daily_facts (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  date_role TEXT NOT NULL,
  reference_date DATE,
  jurisdiction_label TEXT,
  role_category_label TEXT,
  region TEXT,
  location TEXT,
  task_name TEXT,
  work_type TEXT,
  priority BIGINT,
  task_status TEXT NOT NULL,
  assignment_state TEXT,
  sla_flag BOOLEAN,
  handling_time_days_sum NUMERIC NOT NULL,
  handling_time_days_count BIGINT NOT NULL,
  processing_time_days_sum NUMERIC NOT NULL,
  processing_time_days_count BIGINT NOT NULL,
  task_count BIGINT NOT NULL
);

CREATE TABLE analytics.snapshot_open_task_facts (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  jurisdiction_label TEXT,
  role_category_label TEXT,
  region TEXT,
  location TEXT,
  task_name TEXT,
  work_type TEXT,
  state TEXT NOT NULL,
  priority_bucket TEXT NOT NULL,
  task_count BIGINT NOT NULL
);

CREATE TABLE analytics.snapshot_wait_time_by_assigned_date (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  jurisdiction_label TEXT,
  role_category_label TEXT,
  region TEXT,
  location TEXT,
  task_name TEXT,
  work_type TEXT,
  reference_date DATE,
  total_wait_time INTERVAL,
  assigned_task_count BIGINT NOT NULL
);

-- Autovacuum tuning for high-churn snapshot tables.
ALTER TABLE analytics.snapshot_task_rows
  SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_analyze_threshold = 1000
  );

ALTER TABLE analytics.snapshot_user_completed_facts
  SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_analyze_threshold = 1000
  );

ALTER TABLE analytics.snapshot_task_daily_facts
  SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_analyze_threshold = 1000
  );

ALTER TABLE analytics.snapshot_open_task_facts
  SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_analyze_threshold = 1000
  );

ALTER TABLE analytics.snapshot_wait_time_by_assigned_date
  SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_analyze_threshold = 1000
  );

-- Snapshot indexes
CREATE UNIQUE INDEX ux_snapshot_task_rows_snapshot_task
  ON analytics.snapshot_task_rows(snapshot_id, task_id);

CREATE INDEX ix_snapshot_task_rows_snapshot_slicers
  ON analytics.snapshot_task_rows(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX ix_snapshot_task_rows_snapshot_state_created_desc
  ON analytics.snapshot_task_rows(snapshot_id, state, created_date DESC);

CREATE INDEX ix_snapshot_task_rows_snapshot_completed_reason_date_desc
  ON analytics.snapshot_task_rows(snapshot_id, LOWER(termination_reason), completed_date DESC);

CREATE INDEX ix_snapshot_task_rows_snapshot_completed_assignee_date_desc
  ON analytics.snapshot_task_rows(snapshot_id, assignee, completed_date DESC)
  WHERE LOWER(termination_reason) = 'completed' AND assignee IS NOT NULL;

CREATE INDEX ix_snapshot_task_rows_snapshot_case_id
  ON analytics.snapshot_task_rows(snapshot_id, case_id);

CREATE INDEX ix_snapshot_task_rows_snapshot_assignee
  ON analytics.snapshot_task_rows(snapshot_id, assignee);

CREATE INDEX ix_snapshot_task_rows_snapshot_upper_role_category
  ON analytics.snapshot_task_rows(snapshot_id, UPPER(role_category_label));

CREATE INDEX ix_snapshot_task_rows_snapshot_priority_sort
  ON analytics.snapshot_task_rows(snapshot_id, priority_sort_value, due_date, created_date);

CREATE INDEX ix_snapshot_task_rows_snapshot_within_due_sort
  ON analytics.snapshot_task_rows(snapshot_id, within_due_sort_value, completed_date);

CREATE INDEX ix_snapshot_task_rows_snapshot_open_due_date
  ON analytics.snapshot_task_rows(snapshot_id, due_date)
  WHERE state NOT IN ('COMPLETED', 'TERMINATED');

CREATE UNIQUE INDEX ux_snapshot_user_completed_facts_key
  ON analytics.snapshot_user_completed_facts(
    snapshot_id,
    assignee,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    completed_date
  );

CREATE INDEX ix_snapshot_user_completed_facts_assignee_date
  ON analytics.snapshot_user_completed_facts(snapshot_id, assignee, completed_date DESC);

CREATE INDEX ix_snapshot_user_completed_facts_assignee_task_name
  ON analytics.snapshot_user_completed_facts(snapshot_id, assignee, task_name);

CREATE INDEX ix_snapshot_user_completed_facts_slicers
  ON analytics.snapshot_user_completed_facts(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX ix_snapshot_user_completed_facts_completed_date
  ON analytics.snapshot_user_completed_facts(snapshot_id, completed_date);

CREATE INDEX ix_snapshot_user_completed_facts_upper_role_category
  ON analytics.snapshot_user_completed_facts(snapshot_id, UPPER(role_category_label));

CREATE UNIQUE INDEX ux_snapshot_task_daily_facts_key
  ON analytics.snapshot_task_daily_facts(
    snapshot_id,
    date_role,
    reference_date,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    priority,
    task_status,
    assignment_state,
    sla_flag
  );

CREATE INDEX ix_snapshot_task_daily_facts_date_role_status_date
  ON analytics.snapshot_task_daily_facts(snapshot_id, date_role, task_status, reference_date);

CREATE INDEX ix_snapshot_task_daily_facts_due_open_date
  ON analytics.snapshot_task_daily_facts(snapshot_id, reference_date)
  WHERE date_role = 'due' AND task_status = 'open';

CREATE INDEX ix_snapshot_task_daily_facts_created_open_date_assignment
  ON analytics.snapshot_task_daily_facts(snapshot_id, reference_date, assignment_state)
  WHERE date_role = 'created' AND task_status = 'open';

CREATE INDEX ix_snapshot_task_daily_facts_slicers
  ON analytics.snapshot_task_daily_facts(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX ix_snapshot_task_daily_facts_priority
  ON analytics.snapshot_task_daily_facts(snapshot_id, priority);

CREATE INDEX ix_snapshot_task_daily_facts_assignment_state
  ON analytics.snapshot_task_daily_facts(snapshot_id, assignment_state);

CREATE INDEX ix_snapshot_task_daily_facts_sla_flag
  ON analytics.snapshot_task_daily_facts(snapshot_id, sla_flag);

CREATE INDEX ix_snapshot_task_daily_facts_upper_role_category
  ON analytics.snapshot_task_daily_facts(snapshot_id, UPPER(role_category_label));

CREATE UNIQUE INDEX ux_snapshot_open_task_facts_key
  ON analytics.snapshot_open_task_facts(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    state,
    priority_bucket
  );

CREATE INDEX ix_snapshot_open_task_facts_slicers
  ON analytics.snapshot_open_task_facts(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX ix_snapshot_open_task_facts_state
  ON analytics.snapshot_open_task_facts(snapshot_id, state);

CREATE INDEX ix_snapshot_open_task_facts_priority_bucket
  ON analytics.snapshot_open_task_facts(snapshot_id, priority_bucket);

CREATE INDEX ix_snapshot_open_task_facts_upper_role_category
  ON analytics.snapshot_open_task_facts(snapshot_id, UPPER(role_category_label));

CREATE UNIQUE INDEX ux_snapshot_wait_time_by_assigned_date_key
  ON analytics.snapshot_wait_time_by_assigned_date(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    reference_date
  );

CREATE INDEX ix_snapshot_wait_time_by_assigned_date_slicers
  ON analytics.snapshot_wait_time_by_assigned_date(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX ix_snapshot_wait_time_by_assigned_date_reference_date
  ON analytics.snapshot_wait_time_by_assigned_date(snapshot_id, reference_date);

CREATE INDEX ix_snapshot_wait_time_by_assigned_date_upper_role_category
  ON analytics.snapshot_wait_time_by_assigned_date(snapshot_id, UPPER(role_category_label));

-- Snapshot producer and publisher
CREATE OR REPLACE PROCEDURE analytics.run_snapshot_refresh_batch()
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot_id BIGINT;
  v_lock_key BIGINT := hashtext('analytics_run_snapshot_refresh_batch_lock');
  v_base_row_count BIGINT;
  v_batch_failed BOOLEAN := FALSE;
  v_batch_error_message TEXT;
BEGIN
  IF NOT pg_try_advisory_lock(v_lock_key) THEN
    RAISE NOTICE 'Analytics snapshot batch already running; skipping trigger.';
    RETURN;
  END IF;

  BEGIN
    v_snapshot_id := nextval('analytics.snapshot_id_seq');

    INSERT INTO analytics.snapshot_batches (snapshot_id, status)
    VALUES (v_snapshot_id, 'running');

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
    CREATE TEMP TABLE tmp_snapshot_base
    ON COMMIT DROP
    AS
    SELECT
      task_id,
      update_id,
      task_name,
      jurisdiction_label,
      case_type_label,
      role_category_label,
      case_id,
      region,
      location,
      state,
      termination_reason,
      termination_process_label,
      outcome,
      work_type,
      is_within_sla,
      created_date,
      due_date,
      completed_date,
      first_assigned_date,
      major_priority,
      assignee,
      wait_time_days,
      wait_time,
      handling_time_days,
      handling_time,
      processing_time_days,
      processing_time,
      number_of_reassignments,
      CASE
        WHEN major_priority <= 2000 THEN 'Urgent'
        WHEN major_priority < 5000 THEN 'High'
        WHEN major_priority = 5000 AND due_date < CURRENT_DATE THEN 'High'
        WHEN major_priority = 5000 AND due_date = CURRENT_DATE THEN 'Medium'
        ELSE 'Low'
      END AS priority_bucket,
      CASE
        WHEN major_priority <= 2000 THEN 4
        WHEN major_priority < 5000 THEN 3
        WHEN major_priority = 5000 AND due_date < CURRENT_DATE THEN 3
        WHEN major_priority = 5000 AND due_date = CURRENT_DATE THEN 2
        ELSE 1
      END AS priority_sort_value,
      CASE
        WHEN is_within_sla = 'Yes' THEN 1
        WHEN is_within_sla = 'No' THEN 2
        ELSE 3
      END AS within_due_sort_value
    FROM cft_task_db.reportable_task;

    SELECT COUNT(*) INTO v_base_row_count
    FROM tmp_snapshot_base;

    IF v_base_row_count = 0 THEN
      RAISE EXCEPTION 'Base source cft_task_db.reportable_task is empty; refusing to publish snapshot %', v_snapshot_id;
    END IF;

    INSERT INTO analytics.snapshot_task_rows (
      snapshot_id,
      task_id,
      update_id,
      task_name,
      jurisdiction_label,
      case_type_label,
      role_category_label,
      case_id,
      region,
      location,
      state,
      termination_reason,
      termination_process_label,
      outcome,
      work_type,
      is_within_sla,
      created_date,
      due_date,
      completed_date,
      first_assigned_date,
      major_priority,
      assignee,
      wait_time_days,
      wait_time,
      handling_time_days,
      handling_time,
      processing_time_days,
      processing_time,
      number_of_reassignments,
      priority_bucket,
      priority_sort_value,
      within_due_sort_value
    )
    SELECT
      v_snapshot_id,
      task_id,
      update_id,
      task_name,
      jurisdiction_label,
      case_type_label,
      role_category_label,
      case_id,
      region,
      location,
      state,
      termination_reason,
      termination_process_label,
      outcome,
      work_type,
      is_within_sla,
      created_date,
      due_date,
      completed_date,
      first_assigned_date,
      major_priority,
      assignee,
      wait_time_days,
      wait_time,
      handling_time_days,
      handling_time,
      processing_time_days,
      processing_time,
      number_of_reassignments,
      priority_bucket,
      priority_sort_value,
      within_due_sort_value
    FROM tmp_snapshot_base;

    INSERT INTO analytics.snapshot_user_completed_facts (
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
      v_snapshot_id,
      assignee,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      completed_date::date AS completed_date,
      COUNT(*)::int AS tasks,
      SUM(CASE WHEN is_within_sla = 'Yes' THEN 1 ELSE 0 END)::int AS within_due,
      SUM(CASE WHEN is_within_sla = 'No' THEN 1 ELSE 0 END)::int AS beyond_due,
      SUM(EXTRACT(EPOCH FROM handling_time) / EXTRACT(EPOCH FROM INTERVAL '1 day'))::numeric AS handling_time_sum,
      COUNT(handling_time)::int AS handling_time_count,
      SUM(
        CASE
          WHEN due_date IS NOT NULL AND completed_date IS NOT NULL THEN completed_date::date - due_date::date
          ELSE 0
        END
      )::numeric AS days_beyond_sum,
      SUM(CASE WHEN due_date IS NOT NULL AND completed_date IS NOT NULL THEN 1 ELSE 0 END)::int AS days_beyond_count
    FROM tmp_snapshot_base
    WHERE completed_date IS NOT NULL
      AND LOWER(termination_reason) = 'completed'
    GROUP BY
      assignee,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      completed_date::date;

    INSERT INTO analytics.snapshot_task_daily_facts (
      snapshot_id,
      date_role,
      reference_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      priority,
      task_status,
      assignment_state,
      sla_flag,
      handling_time_days_sum,
      handling_time_days_count,
      processing_time_days_sum,
      processing_time_days_count,
      task_count
    )
    WITH base AS (
      SELECT
        task_name,
        jurisdiction_label,
        role_category_label,
        region,
        location,
        work_type,
        major_priority AS priority,
        state,
        termination_reason,
        CASE
          WHEN is_within_sla = 'Yes' THEN TRUE
          WHEN is_within_sla = 'No' THEN FALSE
          ELSE NULL
        END AS within_sla,
        created_date,
        due_date,
        completed_date,
        handling_time,
        processing_time
      FROM tmp_snapshot_base
    )
    SELECT
      v_snapshot_id,
      'due'::text AS date_role,
      due_date AS reference_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      priority,
      CASE
        WHEN LOWER(termination_reason) = 'completed' THEN 'completed'
        WHEN state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'open'
        ELSE 'other'
      END AS task_status,
      CASE
        WHEN state = 'ASSIGNED' THEN 'Assigned'
        WHEN state IN ('UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'Unassigned'
        ELSE NULL
      END AS assignment_state,
      CASE
        WHEN within_sla IS TRUE THEN TRUE
        WHEN within_sla IS FALSE THEN FALSE
        ELSE NULL
      END AS sla_flag,
      0::numeric AS handling_time_days_sum,
      0::bigint AS handling_time_days_count,
      0::numeric AS processing_time_days_sum,
      0::bigint AS processing_time_days_count,
      COUNT(*)::bigint AS task_count
    FROM base
    WHERE due_date IS NOT NULL
      AND (
        state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED')
        OR LOWER(termination_reason) = 'completed'
      )
    GROUP BY
      1,2,3,4,5,6,7,8,9,10,11,12,13

    UNION ALL

    SELECT
      v_snapshot_id,
      'created'::text AS date_role,
      created_date AS reference_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      priority,
      'open'::text AS task_status,
      CASE
        WHEN state = 'ASSIGNED' THEN 'Assigned'
        ELSE 'Unassigned'
      END AS assignment_state,
      NULL::boolean AS sla_flag,
      0::numeric AS handling_time_days_sum,
      0::bigint AS handling_time_days_count,
      0::numeric AS processing_time_days_sum,
      0::bigint AS processing_time_days_count,
      COUNT(*)::bigint AS task_count
    FROM base
    WHERE created_date IS NOT NULL
      AND state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED')
    GROUP BY
      1,2,3,4,5,6,7,8,9,10,11,12

    UNION ALL

    SELECT
      v_snapshot_id,
      'completed'::text AS date_role,
      completed_date AS reference_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      priority,
      'completed'::text AS task_status,
      NULL::text AS assignment_state,
      CASE
        WHEN within_sla IS TRUE THEN TRUE
        WHEN within_sla IS FALSE THEN FALSE
        ELSE NULL
      END AS sla_flag,
      COALESCE(SUM(EXTRACT(EPOCH FROM handling_time) / EXTRACT(EPOCH FROM INTERVAL '1 day')), 0)::numeric AS handling_time_days_sum,
      COUNT(handling_time)::bigint AS handling_time_days_count,
      COALESCE(SUM(EXTRACT(EPOCH FROM processing_time) / EXTRACT(EPOCH FROM INTERVAL '1 day')), 0)::numeric AS processing_time_days_sum,
      COUNT(processing_time)::bigint AS processing_time_days_count,
      COUNT(*)::bigint AS task_count
    FROM base
    WHERE completed_date IS NOT NULL
      AND LOWER(termination_reason) = 'completed'
    GROUP BY
      1,2,3,4,5,6,7,8,9,10,11,12,13

    UNION ALL

    SELECT
      v_snapshot_id,
      'cancelled'::text AS date_role,
      completed_date AS reference_date,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      priority,
      'cancelled'::text AS task_status,
      NULL::text AS assignment_state,
      NULL::boolean AS sla_flag,
      0::numeric AS handling_time_days_sum,
      0::bigint AS handling_time_days_count,
      0::numeric AS processing_time_days_sum,
      0::bigint AS processing_time_days_count,
      COUNT(*)::bigint AS task_count
    FROM base
    WHERE completed_date IS NOT NULL
      AND termination_reason = 'cancelled'
      AND state IN ('CANCELLED', 'TERMINATED')
    GROUP BY
      1,2,3,4,5,6,7,8,9,10,11,12,13;

    INSERT INTO analytics.snapshot_open_task_facts (
      snapshot_id,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      state,
      priority_bucket,
      task_count
    )
    SELECT
      v_snapshot_id,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      state,
      priority_bucket,
      COUNT(*)::bigint AS task_count
    FROM tmp_snapshot_base
    WHERE state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED')
    GROUP BY
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      state,
      priority_bucket;

    INSERT INTO analytics.snapshot_wait_time_by_assigned_date (
      snapshot_id,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      reference_date,
      total_wait_time,
      assigned_task_count
    )
    SELECT
      v_snapshot_id,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      first_assigned_date AS reference_date,
      SUM(wait_time) AS total_wait_time,
      COUNT(*)::bigint AS assigned_task_count
    FROM tmp_snapshot_base
    WHERE wait_time IS NOT NULL
    GROUP BY
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      first_assigned_date;
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

  UPDATE analytics.snapshot_batches
  SET status = 'succeeded', completed_at = clock_timestamp(), error_message = NULL
  WHERE snapshot_id = v_snapshot_id;

  UPDATE analytics.snapshot_state
  SET published_snapshot_id = v_snapshot_id,
      published_at = clock_timestamp(),
      in_progress_snapshot_id = NULL
  WHERE singleton_id = TRUE;

  BEGIN
    WITH pinned AS (
      SELECT published_snapshot_id AS snapshot_id
      FROM analytics.snapshot_state
      WHERE singleton_id = TRUE
      UNION
      SELECT in_progress_snapshot_id AS snapshot_id
      FROM analytics.snapshot_state
      WHERE singleton_id = TRUE
    ),
    keep_succeeded AS (
      SELECT snapshot_id
      FROM analytics.snapshot_batches
      WHERE status = 'succeeded'
      ORDER BY snapshot_id DESC
      LIMIT 3
    )
    DELETE FROM analytics.snapshot_batches batches
    WHERE batches.status = 'succeeded'
      AND batches.snapshot_id NOT IN (SELECT snapshot_id FROM keep_succeeded)
      AND batches.snapshot_id NOT IN (SELECT snapshot_id FROM pinned WHERE snapshot_id IS NOT NULL);

    WITH keep_failed AS (
      SELECT snapshot_id
      FROM analytics.snapshot_batches
      WHERE status = 'failed'
      ORDER BY snapshot_id DESC
      LIMIT 100
    )
    DELETE FROM analytics.snapshot_batches batches
    WHERE batches.status = 'failed'
      AND batches.snapshot_id NOT IN (SELECT snapshot_id FROM keep_failed);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Snapshot retention cleanup failed after publish of %: %', v_snapshot_id, SQLERRM;
  END;

  COMMIT;
  PERFORM pg_advisory_unlock(v_lock_key);
END;
$$;

-- Best-effort pg_cron setup and scheduler registration.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE WARNING 'Skipping pg_cron extension creation due to insufficient privileges.';
    WHEN undefined_file THEN
      RAISE WARNING 'Skipping pg_cron extension creation because pg_cron is not installed.';
  END;
END;
$$;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE WARNING 'cron schema unavailable; skipping cron.unschedule.';
  ELSE
    BEGIN
      PERFORM cron.unschedule('analytics_snapshot_refresh_batch')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'analytics_snapshot_refresh_batch');
    EXCEPTION
      WHEN undefined_table OR undefined_function THEN
        RAISE WARNING 'cron metadata unavailable; skipping cron.unschedule.';
    END;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE WARNING 'cron schema unavailable; skipping cron.schedule registration.';
  ELSE
    BEGIN
      PERFORM cron.schedule(
        'analytics_snapshot_refresh_batch',
        '*/30 * * * *',
        $$CALL analytics.run_snapshot_refresh_batch()$$
      );
    EXCEPTION
      WHEN undefined_table OR undefined_function THEN
        RAISE WARNING 'cron schedule function unavailable; skipping cron.schedule registration.';
    END;
  END IF;
END;
$$;
