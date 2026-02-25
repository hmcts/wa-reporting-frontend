CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- Multi-snapshot full-rebuild analytics model with immutable snapshot reads.
-- This script is intentionally rerunnable from scratch via explicit drops.
-- ============================================================================

DROP PROCEDURE IF EXISTS analytics.run_snapshot_refresh_batch(BOOLEAN);
DROP PROCEDURE IF EXISTS analytics.run_snapshot_refresh_batch();
DROP PROCEDURE IF EXISTS analytics.refresh_snapshot_filter_option_values(BIGINT);

-- Snapshot tables
DROP TABLE IF EXISTS analytics.snapshot_wait_time_by_assigned_date CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_filter_option_values CASCADE;
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
  -- Single-row control table: tracks current publish pointer.
  singleton_id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_id),
  published_snapshot_id BIGINT REFERENCES analytics.snapshot_batches(snapshot_id),
  published_at TIMESTAMPTZ,
  in_progress_snapshot_id BIGINT REFERENCES analytics.snapshot_batches(snapshot_id)
);

INSERT INTO analytics.snapshot_state (singleton_id) VALUES (TRUE);

-- Snapshot data tables (immutable rows keyed by snapshot_id)
CREATE TABLE analytics.snapshot_task_rows (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  LIKE cft_task_db.reportable_task INCLUDING DEFAULTS,
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

CREATE TABLE analytics.snapshot_filter_option_values (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  option_type TEXT NOT NULL CHECK (
    option_type IN ('service', 'roleCategory', 'region', 'location', 'taskName', 'workType', 'assignee')
  ),
  value TEXT NOT NULL,
  role_category_label TEXT
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

ALTER TABLE analytics.snapshot_filter_option_values
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

CREATE INDEX ix_snapshot_task_rows_snapshot_within_due_sort
  ON analytics.snapshot_task_rows(snapshot_id, within_due_sort_value, completed_date);

CREATE INDEX ix_snapshot_task_rows_snapshot_open_due_date
  ON analytics.snapshot_task_rows(snapshot_id, due_date)
  WHERE state NOT IN ('COMPLETED', 'TERMINATED');

CREATE UNIQUE INDEX ux_snapshot_user_completed_facts_snapshot_key
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

CREATE INDEX ix_snapshot_user_completed_facts_snapshot_assignee_date
  ON analytics.snapshot_user_completed_facts(snapshot_id, assignee, completed_date DESC);

CREATE INDEX ix_snapshot_user_completed_facts_snapshot_assignee_task_name
  ON analytics.snapshot_user_completed_facts(snapshot_id, assignee, task_name);

CREATE INDEX ix_snapshot_user_completed_facts_snapshot_slicers
  ON analytics.snapshot_user_completed_facts(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX ix_snapshot_user_completed_facts_snapshot_completed_date
  ON analytics.snapshot_user_completed_facts(snapshot_id, completed_date);

CREATE INDEX ix_snapshot_user_completed_facts_snapshot_upper_role_category
  ON analytics.snapshot_user_completed_facts(snapshot_id, UPPER(role_category_label));

CREATE UNIQUE INDEX ux_snapshot_task_daily_facts_snapshot_key
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

CREATE INDEX ix_snapshot_task_daily_facts_snapshot_date_role_status_date
  ON analytics.snapshot_task_daily_facts(snapshot_id, date_role, task_status, reference_date);

CREATE INDEX ix_snapshot_task_daily_facts_snapshot_due_open_date
  ON analytics.snapshot_task_daily_facts(snapshot_id, reference_date)
  WHERE date_role = 'due' AND task_status = 'open';

CREATE INDEX ix_snapshot_task_daily_facts_snapshot_created_open_date_assignment
  ON analytics.snapshot_task_daily_facts(snapshot_id, reference_date, assignment_state)
  WHERE date_role = 'created' AND task_status = 'open';

CREATE INDEX ix_snapshot_task_daily_facts_snapshot_slicers
  ON analytics.snapshot_task_daily_facts(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX ix_snapshot_task_daily_facts_snapshot_priority
  ON analytics.snapshot_task_daily_facts(snapshot_id, priority);

CREATE INDEX ix_snapshot_task_daily_facts_snapshot_assignment_state
  ON analytics.snapshot_task_daily_facts(snapshot_id, assignment_state);

CREATE INDEX ix_snapshot_task_daily_facts_snapshot_sla_flag
  ON analytics.snapshot_task_daily_facts(snapshot_id, sla_flag);

CREATE INDEX ix_snapshot_task_daily_facts_snapshot_upper_role_category
  ON analytics.snapshot_task_daily_facts(snapshot_id, UPPER(role_category_label));

CREATE UNIQUE INDEX ux_snapshot_wait_time_by_assigned_date_snapshot_key
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

CREATE INDEX ix_snapshot_wait_time_by_assigned_date_snapshot_slicers
  ON analytics.snapshot_wait_time_by_assigned_date(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX ix_snapshot_wait_time_by_assigned_date_snapshot_reference_date
  ON analytics.snapshot_wait_time_by_assigned_date(snapshot_id, reference_date);

CREATE INDEX ix_snapshot_wait_time_by_assigned_date_snapshot_upper_role_category
  ON analytics.snapshot_wait_time_by_assigned_date(snapshot_id, UPPER(role_category_label));

CREATE UNIQUE INDEX ux_snapshot_filter_option_values_snapshot_option_value_role_category
  ON analytics.snapshot_filter_option_values(
    snapshot_id,
    option_type,
    value,
    COALESCE(role_category_label, '')
  );

CREATE INDEX ix_snapshot_filter_option_values_snapshot_option
  ON analytics.snapshot_filter_option_values(snapshot_id, option_type, value);

CREATE INDEX ix_snapshot_filter_option_values_snapshot_upper_role_category
  ON analytics.snapshot_filter_option_values(snapshot_id, UPPER(role_category_label));

CREATE OR REPLACE PROCEDURE analytics.refresh_snapshot_filter_option_values(p_snapshot_id BIGINT)
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM analytics.snapshot_filter_option_values
  WHERE snapshot_id = p_snapshot_id;

  INSERT INTO analytics.snapshot_filter_option_values (
    snapshot_id,
    option_type,
    value,
    role_category_label
  )
  SELECT
    p_snapshot_id,
    option_rows.option_type,
    option_rows.value,
    option_rows.role_category_label
  FROM (
    SELECT
      'service'::text AS option_type,
      jurisdiction_label AS value,
      NULLIF(BTRIM(role_category_label), '') AS role_category_label
    FROM analytics.snapshot_task_daily_facts
    WHERE snapshot_id = p_snapshot_id
      AND jurisdiction_label IS NOT NULL
    GROUP BY jurisdiction_label, NULLIF(BTRIM(role_category_label), '')

    UNION ALL

    SELECT
      'roleCategory'::text AS option_type,
      NULLIF(BTRIM(role_category_label), '') AS value,
      NULLIF(BTRIM(role_category_label), '') AS role_category_label
    FROM analytics.snapshot_task_daily_facts
    WHERE snapshot_id = p_snapshot_id
      AND NULLIF(BTRIM(role_category_label), '') IS NOT NULL
    GROUP BY NULLIF(BTRIM(role_category_label), '')

    UNION ALL

    SELECT
      'region'::text AS option_type,
      region AS value,
      NULLIF(BTRIM(role_category_label), '') AS role_category_label
    FROM analytics.snapshot_task_daily_facts
    WHERE snapshot_id = p_snapshot_id
      AND region IS NOT NULL
    GROUP BY region, NULLIF(BTRIM(role_category_label), '')

    UNION ALL

    SELECT
      'location'::text AS option_type,
      location AS value,
      NULLIF(BTRIM(role_category_label), '') AS role_category_label
    FROM analytics.snapshot_task_daily_facts
    WHERE snapshot_id = p_snapshot_id
      AND location IS NOT NULL
    GROUP BY location, NULLIF(BTRIM(role_category_label), '')

    UNION ALL

    SELECT
      'taskName'::text AS option_type,
      task_name AS value,
      NULLIF(BTRIM(role_category_label), '') AS role_category_label
    FROM analytics.snapshot_task_daily_facts
    WHERE snapshot_id = p_snapshot_id
      AND task_name IS NOT NULL
    GROUP BY task_name, NULLIF(BTRIM(role_category_label), '')

    UNION ALL

    SELECT
      'workType'::text AS option_type,
      work_type AS value,
      NULLIF(BTRIM(role_category_label), '') AS role_category_label
    FROM analytics.snapshot_task_daily_facts
    WHERE snapshot_id = p_snapshot_id
      AND work_type IS NOT NULL
    GROUP BY work_type, NULLIF(BTRIM(role_category_label), '')

    UNION ALL

    SELECT
      'assignee'::text AS option_type,
      assignee AS value,
      NULLIF(BTRIM(role_category_label), '') AS role_category_label
    FROM analytics.snapshot_task_rows
    WHERE snapshot_id = p_snapshot_id
      AND assignee IS NOT NULL
    GROUP BY assignee, NULLIF(BTRIM(role_category_label), '')
  ) option_rows;
END;
$$;

-- Snapshot producer and publisher
CREATE OR REPLACE PROCEDURE analytics.run_snapshot_refresh_batch()
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot_id BIGINT;
  v_lock_key BIGINT := hashtext('analytics_run_snapshot_refresh_batch_lock');
  v_batch_failed BOOLEAN := FALSE;
  v_batch_error_message TEXT;
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
    IF EXISTS (SELECT 1 FROM cft_task_db.reportable_task LIMIT 1) THEN
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
        source.due_date_to_completed_diff_time,
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
        due_date_to_completed_diff_time,
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
        within_due_sort_value
      )
      SELECT
        v_snapshot_id,
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
        source.due_date_to_completed_diff_time,
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
        source.within_due_sort_value
      FROM tmp_source_full source;

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
      FROM analytics.snapshot_task_rows
      WHERE snapshot_id = v_snapshot_id
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
        FROM analytics.snapshot_task_rows
        WHERE snapshot_id = v_snapshot_id
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
      FROM analytics.snapshot_task_rows
      WHERE snapshot_id = v_snapshot_id
        AND state = 'ASSIGNED'
        AND wait_time IS NOT NULL
      GROUP BY
        jurisdiction_label,
        role_category_label,
        region,
        location,
        task_name,
        work_type,
        first_assigned_date;
    END IF;

    CALL analytics.refresh_snapshot_filter_option_values(v_snapshot_id);
  EXCEPTION
    WHEN OTHERS THEN
      v_batch_failed := TRUE;
      v_batch_error_message := SQLERRM;
  END;

  IF v_batch_failed THEN
    DELETE FROM analytics.snapshot_task_rows WHERE snapshot_id = v_snapshot_id;
    DELETE FROM analytics.snapshot_user_completed_facts WHERE snapshot_id = v_snapshot_id;
    DELETE FROM analytics.snapshot_task_daily_facts WHERE snapshot_id = v_snapshot_id;
    DELETE FROM analytics.snapshot_wait_time_by_assigned_date WHERE snapshot_id = v_snapshot_id;
    DELETE FROM analytics.snapshot_filter_option_values WHERE snapshot_id = v_snapshot_id;

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

-- Snapshot refresh scheduling is registered by application startup when
-- analytics.snapshotRefreshCronBootstrap.enabled=true. Startup registration
-- uses cron.schedule_in_database(...) from the configured cron metadata
-- database (default postgres) targeting this analytics database.
