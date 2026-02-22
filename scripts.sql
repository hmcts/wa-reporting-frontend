CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- Multi-snapshot incremental analytics model with immutable snapshot reads.
-- This script is intentionally rerunnable from scratch via explicit drops.
-- ============================================================================

DROP PROCEDURE IF EXISTS analytics.run_snapshot_refresh_batch(BOOLEAN);

-- Snapshot tables
DROP TABLE IF EXISTS analytics.snapshot_wait_time_by_assigned_date CASCADE;
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
  as_of_date DATE NOT NULL,
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  error_message TEXT
);

CREATE TABLE analytics.snapshot_state (
  -- Single-row control table: tracks current publish pointer and delta watermark.
  singleton_id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_id),
  published_snapshot_id BIGINT REFERENCES analytics.snapshot_batches(snapshot_id),
  published_at TIMESTAMPTZ,
  in_progress_snapshot_id BIGINT REFERENCES analytics.snapshot_batches(snapshot_id),
  last_source_report_refresh_time TIMESTAMPTZ
);

INSERT INTO analytics.snapshot_state (singleton_id) VALUES (TRUE);

-- Snapshot data tables (version-ranged rows)
CREATE TABLE analytics.snapshot_task_rows (
  LIKE cft_task_db.reportable_task INCLUDING DEFAULTS,
  -- Row is visible in snapshots [valid_from_snapshot_id, valid_to_snapshot_id).
  -- NULL valid_to_snapshot_id means "currently visible".
  valid_from_snapshot_id BIGINT NOT NULL,
  valid_to_snapshot_id BIGINT,
  within_due_sort_value SMALLINT
);

CREATE TABLE analytics.snapshot_user_completed_facts (
  valid_from_snapshot_id BIGINT NOT NULL,
  valid_to_snapshot_id BIGINT,
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
  valid_from_snapshot_id BIGINT NOT NULL,
  valid_to_snapshot_id BIGINT,
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

CREATE TABLE analytics.snapshot_wait_time_by_assigned_date (
  valid_from_snapshot_id BIGINT NOT NULL,
  valid_to_snapshot_id BIGINT,
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

ALTER TABLE analytics.snapshot_wait_time_by_assigned_date
  SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_analyze_threshold = 1000
  );

-- Snapshot indexes
CREATE UNIQUE INDEX ux_snapshot_task_rows_task_current
  ON analytics.snapshot_task_rows(task_id)
  WHERE valid_to_snapshot_id IS NULL;

CREATE INDEX ix_snapshot_task_rows_validity
  ON analytics.snapshot_task_rows(valid_from_snapshot_id, valid_to_snapshot_id);

CREATE INDEX ix_snapshot_task_rows_valid_to
  ON analytics.snapshot_task_rows(valid_to_snapshot_id)
  WHERE valid_to_snapshot_id IS NOT NULL;

CREATE INDEX ix_snapshot_task_rows_slicers
  ON analytics.snapshot_task_rows(
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX ix_snapshot_task_rows_state_created_desc
  ON analytics.snapshot_task_rows(state, created_date DESC);

CREATE INDEX ix_snapshot_task_rows_completed_reason_date_desc
  ON analytics.snapshot_task_rows(LOWER(termination_reason), completed_date DESC);

CREATE INDEX ix_snapshot_task_rows_completed_assignee_date_desc
  ON analytics.snapshot_task_rows(assignee, completed_date DESC)
  WHERE LOWER(termination_reason) = 'completed' AND assignee IS NOT NULL;

CREATE INDEX ix_snapshot_task_rows_case_id
  ON analytics.snapshot_task_rows(case_id);

CREATE INDEX ix_snapshot_task_rows_assignee
  ON analytics.snapshot_task_rows(assignee);

CREATE INDEX ix_snapshot_task_rows_upper_role_category
  ON analytics.snapshot_task_rows(UPPER(role_category_label));

CREATE INDEX ix_snapshot_task_rows_within_due_sort
  ON analytics.snapshot_task_rows(within_due_sort_value, completed_date);

CREATE INDEX ix_snapshot_task_rows_open_due_date
  ON analytics.snapshot_task_rows(due_date)
  WHERE state NOT IN ('COMPLETED', 'TERMINATED');

CREATE UNIQUE INDEX ux_snapshot_user_completed_facts_key_current
  ON analytics.snapshot_user_completed_facts(
    assignee,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    completed_date
  )
  WHERE valid_to_snapshot_id IS NULL;

CREATE INDEX ix_snapshot_user_completed_facts_validity
  ON analytics.snapshot_user_completed_facts(valid_from_snapshot_id, valid_to_snapshot_id);

CREATE INDEX ix_snapshot_user_completed_facts_valid_to
  ON analytics.snapshot_user_completed_facts(valid_to_snapshot_id)
  WHERE valid_to_snapshot_id IS NOT NULL;

CREATE INDEX ix_snapshot_user_completed_facts_assignee_date
  ON analytics.snapshot_user_completed_facts(assignee, completed_date DESC);

CREATE INDEX ix_snapshot_user_completed_facts_assignee_task_name
  ON analytics.snapshot_user_completed_facts(assignee, task_name);

CREATE INDEX ix_snapshot_user_completed_facts_slicers
  ON analytics.snapshot_user_completed_facts(
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX ix_snapshot_user_completed_facts_completed_date
  ON analytics.snapshot_user_completed_facts(completed_date);

CREATE INDEX ix_snapshot_user_completed_facts_upper_role_category
  ON analytics.snapshot_user_completed_facts(UPPER(role_category_label));

CREATE UNIQUE INDEX ux_snapshot_task_daily_facts_key_current
  ON analytics.snapshot_task_daily_facts(
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
  )
  WHERE valid_to_snapshot_id IS NULL;

CREATE INDEX ix_snapshot_task_daily_facts_validity
  ON analytics.snapshot_task_daily_facts(valid_from_snapshot_id, valid_to_snapshot_id);

CREATE INDEX ix_snapshot_task_daily_facts_valid_to
  ON analytics.snapshot_task_daily_facts(valid_to_snapshot_id)
  WHERE valid_to_snapshot_id IS NOT NULL;

CREATE INDEX ix_snapshot_task_daily_facts_date_role_status_date
  ON analytics.snapshot_task_daily_facts(date_role, task_status, reference_date);

CREATE INDEX ix_snapshot_task_daily_facts_due_open_date
  ON analytics.snapshot_task_daily_facts(reference_date)
  WHERE date_role = 'due' AND task_status = 'open';

CREATE INDEX ix_snapshot_task_daily_facts_created_open_date_assignment
  ON analytics.snapshot_task_daily_facts(reference_date, assignment_state)
  WHERE date_role = 'created' AND task_status = 'open';

CREATE INDEX ix_snapshot_task_daily_facts_slicers
  ON analytics.snapshot_task_daily_facts(
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX ix_snapshot_task_daily_facts_priority
  ON analytics.snapshot_task_daily_facts(priority);

CREATE INDEX ix_snapshot_task_daily_facts_assignment_state
  ON analytics.snapshot_task_daily_facts(assignment_state);

CREATE INDEX ix_snapshot_task_daily_facts_sla_flag
  ON analytics.snapshot_task_daily_facts(sla_flag);

CREATE INDEX ix_snapshot_task_daily_facts_upper_role_category
  ON analytics.snapshot_task_daily_facts(UPPER(role_category_label));

CREATE UNIQUE INDEX ux_snapshot_wait_time_by_assigned_date_key_current
  ON analytics.snapshot_wait_time_by_assigned_date(
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    reference_date
  )
  WHERE valid_to_snapshot_id IS NULL;

CREATE INDEX ix_snapshot_wait_time_by_assigned_date_validity
  ON analytics.snapshot_wait_time_by_assigned_date(valid_from_snapshot_id, valid_to_snapshot_id);

CREATE INDEX ix_snapshot_wait_time_by_assigned_date_valid_to
  ON analytics.snapshot_wait_time_by_assigned_date(valid_to_snapshot_id)
  WHERE valid_to_snapshot_id IS NOT NULL;

CREATE INDEX ix_snapshot_wait_time_by_assigned_date_slicers
  ON analytics.snapshot_wait_time_by_assigned_date(
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX ix_snapshot_wait_time_by_assigned_date_reference_date
  ON analytics.snapshot_wait_time_by_assigned_date(reference_date);

CREATE INDEX ix_snapshot_wait_time_by_assigned_date_upper_role_category
  ON analytics.snapshot_wait_time_by_assigned_date(UPPER(role_category_label));

-- Source-table support index for incremental delta detection.
CREATE INDEX IF NOT EXISTS ix_reportable_task_report_refresh_time_task_id
  ON cft_task_db.reportable_task(report_refresh_time, task_id);

-- Snapshot producer and publisher
CREATE OR REPLACE PROCEDURE analytics.run_snapshot_refresh_batch(p_clear_before_full_rebuild BOOLEAN DEFAULT FALSE)
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot_id BIGINT;
  v_lock_key BIGINT := hashtext('analytics_run_snapshot_refresh_batch_lock');
  v_batch_failed BOOLEAN := FALSE;
  v_batch_error_message TEXT;
  v_last_source_report_refresh_time TIMESTAMPTZ;
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_as_of_date DATE := (clock_timestamp() AT TIME ZONE 'Europe/London')::date;
  v_oldest_retained_snapshot_id BIGINT;
  v_changed_count BIGINT := 0;
  v_source_empty BOOLEAN := FALSE;
  v_data_changed BOOLEAN := FALSE;
  -- Hybrid mode: use full rebuild for bootstrap or large deltas, incremental for small deltas.
  v_use_full_rebuild BOOLEAN := FALSE;
  v_estimated_source_count BIGINT := 0;
  v_full_rebuild_ratio_threshold NUMERIC := 0.25;
  v_clear_before_full_rebuild BOOLEAN := COALESCE(p_clear_before_full_rebuild, FALSE);
BEGIN
  IF NOT pg_try_advisory_lock(v_lock_key) THEN
    RAISE NOTICE 'Analytics snapshot batch already running; skipping trigger.';
    RETURN;
  END IF;

  BEGIN
    IF v_clear_before_full_rebuild THEN
      -- Optional maintenance mode: clear snapshot history/state before rebuilding from source.
      UPDATE analytics.snapshot_state
      SET published_snapshot_id = NULL,
          published_at = NULL,
          in_progress_snapshot_id = NULL,
          last_source_report_refresh_time = NULL
      WHERE singleton_id = TRUE;

      TRUNCATE TABLE
        analytics.snapshot_task_rows,
        analytics.snapshot_user_completed_facts,
        analytics.snapshot_task_daily_facts,
        analytics.snapshot_wait_time_by_assigned_date;

      DELETE FROM analytics.snapshot_batches;
      ALTER SEQUENCE analytics.snapshot_id_seq RESTART WITH 1;
    END IF;

    v_snapshot_id := nextval('analytics.snapshot_id_seq');
    v_window_end := clock_timestamp();

    SELECT last_source_report_refresh_time
      INTO v_last_source_report_refresh_time
    FROM analytics.snapshot_state
    WHERE singleton_id = TRUE
    FOR UPDATE;

    IF v_last_source_report_refresh_time IS NULL THEN
      v_window_start := NULL;
    ELSE
      -- Safety overlap: replay recent source updates to absorb timing skew/lag.
      v_window_start := v_last_source_report_refresh_time - INTERVAL '120 minutes';
    END IF;

    INSERT INTO analytics.snapshot_batches (
      snapshot_id,
      as_of_date,
      window_start,
      window_end,
      status
    )
    VALUES (
      v_snapshot_id,
      v_as_of_date,
      v_window_start,
      v_window_end,
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
    CREATE TEMP TABLE tmp_changed_task_ids (
      task_id TEXT PRIMARY KEY
    )
    ON COMMIT DROP;

    IF v_last_source_report_refresh_time IS NULL THEN
      INSERT INTO tmp_changed_task_ids (task_id)
      SELECT task_id
      FROM cft_task_db.reportable_task
      ON CONFLICT (task_id) DO NOTHING;
    ELSE
      INSERT INTO tmp_changed_task_ids (task_id)
      SELECT task_id
      FROM cft_task_db.reportable_task
      WHERE report_refresh_time > v_window_start
        AND report_refresh_time <= v_window_end
      ON CONFLICT (task_id) DO NOTHING;
    END IF;

    GET DIAGNOSTICS v_changed_count = ROW_COUNT;

    SELECT NOT EXISTS (SELECT 1 FROM cft_task_db.reportable_task LIMIT 1)
    INTO v_source_empty;

    -- Choose execution strategy:
    -- 1) first-ever run -> full rebuild
    -- 2) large delta -> full rebuild
    -- 3) otherwise -> incremental changed-key refresh
    IF v_clear_before_full_rebuild THEN
      v_use_full_rebuild := TRUE;
    ELSIF v_last_source_report_refresh_time IS NULL THEN
      v_use_full_rebuild := TRUE;
    ELSIF v_changed_count > 0 THEN
      SELECT COALESCE(reltuples, 0)::bigint
      INTO v_estimated_source_count
      FROM pg_class
      WHERE oid = 'cft_task_db.reportable_task'::regclass;

      IF v_estimated_source_count > 0
        AND (v_changed_count::numeric / v_estimated_source_count::numeric) >= v_full_rebuild_ratio_threshold THEN
        v_use_full_rebuild := TRUE;
      END IF;
    END IF;

    IF v_source_empty THEN
      -- Empty source is valid; publish an empty-visible snapshot by closing any current rows.
      v_data_changed := TRUE;

      UPDATE analytics.snapshot_task_rows
      SET valid_to_snapshot_id = v_snapshot_id
      WHERE valid_to_snapshot_id IS NULL;

      UPDATE analytics.snapshot_user_completed_facts
      SET valid_to_snapshot_id = v_snapshot_id
      WHERE valid_to_snapshot_id IS NULL;

      UPDATE analytics.snapshot_task_daily_facts
      SET valid_to_snapshot_id = v_snapshot_id
      WHERE valid_to_snapshot_id IS NULL;

      UPDATE analytics.snapshot_wait_time_by_assigned_date
      SET valid_to_snapshot_id = v_snapshot_id
      WHERE valid_to_snapshot_id IS NULL;
    ELSIF v_use_full_rebuild THEN
      -- Full rebuild path: recompute all "current" rows/facts from source for this snapshot.
      v_data_changed := TRUE;

      CREATE TEMP TABLE tmp_source_full
      ON COMMIT DROP
      AS
      SELECT
        source.task_id,
        source.update_id,
        source.task_name,
        source.jurisdiction_label,
        source.case_type_label,
        source.role_category_label,
        source.case_id,
        source.region,
        source.location,
        source.state,
        source.termination_reason,
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
        source.wait_time_days,
        source.wait_time,
        source.handling_time_days,
        source.handling_time,
        source.processing_time_days,
        source.processing_time,
        source.number_of_reassignments,
        CASE
          WHEN source.is_within_sla = 'Yes' THEN 1
          WHEN source.is_within_sla = 'No' THEN 2
          ELSE 3
        END AS within_due_sort_value
      FROM cft_task_db.reportable_task source;

      UPDATE analytics.snapshot_task_rows
      SET valid_to_snapshot_id = v_snapshot_id
      WHERE valid_to_snapshot_id IS NULL;

      INSERT INTO analytics.snapshot_task_rows (
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
        valid_from_snapshot_id,
        valid_to_snapshot_id,
        within_due_sort_value
      )
      SELECT
        source.task_id,
        source.update_id,
        source.task_name,
        source.jurisdiction_label,
        source.case_type_label,
        source.role_category_label,
        source.case_id,
        source.region,
        source.location,
        source.state,
        source.termination_reason,
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
        source.wait_time_days,
        source.wait_time,
        source.handling_time_days,
        source.handling_time,
        source.processing_time_days,
        source.processing_time,
        source.number_of_reassignments,
        v_snapshot_id,
        NULL::bigint,
        source.within_due_sort_value
      FROM tmp_source_full source;

      UPDATE analytics.snapshot_user_completed_facts
      SET valid_to_snapshot_id = v_snapshot_id
      WHERE valid_to_snapshot_id IS NULL;

      INSERT INTO analytics.snapshot_user_completed_facts (
        valid_from_snapshot_id,
        valid_to_snapshot_id,
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
        NULL::bigint,
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
      FROM analytics.snapshot_task_rows
      WHERE valid_to_snapshot_id IS NULL
        AND completed_date IS NOT NULL
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

      UPDATE analytics.snapshot_task_daily_facts
      SET valid_to_snapshot_id = v_snapshot_id
      WHERE valid_to_snapshot_id IS NULL;

      INSERT INTO analytics.snapshot_task_daily_facts (
        valid_from_snapshot_id,
        valid_to_snapshot_id,
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
        FROM analytics.snapshot_task_rows
        WHERE valid_to_snapshot_id IS NULL
      )
      SELECT
        v_snapshot_id,
        NULL::bigint,
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
        1,2,3,4,5,6,7,8,9,10,11,12,13,14

      UNION ALL

      SELECT
        v_snapshot_id,
        NULL::bigint,
        'created'::text AS date_role,
        created_date AS reference_date,
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
        NULL::boolean AS sla_flag,
        0::numeric AS handling_time_days_sum,
        0::bigint AS handling_time_days_count,
        0::numeric AS processing_time_days_sum,
        0::bigint AS processing_time_days_count,
        COUNT(*)::bigint AS task_count
      FROM base
      WHERE created_date IS NOT NULL
      GROUP BY
        1,2,3,4,5,6,7,8,9,10,11,12,13

      UNION ALL

      SELECT
        v_snapshot_id,
        NULL::bigint,
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
        1,2,3,4,5,6,7,8,9,10,11,12,13,14

      UNION ALL

      SELECT
        v_snapshot_id,
        NULL::bigint,
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
        1,2,3,4,5,6,7,8,9,10,11,12,13,14;

      UPDATE analytics.snapshot_wait_time_by_assigned_date
      SET valid_to_snapshot_id = v_snapshot_id
      WHERE valid_to_snapshot_id IS NULL;

      INSERT INTO analytics.snapshot_wait_time_by_assigned_date (
        valid_from_snapshot_id,
        valid_to_snapshot_id,
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
        NULL::bigint,
        jurisdiction_label,
        role_category_label,
        region,
        location,
        task_name,
        work_type,
        first_assigned_date AS reference_date,
        SUM(wait_time) AS total_wait_time,
        COUNT(*)::bigint AS assigned_task_count
      FROM analytics.snapshot_task_rows
      WHERE valid_to_snapshot_id IS NULL
        AND wait_time IS NOT NULL
      GROUP BY
        jurisdiction_label,
        role_category_label,
        region,
        location,
        task_name,
        work_type,
        first_assigned_date;
    ELSIF v_changed_count > 0 THEN
      -- Incremental path: only touched task rows and affected aggregate keys are recomputed.
      v_data_changed := TRUE;

      CREATE TEMP TABLE tmp_source_changed
      ON COMMIT DROP
      AS
      SELECT
        source.task_id,
        source.update_id,
        source.task_name,
        source.jurisdiction_label,
        source.case_type_label,
        source.role_category_label,
        source.case_id,
        source.region,
        source.location,
        source.state,
        source.termination_reason,
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
        source.wait_time_days,
        source.wait_time,
        source.handling_time_days,
        source.handling_time,
        source.processing_time_days,
        source.processing_time,
        source.number_of_reassignments,
        CASE
          WHEN source.is_within_sla = 'Yes' THEN 1
          WHEN source.is_within_sla = 'No' THEN 2
          ELSE 3
        END AS within_due_sort_value
      FROM cft_task_db.reportable_task source
      INNER JOIN tmp_changed_task_ids changed
        ON changed.task_id = source.task_id;

      CREATE TEMP TABLE tmp_changed_old
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
        number_of_reassignments
      FROM analytics.snapshot_task_rows existing
      WHERE existing.valid_to_snapshot_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM tmp_changed_task_ids changed
          WHERE changed.task_id = existing.task_id
        );

      UPDATE analytics.snapshot_task_rows existing
      SET valid_to_snapshot_id = v_snapshot_id
      WHERE existing.valid_to_snapshot_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM tmp_changed_task_ids changed
          WHERE changed.task_id = existing.task_id
        );

      INSERT INTO analytics.snapshot_task_rows (
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
        valid_from_snapshot_id,
        valid_to_snapshot_id,
        within_due_sort_value
      )
      SELECT
        source.task_id,
        source.update_id,
        source.task_name,
        source.jurisdiction_label,
        source.case_type_label,
        source.role_category_label,
        source.case_id,
        source.region,
        source.location,
        source.state,
        source.termination_reason,
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
        source.wait_time_days,
        source.wait_time,
        source.handling_time_days,
        source.handling_time,
        source.processing_time_days,
        source.processing_time,
        source.number_of_reassignments,
        v_snapshot_id,
        NULL::bigint,
        source.within_due_sort_value
      FROM tmp_source_changed source;

      CREATE TEMP TABLE tmp_affected_user_completed_keys
      ON COMMIT DROP
      AS
      SELECT DISTINCT
        assignee,
        jurisdiction_label,
        role_category_label,
        region,
        location,
        task_name,
        work_type,
        completed_date::date AS completed_date
      FROM (
        SELECT
          assignee,
          jurisdiction_label,
          role_category_label,
          region,
          location,
          task_name,
          work_type,
          completed_date,
          termination_reason
        FROM tmp_changed_old
        UNION ALL
        SELECT
          assignee,
          jurisdiction_label,
          role_category_label,
          region,
          location,
          task_name,
          work_type,
          completed_date,
          termination_reason
        FROM tmp_source_changed
      ) affected
      WHERE completed_date IS NOT NULL
        AND LOWER(termination_reason) = 'completed';

      UPDATE analytics.snapshot_user_completed_facts facts
      SET valid_to_snapshot_id = v_snapshot_id
      WHERE facts.valid_to_snapshot_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM tmp_affected_user_completed_keys keys
          WHERE facts.assignee IS NOT DISTINCT FROM keys.assignee
            AND facts.jurisdiction_label IS NOT DISTINCT FROM keys.jurisdiction_label
            AND facts.role_category_label IS NOT DISTINCT FROM keys.role_category_label
            AND facts.region IS NOT DISTINCT FROM keys.region
            AND facts.location IS NOT DISTINCT FROM keys.location
            AND facts.task_name IS NOT DISTINCT FROM keys.task_name
            AND facts.work_type IS NOT DISTINCT FROM keys.work_type
            AND facts.completed_date IS NOT DISTINCT FROM keys.completed_date
        );

      INSERT INTO analytics.snapshot_user_completed_facts (
        valid_from_snapshot_id,
        valid_to_snapshot_id,
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
        NULL::bigint,
        current_rows.assignee,
        current_rows.jurisdiction_label,
        current_rows.role_category_label,
        current_rows.region,
        current_rows.location,
        current_rows.task_name,
        current_rows.work_type,
        current_rows.completed_date::date AS completed_date,
        COUNT(*)::int AS tasks,
        SUM(CASE WHEN current_rows.is_within_sla = 'Yes' THEN 1 ELSE 0 END)::int AS within_due,
        SUM(CASE WHEN current_rows.is_within_sla = 'No' THEN 1 ELSE 0 END)::int AS beyond_due,
        SUM(EXTRACT(EPOCH FROM current_rows.handling_time) / EXTRACT(EPOCH FROM INTERVAL '1 day'))::numeric AS handling_time_sum,
        COUNT(current_rows.handling_time)::int AS handling_time_count,
        SUM(
          CASE
            WHEN current_rows.due_date IS NOT NULL AND current_rows.completed_date IS NOT NULL THEN current_rows.completed_date::date - current_rows.due_date::date
            ELSE 0
          END
        )::numeric AS days_beyond_sum,
        SUM(CASE WHEN current_rows.due_date IS NOT NULL AND current_rows.completed_date IS NOT NULL THEN 1 ELSE 0 END)::int AS days_beyond_count
      FROM analytics.snapshot_task_rows current_rows
      INNER JOIN tmp_affected_user_completed_keys keys
        ON current_rows.assignee IS NOT DISTINCT FROM keys.assignee
       AND current_rows.jurisdiction_label IS NOT DISTINCT FROM keys.jurisdiction_label
       AND current_rows.role_category_label IS NOT DISTINCT FROM keys.role_category_label
       AND current_rows.region IS NOT DISTINCT FROM keys.region
       AND current_rows.location IS NOT DISTINCT FROM keys.location
       AND current_rows.task_name IS NOT DISTINCT FROM keys.task_name
       AND current_rows.work_type IS NOT DISTINCT FROM keys.work_type
       AND current_rows.completed_date::date IS NOT DISTINCT FROM keys.completed_date
      WHERE current_rows.valid_to_snapshot_id IS NULL
        AND current_rows.completed_date IS NOT NULL
        AND LOWER(current_rows.termination_reason) = 'completed'
      GROUP BY
        current_rows.assignee,
        current_rows.jurisdiction_label,
        current_rows.role_category_label,
        current_rows.region,
        current_rows.location,
        current_rows.task_name,
        current_rows.work_type,
        current_rows.completed_date::date;

      CREATE TEMP TABLE tmp_affected_task_daily_keys
      ON COMMIT DROP
      AS
      WITH changed_union AS (
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
          completed_date
        FROM tmp_changed_old
        UNION ALL
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
          completed_date
        FROM tmp_source_changed
      )
      SELECT DISTINCT
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
        END AS sla_flag
      FROM changed_union
      WHERE due_date IS NOT NULL
        AND (
          state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED')
          OR LOWER(termination_reason) = 'completed'
        )

      UNION

      SELECT DISTINCT
        'created'::text AS date_role,
        created_date AS reference_date,
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
        NULL::boolean AS sla_flag
      FROM changed_union
      WHERE created_date IS NOT NULL

      UNION

      SELECT DISTINCT
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
        END AS sla_flag
      FROM changed_union
      WHERE completed_date IS NOT NULL
        AND LOWER(termination_reason) = 'completed'

      UNION

      SELECT DISTINCT
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
        NULL::boolean AS sla_flag
      FROM changed_union
      WHERE completed_date IS NOT NULL
        AND termination_reason = 'cancelled'
        AND state IN ('CANCELLED', 'TERMINATED');

      UPDATE analytics.snapshot_task_daily_facts facts
      SET valid_to_snapshot_id = v_snapshot_id
      WHERE facts.valid_to_snapshot_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM tmp_affected_task_daily_keys keys
          WHERE facts.date_role = keys.date_role
            AND facts.reference_date IS NOT DISTINCT FROM keys.reference_date
            AND facts.jurisdiction_label IS NOT DISTINCT FROM keys.jurisdiction_label
            AND facts.role_category_label IS NOT DISTINCT FROM keys.role_category_label
            AND facts.region IS NOT DISTINCT FROM keys.region
            AND facts.location IS NOT DISTINCT FROM keys.location
            AND facts.task_name IS NOT DISTINCT FROM keys.task_name
            AND facts.work_type IS NOT DISTINCT FROM keys.work_type
            AND facts.priority IS NOT DISTINCT FROM keys.priority
            AND facts.task_status IS NOT DISTINCT FROM keys.task_status
            AND facts.assignment_state IS NOT DISTINCT FROM keys.assignment_state
            AND facts.sla_flag IS NOT DISTINCT FROM keys.sla_flag
        );

      INSERT INTO analytics.snapshot_task_daily_facts (
        valid_from_snapshot_id,
        valid_to_snapshot_id,
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
        FROM analytics.snapshot_task_rows
        WHERE valid_to_snapshot_id IS NULL
      )
      SELECT
        v_snapshot_id,
        NULL::bigint,
        'due'::text AS date_role,
        base.due_date AS reference_date,
        base.jurisdiction_label,
        base.role_category_label,
        base.region,
        base.location,
        base.task_name,
        base.work_type,
        base.priority,
        CASE
          WHEN LOWER(base.termination_reason) = 'completed' THEN 'completed'
          WHEN base.state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'open'
          ELSE 'other'
        END AS task_status,
        CASE
          WHEN base.state = 'ASSIGNED' THEN 'Assigned'
          WHEN base.state IN ('UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'Unassigned'
          ELSE NULL
        END AS assignment_state,
        CASE
          WHEN base.within_sla IS TRUE THEN TRUE
          WHEN base.within_sla IS FALSE THEN FALSE
          ELSE NULL
        END AS sla_flag,
        0::numeric AS handling_time_days_sum,
        0::bigint AS handling_time_days_count,
        0::numeric AS processing_time_days_sum,
        0::bigint AS processing_time_days_count,
        COUNT(*)::bigint AS task_count
      FROM base
      INNER JOIN tmp_affected_task_daily_keys keys
        ON keys.date_role = 'due'
       AND keys.reference_date IS NOT DISTINCT FROM base.due_date
       AND keys.jurisdiction_label IS NOT DISTINCT FROM base.jurisdiction_label
       AND keys.role_category_label IS NOT DISTINCT FROM base.role_category_label
       AND keys.region IS NOT DISTINCT FROM base.region
       AND keys.location IS NOT DISTINCT FROM base.location
       AND keys.task_name IS NOT DISTINCT FROM base.task_name
       AND keys.work_type IS NOT DISTINCT FROM base.work_type
       AND keys.priority IS NOT DISTINCT FROM base.priority
       AND keys.task_status IS NOT DISTINCT FROM CASE
            WHEN LOWER(base.termination_reason) = 'completed' THEN 'completed'
            WHEN base.state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'open'
            ELSE 'other'
          END
       AND keys.assignment_state IS NOT DISTINCT FROM CASE
            WHEN base.state = 'ASSIGNED' THEN 'Assigned'
            WHEN base.state IN ('UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'Unassigned'
            ELSE NULL
          END
       AND keys.sla_flag IS NOT DISTINCT FROM CASE
            WHEN base.within_sla IS TRUE THEN TRUE
            WHEN base.within_sla IS FALSE THEN FALSE
            ELSE NULL
          END
      WHERE base.due_date IS NOT NULL
        AND (
          base.state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED')
          OR LOWER(base.termination_reason) = 'completed'
        )
      GROUP BY
        base.due_date,
        base.jurisdiction_label,
        base.role_category_label,
        base.region,
        base.location,
        base.task_name,
        base.work_type,
        base.priority,
        CASE
          WHEN LOWER(base.termination_reason) = 'completed' THEN 'completed'
          WHEN base.state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'open'
          ELSE 'other'
        END,
        CASE
          WHEN base.state = 'ASSIGNED' THEN 'Assigned'
          WHEN base.state IN ('UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'Unassigned'
          ELSE NULL
        END,
        CASE
          WHEN base.within_sla IS TRUE THEN TRUE
          WHEN base.within_sla IS FALSE THEN FALSE
          ELSE NULL
        END

      UNION ALL

      SELECT
        v_snapshot_id,
        NULL::bigint,
        'created'::text AS date_role,
        base.created_date AS reference_date,
        base.jurisdiction_label,
        base.role_category_label,
        base.region,
        base.location,
        base.task_name,
        base.work_type,
        base.priority,
        CASE
          WHEN LOWER(base.termination_reason) = 'completed' THEN 'completed'
          WHEN base.state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'open'
          ELSE 'other'
        END AS task_status,
        CASE
          WHEN base.state = 'ASSIGNED' THEN 'Assigned'
          WHEN base.state IN ('UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'Unassigned'
          ELSE NULL
        END AS assignment_state,
        NULL::boolean AS sla_flag,
        0::numeric AS handling_time_days_sum,
        0::bigint AS handling_time_days_count,
        0::numeric AS processing_time_days_sum,
        0::bigint AS processing_time_days_count,
        COUNT(*)::bigint AS task_count
      FROM base
      INNER JOIN tmp_affected_task_daily_keys keys
        ON keys.date_role = 'created'
       AND keys.reference_date IS NOT DISTINCT FROM base.created_date
       AND keys.jurisdiction_label IS NOT DISTINCT FROM base.jurisdiction_label
       AND keys.role_category_label IS NOT DISTINCT FROM base.role_category_label
       AND keys.region IS NOT DISTINCT FROM base.region
       AND keys.location IS NOT DISTINCT FROM base.location
       AND keys.task_name IS NOT DISTINCT FROM base.task_name
       AND keys.work_type IS NOT DISTINCT FROM base.work_type
       AND keys.priority IS NOT DISTINCT FROM base.priority
       AND keys.task_status IS NOT DISTINCT FROM CASE
            WHEN LOWER(base.termination_reason) = 'completed' THEN 'completed'
            WHEN base.state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'open'
            ELSE 'other'
          END
       AND keys.assignment_state IS NOT DISTINCT FROM CASE
            WHEN base.state = 'ASSIGNED' THEN 'Assigned'
            WHEN base.state IN ('UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'Unassigned'
            ELSE NULL
          END
       AND keys.sla_flag IS NOT DISTINCT FROM NULL::boolean
      WHERE base.created_date IS NOT NULL
      GROUP BY
        base.created_date,
        base.jurisdiction_label,
        base.role_category_label,
        base.region,
        base.location,
        base.task_name,
        base.work_type,
        base.priority,
        CASE
          WHEN LOWER(base.termination_reason) = 'completed' THEN 'completed'
          WHEN base.state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'open'
          ELSE 'other'
        END,
        CASE
          WHEN base.state = 'ASSIGNED' THEN 'Assigned'
          WHEN base.state IN ('UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'Unassigned'
          ELSE NULL
        END

      UNION ALL

      SELECT
        v_snapshot_id,
        NULL::bigint,
        'completed'::text AS date_role,
        base.completed_date AS reference_date,
        base.jurisdiction_label,
        base.role_category_label,
        base.region,
        base.location,
        base.task_name,
        base.work_type,
        base.priority,
        'completed'::text AS task_status,
        NULL::text AS assignment_state,
        CASE
          WHEN base.within_sla IS TRUE THEN TRUE
          WHEN base.within_sla IS FALSE THEN FALSE
          ELSE NULL
        END AS sla_flag,
        COALESCE(SUM(EXTRACT(EPOCH FROM base.handling_time) / EXTRACT(EPOCH FROM INTERVAL '1 day')), 0)::numeric AS handling_time_days_sum,
        COUNT(base.handling_time)::bigint AS handling_time_days_count,
        COALESCE(SUM(EXTRACT(EPOCH FROM base.processing_time) / EXTRACT(EPOCH FROM INTERVAL '1 day')), 0)::numeric AS processing_time_days_sum,
        COUNT(base.processing_time)::bigint AS processing_time_days_count,
        COUNT(*)::bigint AS task_count
      FROM base
      INNER JOIN tmp_affected_task_daily_keys keys
        ON keys.date_role = 'completed'
       AND keys.reference_date IS NOT DISTINCT FROM base.completed_date
       AND keys.jurisdiction_label IS NOT DISTINCT FROM base.jurisdiction_label
       AND keys.role_category_label IS NOT DISTINCT FROM base.role_category_label
       AND keys.region IS NOT DISTINCT FROM base.region
       AND keys.location IS NOT DISTINCT FROM base.location
       AND keys.task_name IS NOT DISTINCT FROM base.task_name
       AND keys.work_type IS NOT DISTINCT FROM base.work_type
       AND keys.priority IS NOT DISTINCT FROM base.priority
       AND keys.task_status IS NOT DISTINCT FROM 'completed'
       AND keys.assignment_state IS NOT DISTINCT FROM NULL::text
       AND keys.sla_flag IS NOT DISTINCT FROM CASE
            WHEN base.within_sla IS TRUE THEN TRUE
            WHEN base.within_sla IS FALSE THEN FALSE
            ELSE NULL
          END
      WHERE base.completed_date IS NOT NULL
        AND LOWER(base.termination_reason) = 'completed'
      GROUP BY
        base.completed_date,
        base.jurisdiction_label,
        base.role_category_label,
        base.region,
        base.location,
        base.task_name,
        base.work_type,
        base.priority,
        CASE
          WHEN base.within_sla IS TRUE THEN TRUE
          WHEN base.within_sla IS FALSE THEN FALSE
          ELSE NULL
        END

      UNION ALL

      SELECT
        v_snapshot_id,
        NULL::bigint,
        'cancelled'::text AS date_role,
        base.completed_date AS reference_date,
        base.jurisdiction_label,
        base.role_category_label,
        base.region,
        base.location,
        base.task_name,
        base.work_type,
        base.priority,
        'cancelled'::text AS task_status,
        NULL::text AS assignment_state,
        NULL::boolean AS sla_flag,
        0::numeric AS handling_time_days_sum,
        0::bigint AS handling_time_days_count,
        0::numeric AS processing_time_days_sum,
        0::bigint AS processing_time_days_count,
        COUNT(*)::bigint AS task_count
      FROM base
      INNER JOIN tmp_affected_task_daily_keys keys
        ON keys.date_role = 'cancelled'
       AND keys.reference_date IS NOT DISTINCT FROM base.completed_date
       AND keys.jurisdiction_label IS NOT DISTINCT FROM base.jurisdiction_label
       AND keys.role_category_label IS NOT DISTINCT FROM base.role_category_label
       AND keys.region IS NOT DISTINCT FROM base.region
       AND keys.location IS NOT DISTINCT FROM base.location
       AND keys.task_name IS NOT DISTINCT FROM base.task_name
       AND keys.work_type IS NOT DISTINCT FROM base.work_type
       AND keys.priority IS NOT DISTINCT FROM base.priority
       AND keys.task_status IS NOT DISTINCT FROM 'cancelled'
       AND keys.assignment_state IS NOT DISTINCT FROM NULL::text
       AND keys.sla_flag IS NOT DISTINCT FROM NULL::boolean
      WHERE base.completed_date IS NOT NULL
        AND base.termination_reason = 'cancelled'
        AND base.state IN ('CANCELLED', 'TERMINATED')
      GROUP BY
        base.completed_date,
        base.jurisdiction_label,
        base.role_category_label,
        base.region,
        base.location,
        base.task_name,
        base.work_type,
        base.priority;

      CREATE TEMP TABLE tmp_affected_wait_time_keys
      ON COMMIT DROP
      AS
      SELECT DISTINCT
        jurisdiction_label,
        role_category_label,
        region,
        location,
        task_name,
        work_type,
        first_assigned_date AS reference_date
      FROM (
        SELECT
          jurisdiction_label,
          role_category_label,
          region,
          location,
          task_name,
          work_type,
          first_assigned_date,
          wait_time
        FROM tmp_changed_old
        UNION ALL
        SELECT
          jurisdiction_label,
          role_category_label,
          region,
          location,
          task_name,
          work_type,
          first_assigned_date,
          wait_time
        FROM tmp_source_changed
      ) affected
      WHERE wait_time IS NOT NULL;

      UPDATE analytics.snapshot_wait_time_by_assigned_date facts
      SET valid_to_snapshot_id = v_snapshot_id
      WHERE facts.valid_to_snapshot_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM tmp_affected_wait_time_keys keys
          WHERE facts.jurisdiction_label IS NOT DISTINCT FROM keys.jurisdiction_label
            AND facts.role_category_label IS NOT DISTINCT FROM keys.role_category_label
            AND facts.region IS NOT DISTINCT FROM keys.region
            AND facts.location IS NOT DISTINCT FROM keys.location
            AND facts.task_name IS NOT DISTINCT FROM keys.task_name
            AND facts.work_type IS NOT DISTINCT FROM keys.work_type
            AND facts.reference_date IS NOT DISTINCT FROM keys.reference_date
        );

      INSERT INTO analytics.snapshot_wait_time_by_assigned_date (
        valid_from_snapshot_id,
        valid_to_snapshot_id,
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
        NULL::bigint,
        current_rows.jurisdiction_label,
        current_rows.role_category_label,
        current_rows.region,
        current_rows.location,
        current_rows.task_name,
        current_rows.work_type,
        current_rows.first_assigned_date AS reference_date,
        SUM(current_rows.wait_time) AS total_wait_time,
        COUNT(*)::bigint AS assigned_task_count
      FROM analytics.snapshot_task_rows current_rows
      INNER JOIN tmp_affected_wait_time_keys keys
        ON current_rows.jurisdiction_label IS NOT DISTINCT FROM keys.jurisdiction_label
       AND current_rows.role_category_label IS NOT DISTINCT FROM keys.role_category_label
       AND current_rows.region IS NOT DISTINCT FROM keys.region
       AND current_rows.location IS NOT DISTINCT FROM keys.location
       AND current_rows.task_name IS NOT DISTINCT FROM keys.task_name
       AND current_rows.work_type IS NOT DISTINCT FROM keys.work_type
       AND current_rows.first_assigned_date IS NOT DISTINCT FROM keys.reference_date
      WHERE current_rows.valid_to_snapshot_id IS NULL
        AND current_rows.wait_time IS NOT NULL
      GROUP BY
        current_rows.jurisdiction_label,
        current_rows.role_category_label,
        current_rows.region,
        current_rows.location,
        current_rows.task_name,
        current_rows.work_type,
        current_rows.first_assigned_date;
    END IF;
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
      in_progress_snapshot_id = NULL,
      last_source_report_refresh_time = v_window_end
  WHERE singleton_id = TRUE;

  BEGIN
    -- Retain only recent snapshot metadata (plus pinned IDs) and drop fully obsolete history rows.
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
    ),
    retained AS (
      SELECT snapshot_id FROM keep_succeeded
      UNION
      SELECT snapshot_id FROM pinned WHERE snapshot_id IS NOT NULL
    )
    SELECT MIN(snapshot_id)
    INTO v_oldest_retained_snapshot_id
    FROM retained;

    IF v_oldest_retained_snapshot_id IS NOT NULL AND v_data_changed THEN
      DELETE FROM analytics.snapshot_task_rows
      WHERE valid_to_snapshot_id IS NOT NULL
        AND valid_to_snapshot_id <= v_oldest_retained_snapshot_id;

      DELETE FROM analytics.snapshot_user_completed_facts
      WHERE valid_to_snapshot_id IS NOT NULL
        AND valid_to_snapshot_id <= v_oldest_retained_snapshot_id;

      DELETE FROM analytics.snapshot_task_daily_facts
      WHERE valid_to_snapshot_id IS NOT NULL
        AND valid_to_snapshot_id <= v_oldest_retained_snapshot_id;

      DELETE FROM analytics.snapshot_wait_time_by_assigned_date
      WHERE valid_to_snapshot_id IS NOT NULL
        AND valid_to_snapshot_id <= v_oldest_retained_snapshot_id;
    END IF;

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

-- pg_cron setup and scheduler registration.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent job replace: remove existing named job then re-register.
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'analytics_snapshot_refresh_batch';

SELECT cron.schedule(
  'analytics_snapshot_refresh_batch',
  '*/30 * * * *',
  $$CALL analytics.run_snapshot_refresh_batch(FALSE)$$
);
