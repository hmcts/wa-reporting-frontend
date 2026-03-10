CREATE SCHEMA IF NOT EXISTS analytics;

-- ============================================================================
-- Multi-snapshot full-rebuild analytics model with immutable snapshot reads.
-- This script is intentionally rerunnable from scratch via explicit drops.
-- ============================================================================

DROP PROCEDURE IF EXISTS analytics.run_snapshot_refresh_batch(BOOLEAN);
DROP PROCEDURE IF EXISTS analytics.run_snapshot_refresh_batch();
DROP PROCEDURE IF EXISTS analytics.refresh_snapshot_filter_facts(BIGINT);
DROP PROCEDURE IF EXISTS analytics.refresh_snapshot_filter_facet_facts(BIGINT);

-- Snapshot tables
DROP TABLE IF EXISTS analytics.snapshot_task_rows CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_filter_facet_facts CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_user_filter_facts CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_completed_filter_facts CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_outstanding_filter_facts CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_overview_filter_facts CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_wait_time_by_assigned_date CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_task_daily_facts CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_user_completed_facts CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_completed_task_rows CASCADE;
DROP TABLE IF EXISTS analytics.snapshot_open_task_rows CASCADE;

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

-- Snapshot data tables (immutable rows keyed by snapshot_id).
CREATE TABLE analytics.snapshot_open_task_rows (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  case_id TEXT,
  task_name TEXT,
  case_type_label TEXT,
  jurisdiction_label TEXT,
  role_category_label TEXT,
  region TEXT,
  location TEXT,
  work_type TEXT,
  state TEXT NOT NULL,
  created_date DATE,
  first_assigned_date DATE,
  due_date DATE,
  major_priority INTEGER,
  assignee TEXT,
  number_of_reassignments INTEGER NOT NULL DEFAULT 0
) PARTITION BY LIST (snapshot_id);

CREATE TABLE analytics.snapshot_completed_task_rows (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  case_id TEXT,
  task_name TEXT,
  jurisdiction_label TEXT,
  role_category_label TEXT,
  region TEXT,
  location TEXT,
  work_type TEXT,
  created_date DATE,
  first_assigned_date DATE,
  due_date DATE,
  completed_date DATE,
  handling_time_days DOUBLE PRECISION,
  is_within_sla TEXT,
  termination_process_label TEXT,
  outcome TEXT,
  major_priority INTEGER,
  assignee TEXT,
  number_of_reassignments INTEGER NOT NULL DEFAULT 0,
  within_due_sort_value SMALLINT
) PARTITION BY LIST (snapshot_id);

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
  handling_time_sum NUMERIC NOT NULL,
  handling_time_count INTEGER NOT NULL,
  days_beyond_sum NUMERIC NOT NULL,
  days_beyond_count INTEGER NOT NULL
) PARTITION BY LIST (snapshot_id);

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
  handling_time_days_sum_squares NUMERIC NOT NULL,
  handling_time_days_count BIGINT NOT NULL,
  processing_time_days_sum NUMERIC NOT NULL,
  processing_time_days_sum_squares NUMERIC NOT NULL,
  processing_time_days_count BIGINT NOT NULL,
  task_count BIGINT NOT NULL
) PARTITION BY LIST (snapshot_id);

CREATE TABLE analytics.snapshot_wait_time_by_assigned_date (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  jurisdiction_label TEXT,
  role_category_label TEXT,
  region TEXT,
  location TEXT,
  task_name TEXT,
  work_type TEXT,
  reference_date DATE,
  total_wait_time_days_sum NUMERIC NOT NULL,
  assigned_task_count BIGINT NOT NULL
) PARTITION BY LIST (snapshot_id);

CREATE TABLE analytics.snapshot_overview_filter_facts (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  jurisdiction_label TEXT,
  role_category_label TEXT,
  region TEXT,
  location TEXT,
  task_name TEXT,
  work_type TEXT,
  row_count BIGINT NOT NULL
) PARTITION BY LIST (snapshot_id);

CREATE TABLE analytics.snapshot_outstanding_filter_facts (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  jurisdiction_label TEXT,
  role_category_label TEXT,
  region TEXT,
  location TEXT,
  task_name TEXT,
  work_type TEXT,
  row_count BIGINT NOT NULL
) PARTITION BY LIST (snapshot_id);

CREATE TABLE analytics.snapshot_completed_filter_facts (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  jurisdiction_label TEXT,
  role_category_label TEXT,
  region TEXT,
  location TEXT,
  task_name TEXT,
  work_type TEXT,
  row_count BIGINT NOT NULL
) PARTITION BY LIST (snapshot_id);

CREATE TABLE analytics.snapshot_user_filter_facts (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.snapshot_batches(snapshot_id) ON DELETE CASCADE,
  jurisdiction_label TEXT,
  role_category_label TEXT,
  region TEXT,
  location TEXT,
  task_name TEXT,
  work_type TEXT,
  assignee TEXT,
  row_count BIGINT NOT NULL
) PARTITION BY LIST (snapshot_id);

CREATE OR REPLACE PROCEDURE analytics.refresh_snapshot_filter_facts(p_snapshot_id BIGINT)
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM analytics.snapshot_overview_filter_facts
  WHERE snapshot_id = p_snapshot_id;

  DELETE FROM analytics.snapshot_outstanding_filter_facts
  WHERE snapshot_id = p_snapshot_id;

  DELETE FROM analytics.snapshot_completed_filter_facts
  WHERE snapshot_id = p_snapshot_id;

  DELETE FROM analytics.snapshot_user_filter_facts
  WHERE snapshot_id = p_snapshot_id;

  INSERT INTO analytics.snapshot_overview_filter_facts (
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    row_count
  )
  SELECT
    p_snapshot_id,
    NULLIF(BTRIM(jurisdiction_label), '') AS jurisdiction_label,
    NULLIF(BTRIM(role_category_label), '') AS role_category_label,
    NULLIF(BTRIM(region), '') AS region,
    NULLIF(BTRIM(location), '') AS location,
    NULLIF(BTRIM(task_name), '') AS task_name,
    NULLIF(BTRIM(work_type), '') AS work_type,
    SUM(task_count)::BIGINT AS row_count
  FROM analytics.snapshot_task_daily_facts
  WHERE snapshot_id = p_snapshot_id
    AND (
      (date_role = 'due' AND task_status = 'open')
      OR date_role IN ('created', 'completed', 'cancelled')
    )
  GROUP BY
    NULLIF(BTRIM(jurisdiction_label), ''),
    NULLIF(BTRIM(role_category_label), ''),
    NULLIF(BTRIM(region), ''),
    NULLIF(BTRIM(location), ''),
    NULLIF(BTRIM(task_name), ''),
    NULLIF(BTRIM(work_type), '');

  INSERT INTO analytics.snapshot_outstanding_filter_facts (
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    row_count
  )
  SELECT
    p_snapshot_id,
    NULLIF(BTRIM(jurisdiction_label), '') AS jurisdiction_label,
    NULLIF(BTRIM(role_category_label), '') AS role_category_label,
    NULLIF(BTRIM(region), '') AS region,
    NULLIF(BTRIM(location), '') AS location,
    NULLIF(BTRIM(task_name), '') AS task_name,
    NULLIF(BTRIM(work_type), '') AS work_type,
    COUNT(*)::BIGINT AS row_count
  FROM analytics.snapshot_open_task_rows
  WHERE snapshot_id = p_snapshot_id
  GROUP BY
    NULLIF(BTRIM(jurisdiction_label), ''),
    NULLIF(BTRIM(role_category_label), ''),
    NULLIF(BTRIM(region), ''),
    NULLIF(BTRIM(location), ''),
    NULLIF(BTRIM(task_name), ''),
    NULLIF(BTRIM(work_type), '');

  INSERT INTO analytics.snapshot_completed_filter_facts (
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    row_count
  )
  SELECT
    p_snapshot_id,
    NULLIF(BTRIM(jurisdiction_label), '') AS jurisdiction_label,
    NULLIF(BTRIM(role_category_label), '') AS role_category_label,
    NULLIF(BTRIM(region), '') AS region,
    NULLIF(BTRIM(location), '') AS location,
    NULLIF(BTRIM(task_name), '') AS task_name,
    NULLIF(BTRIM(work_type), '') AS work_type,
    COUNT(*)::BIGINT AS row_count
  FROM analytics.snapshot_completed_task_rows
  WHERE snapshot_id = p_snapshot_id
  GROUP BY
    NULLIF(BTRIM(jurisdiction_label), ''),
    NULLIF(BTRIM(role_category_label), ''),
    NULLIF(BTRIM(region), ''),
    NULLIF(BTRIM(location), ''),
    NULLIF(BTRIM(task_name), ''),
    NULLIF(BTRIM(work_type), '');

  INSERT INTO analytics.snapshot_user_filter_facts (
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    assignee,
    row_count
  )
  SELECT
    p_snapshot_id,
    NULLIF(BTRIM(jurisdiction_label), '') AS jurisdiction_label,
    NULLIF(BTRIM(role_category_label), '') AS role_category_label,
    NULLIF(BTRIM(region), '') AS region,
    NULLIF(BTRIM(location), '') AS location,
    NULLIF(BTRIM(task_name), '') AS task_name,
    NULLIF(BTRIM(work_type), '') AS work_type,
    NULLIF(BTRIM(assignee), '') AS assignee,
    COUNT(*)::BIGINT AS row_count
  FROM (
    SELECT
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      assignee
    FROM analytics.snapshot_open_task_rows
    WHERE snapshot_id = p_snapshot_id
      AND state = 'ASSIGNED'
      AND (role_category_label IS NULL OR UPPER(role_category_label) <> 'JUDICIAL')

    UNION ALL

    SELECT
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      assignee
    FROM analytics.snapshot_completed_task_rows
    WHERE snapshot_id = p_snapshot_id
      AND (role_category_label IS NULL OR UPPER(role_category_label) <> 'JUDICIAL')
  ) user_scope
  GROUP BY
    NULLIF(BTRIM(jurisdiction_label), ''),
    NULLIF(BTRIM(role_category_label), ''),
    NULLIF(BTRIM(region), ''),
    NULLIF(BTRIM(location), ''),
    NULLIF(BTRIM(task_name), ''),
    NULLIF(BTRIM(work_type), ''),
    NULLIF(BTRIM(assignee), '');
END;
$$;

-- Snapshot producer and publisher.
CREATE OR REPLACE PROCEDURE analytics.run_snapshot_refresh_batch()
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot_id BIGINT;
  v_lock_key BIGINT := hashtext('analytics_run_snapshot_refresh_batch_lock');
  v_batch_failed BOOLEAN := FALSE;
  v_batch_error_message TEXT;
  v_open_rows_partition_name TEXT;
  v_completed_rows_partition_name TEXT;
  v_user_completed_facts_partition_name TEXT;
  v_task_daily_partition_name TEXT;
  v_wait_time_partition_name TEXT;
  v_overview_filter_partition_name TEXT;
  v_outstanding_filter_partition_name TEXT;
  v_completed_filter_partition_name TEXT;
  v_user_filter_partition_name TEXT;
  v_partition_name TEXT;
  v_drop_snapshot_id BIGINT;
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

    CREATE TEMP TABLE tmp_snapshot_source
    ON COMMIT DROP
    AS
    SELECT
      source.task_id,
      source.task_name,
      source.jurisdiction_label,
      source.case_type_label,
      source.role_category_label,
      source.case_id,
      source.region,
      source.location,
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
    FROM cft_task_db.reportable_task source;

    v_open_rows_partition_name := format('snapshot_open_task_rows_p_%s', v_snapshot_id);
    v_completed_rows_partition_name := format('snapshot_completed_task_rows_p_%s', v_snapshot_id);
    v_user_completed_facts_partition_name := format('snapshot_user_completed_facts_p_%s', v_snapshot_id);
    v_task_daily_partition_name := format('snapshot_task_daily_facts_p_%s', v_snapshot_id);
    v_wait_time_partition_name := format('snapshot_wait_time_by_assigned_date_p_%s', v_snapshot_id);
    v_overview_filter_partition_name := format('snapshot_overview_filter_facts_p_%s', v_snapshot_id);
    v_outstanding_filter_partition_name := format('snapshot_outstanding_filter_facts_p_%s', v_snapshot_id);
    v_completed_filter_partition_name := format('snapshot_completed_filter_facts_p_%s', v_snapshot_id);
    v_user_filter_partition_name := format('snapshot_user_filter_facts_p_%s', v_snapshot_id);

    EXECUTE format(
      'CREATE TABLE analytics.%I PARTITION OF analytics.snapshot_open_task_rows FOR VALUES IN (%s)',
      v_open_rows_partition_name,
      v_snapshot_id
    );

    EXECUTE format(
      'CREATE TABLE analytics.%I PARTITION OF analytics.snapshot_completed_task_rows FOR VALUES IN (%s)',
      v_completed_rows_partition_name,
      v_snapshot_id
    );

    EXECUTE format(
      'CREATE TABLE analytics.%I PARTITION OF analytics.snapshot_user_completed_facts FOR VALUES IN (%s)',
      v_user_completed_facts_partition_name,
      v_snapshot_id
    );

    EXECUTE format(
      'CREATE TABLE analytics.%I PARTITION OF analytics.snapshot_task_daily_facts FOR VALUES IN (%s)',
      v_task_daily_partition_name,
      v_snapshot_id
    );

    EXECUTE format(
      'CREATE TABLE analytics.%I PARTITION OF analytics.snapshot_wait_time_by_assigned_date FOR VALUES IN (%s)',
      v_wait_time_partition_name,
      v_snapshot_id
    );

    EXECUTE format(
      'CREATE TABLE analytics.%I PARTITION OF analytics.snapshot_overview_filter_facts FOR VALUES IN (%s)',
      v_overview_filter_partition_name,
      v_snapshot_id
    );

    EXECUTE format(
      'CREATE TABLE analytics.%I PARTITION OF analytics.snapshot_outstanding_filter_facts FOR VALUES IN (%s)',
      v_outstanding_filter_partition_name,
      v_snapshot_id
    );

    EXECUTE format(
      'CREATE TABLE analytics.%I PARTITION OF analytics.snapshot_completed_filter_facts FOR VALUES IN (%s)',
      v_completed_filter_partition_name,
      v_snapshot_id
    );

    EXECUTE format(
      'CREATE TABLE analytics.%I PARTITION OF analytics.snapshot_user_filter_facts FOR VALUES IN (%s)',
      v_user_filter_partition_name,
      v_snapshot_id
    );

    EXECUTE format(
      $open_rows_insert$
      INSERT INTO analytics.%I (
        snapshot_id,
        task_id,
        case_id,
        task_name,
        case_type_label,
        jurisdiction_label,
        role_category_label,
        region,
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
      v_open_rows_partition_name
    )
    USING v_snapshot_id;

    EXECUTE format(
      $completed_rows_insert$
      INSERT INTO analytics.%I (
        snapshot_id,
        task_id,
        case_id,
        task_name,
        jurisdiction_label,
        role_category_label,
        region,
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
      v_completed_rows_partition_name
    )
    USING v_snapshot_id;

    EXECUTE format(
      $user_completed_insert$
      INSERT INTO analytics.%I (
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
      v_user_completed_facts_partition_name
    )
    USING v_snapshot_id;

    SELECT
      current_setting('work_mem'),
      current_setting('hash_mem_multiplier'),
      current_setting('enable_sort')
    INTO
      v_prev_work_mem,
      v_prev_hash_mem_multiplier,
      v_prev_enable_sort;

    -- Bias daily facts aggregation toward in-memory hash aggregate.
    PERFORM set_config('work_mem', '1GB', TRUE);
    PERFORM set_config('hash_mem_multiplier', '4', TRUE);
    PERFORM set_config('enable_sort', 'off', TRUE);

    EXECUTE format(
      $task_daily_insert$
      INSERT INTO analytics.%I (
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
        handling_time_days_sum_squares,
        handling_time_days_count,
        processing_time_days_sum,
        processing_time_days_sum_squares,
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
          termination_reason_lower,
          CASE
            WHEN is_within_sla = 'Yes' THEN TRUE
            WHEN is_within_sla = 'No' THEN FALSE
            ELSE NULL
          END AS within_sla,
          created_date,
          due_date,
          completed_date,
          handling_time_days,
          processing_time_days
        FROM tmp_snapshot_source
      )
      SELECT
        $1,
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
          WHEN termination_reason_lower = 'completed' THEN 'completed'
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
        0::numeric AS handling_time_days_sum_squares,
        0::bigint AS handling_time_days_count,
        0::numeric AS processing_time_days_sum,
        0::numeric AS processing_time_days_sum_squares,
        0::bigint AS processing_time_days_count,
        COUNT(*)::bigint AS task_count
      FROM base
      WHERE due_date IS NOT NULL
        AND (
          state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED')
          OR termination_reason_lower = 'completed'
        )
      GROUP BY
        due_date,
        jurisdiction_label,
        role_category_label,
        region,
        location,
        task_name,
        work_type,
        priority,
        CASE
          WHEN termination_reason_lower = 'completed' THEN 'completed'
          WHEN state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'open'
          ELSE 'other'
        END,
        CASE
          WHEN state = 'ASSIGNED' THEN 'Assigned'
          WHEN state IN ('UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'Unassigned'
          ELSE NULL
        END,
        CASE
          WHEN within_sla IS TRUE THEN TRUE
          WHEN within_sla IS FALSE THEN FALSE
          ELSE NULL
        END

      UNION ALL

      SELECT
        $1,
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
          WHEN termination_reason_lower = 'completed' THEN 'completed'
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
        0::numeric AS handling_time_days_sum_squares,
        0::bigint AS handling_time_days_count,
        0::numeric AS processing_time_days_sum,
        0::numeric AS processing_time_days_sum_squares,
        0::bigint AS processing_time_days_count,
        COUNT(*)::bigint AS task_count
      FROM base
      WHERE created_date IS NOT NULL
      GROUP BY
        created_date,
        jurisdiction_label,
        role_category_label,
        region,
        location,
        task_name,
        work_type,
        priority,
        CASE
          WHEN termination_reason_lower = 'completed' THEN 'completed'
          WHEN state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'open'
          ELSE 'other'
        END,
        CASE
          WHEN state = 'ASSIGNED' THEN 'Assigned'
          WHEN state IN ('UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED') THEN 'Unassigned'
          ELSE NULL
        END

      UNION ALL

      SELECT
        $1,
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
        COUNT(processing_time_days)::bigint AS processing_time_days_count,
        COUNT(*)::bigint AS task_count
      FROM base
      WHERE completed_date IS NOT NULL
        AND termination_reason_lower = 'completed'
      GROUP BY
        completed_date,
        jurisdiction_label,
        role_category_label,
        region,
        location,
        task_name,
        work_type,
        priority,
        CASE
          WHEN within_sla IS TRUE THEN TRUE
          WHEN within_sla IS FALSE THEN FALSE
          ELSE NULL
        END

      UNION ALL

      SELECT
        $1,
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
        0::numeric AS handling_time_days_sum_squares,
        0::bigint AS handling_time_days_count,
        0::numeric AS processing_time_days_sum,
        0::numeric AS processing_time_days_sum_squares,
        0::bigint AS processing_time_days_count,
        COUNT(*)::bigint AS task_count
      FROM base
      WHERE completed_date IS NOT NULL
        AND termination_reason_lower = 'cancelled'
        AND state IN ('CANCELLED', 'TERMINATED')
      GROUP BY
        completed_date,
        jurisdiction_label,
        role_category_label,
        region,
        location,
        task_name,
        work_type,
        priority
      $task_daily_insert$,
      v_task_daily_partition_name
    )
    USING v_snapshot_id;

    -- Restore baseline refresh-session settings for subsequent statements.
    PERFORM set_config('enable_sort', v_prev_enable_sort, TRUE);
    PERFORM set_config('work_mem', v_prev_work_mem, TRUE);
    PERFORM set_config('hash_mem_multiplier', v_prev_hash_mem_multiplier, TRUE);

    EXECUTE format(
      $wait_time_insert$
      INSERT INTO analytics.%I (
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
      v_wait_time_partition_name
    )
    USING v_snapshot_id;

    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
      format('ix_sotr_p_%s_slicers', v_snapshot_id),
      v_open_rows_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(state, created_date DESC)',
      format('ix_sotr_p_%s_state_created', v_snapshot_id),
      v_open_rows_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(state, assignee, created_date DESC) WHERE assignee IS NOT NULL',
      format('ix_sotr_p_%s_state_assignee_created', v_snapshot_id),
      v_open_rows_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(due_date)',
      format('ix_sotr_p_%s_due_date', v_snapshot_id),
      v_open_rows_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(case_id)',
      format('ix_sotr_p_%s_case_id', v_snapshot_id),
      v_open_rows_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
      format('ix_sotr_p_%s_upper_role_category', v_snapshot_id),
      v_open_rows_partition_name
    );

    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
      format('ix_sctr_p_%s_slicers', v_snapshot_id),
      v_completed_rows_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(completed_date DESC)',
      format('ix_sctr_p_%s_completed_date', v_snapshot_id),
      v_completed_rows_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(assignee, completed_date DESC) WHERE assignee IS NOT NULL',
      format('ix_sctr_p_%s_assignee_completed', v_snapshot_id),
      v_completed_rows_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(case_id, completed_date DESC)',
      format('ix_sctr_p_%s_case_id_completed', v_snapshot_id),
      v_completed_rows_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(within_due_sort_value, completed_date)',
      format('ix_sctr_p_%s_within_due_sort', v_snapshot_id),
      v_completed_rows_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
      format('ix_sctr_p_%s_upper_role_category', v_snapshot_id),
      v_completed_rows_partition_name
    );

    EXECUTE format(
      'CREATE UNIQUE INDEX %I ON analytics.%I(assignee, jurisdiction_label, role_category_label, region, location, task_name, work_type, completed_date)',
      format('ux_sucf_p_%s_key', v_snapshot_id),
      v_user_completed_facts_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(assignee, completed_date DESC)',
      format('ix_sucf_p_%s_assignee_completed', v_snapshot_id),
      v_user_completed_facts_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(task_name)',
      format('ix_sucf_p_%s_task_name', v_snapshot_id),
      v_user_completed_facts_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
      format('ix_sucf_p_%s_slicers', v_snapshot_id),
      v_user_completed_facts_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(completed_date)',
      format('ix_sucf_p_%s_completed_date', v_snapshot_id),
      v_user_completed_facts_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
      format('ix_sucf_p_%s_upper_role_category', v_snapshot_id),
      v_user_completed_facts_partition_name
    );

    EXECUTE format(
      'CREATE UNIQUE INDEX %I ON analytics.%I(date_role, reference_date, jurisdiction_label, role_category_label, region, location, task_name, work_type, priority, task_status, assignment_state, sla_flag)',
      format('ux_stdf_p_%s_key', v_snapshot_id),
      v_task_daily_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(date_role, task_status, reference_date)',
      format('ix_stdf_p_%s_date_role_status_date', v_snapshot_id),
      v_task_daily_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(reference_date) WHERE date_role = ''due'' AND task_status = ''open''',
      format('ix_stdf_p_%s_due_open_date', v_snapshot_id),
      v_task_daily_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(reference_date, assignment_state) WHERE date_role = ''created'' AND task_status = ''open''',
      format('ix_stdf_p_%s_created_open_date_assignment', v_snapshot_id),
      v_task_daily_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
      format('ix_stdf_p_%s_slicers', v_snapshot_id),
      v_task_daily_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(priority)',
      format('ix_stdf_p_%s_priority', v_snapshot_id),
      v_task_daily_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(assignment_state)',
      format('ix_stdf_p_%s_assignment_state', v_snapshot_id),
      v_task_daily_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(sla_flag)',
      format('ix_stdf_p_%s_sla_flag', v_snapshot_id),
      v_task_daily_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
      format('ix_stdf_p_%s_upper_role_category', v_snapshot_id),
      v_task_daily_partition_name
    );

    EXECUTE format(
      'CREATE UNIQUE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type, reference_date)',
      format('ux_swt_p_%s_key', v_snapshot_id),
      v_wait_time_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
      format('ix_swt_p_%s_slicers', v_snapshot_id),
      v_wait_time_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(reference_date)',
      format('ix_swt_p_%s_reference_date', v_snapshot_id),
      v_wait_time_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
      format('ix_swt_p_%s_upper_role_category', v_snapshot_id),
      v_wait_time_partition_name
    );

    -- Bias facet aggregation toward in-memory hash aggregate.
    v_prev_work_mem := current_setting('work_mem');
    v_prev_hash_mem_multiplier := current_setting('hash_mem_multiplier');
    v_prev_enable_sort := current_setting('enable_sort');

    PERFORM set_config('work_mem', '1GB', TRUE);
    PERFORM set_config('hash_mem_multiplier', '4', TRUE);
    PERFORM set_config('enable_sort', 'off', TRUE);

    CALL analytics.refresh_snapshot_filter_facts(v_snapshot_id);

    -- Restore baseline refresh-session settings for index creation and cleanup.
    PERFORM set_config('enable_sort', v_prev_enable_sort, TRUE);
    PERFORM set_config('work_mem', v_prev_work_mem, TRUE);
    PERFORM set_config('hash_mem_multiplier', v_prev_hash_mem_multiplier, TRUE);

    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
      format('ix_soff_p_%s_slicers', v_snapshot_id),
      v_overview_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(jurisdiction_label)',
      format('ix_soff_p_%s_service', v_snapshot_id),
      v_overview_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(role_category_label)',
      format('ix_soff_p_%s_role_category', v_snapshot_id),
      v_overview_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(region)',
      format('ix_soff_p_%s_region', v_snapshot_id),
      v_overview_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(location)',
      format('ix_soff_p_%s_location', v_snapshot_id),
      v_overview_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(task_name)',
      format('ix_soff_p_%s_task_name', v_snapshot_id),
      v_overview_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(work_type)',
      format('ix_soff_p_%s_work_type', v_snapshot_id),
      v_overview_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
      format('ix_soff_p_%s_upper_role_category', v_snapshot_id),
      v_overview_filter_partition_name
    );

    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
      format('ix_sotff_p_%s_slicers', v_snapshot_id),
      v_outstanding_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(jurisdiction_label)',
      format('ix_sotff_p_%s_service', v_snapshot_id),
      v_outstanding_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(role_category_label)',
      format('ix_sotff_p_%s_role_category', v_snapshot_id),
      v_outstanding_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(region)',
      format('ix_sotff_p_%s_region', v_snapshot_id),
      v_outstanding_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(location)',
      format('ix_sotff_p_%s_location', v_snapshot_id),
      v_outstanding_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(task_name)',
      format('ix_sotff_p_%s_task_name', v_snapshot_id),
      v_outstanding_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(work_type)',
      format('ix_sotff_p_%s_work_type', v_snapshot_id),
      v_outstanding_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
      format('ix_sotff_p_%s_upper_role_category', v_snapshot_id),
      v_outstanding_filter_partition_name
    );

    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
      format('ix_scff_p_%s_slicers', v_snapshot_id),
      v_completed_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(jurisdiction_label)',
      format('ix_scff_p_%s_service', v_snapshot_id),
      v_completed_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(role_category_label)',
      format('ix_scff_p_%s_role_category', v_snapshot_id),
      v_completed_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(region)',
      format('ix_scff_p_%s_region', v_snapshot_id),
      v_completed_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(location)',
      format('ix_scff_p_%s_location', v_snapshot_id),
      v_completed_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(task_name)',
      format('ix_scff_p_%s_task_name', v_snapshot_id),
      v_completed_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(work_type)',
      format('ix_scff_p_%s_work_type', v_snapshot_id),
      v_completed_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
      format('ix_scff_p_%s_upper_role_category', v_snapshot_id),
      v_completed_filter_partition_name
    );

    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type, assignee)',
      format('ix_suff_p_%s_slicers', v_snapshot_id),
      v_user_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(jurisdiction_label)',
      format('ix_suff_p_%s_service', v_snapshot_id),
      v_user_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(role_category_label)',
      format('ix_suff_p_%s_role_category', v_snapshot_id),
      v_user_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(region)',
      format('ix_suff_p_%s_region', v_snapshot_id),
      v_user_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(location)',
      format('ix_suff_p_%s_location', v_snapshot_id),
      v_user_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(task_name)',
      format('ix_suff_p_%s_task_name', v_snapshot_id),
      v_user_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(work_type)',
      format('ix_suff_p_%s_work_type', v_snapshot_id),
      v_user_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(assignee)',
      format('ix_suff_p_%s_assignee', v_snapshot_id),
      v_user_filter_partition_name
    );
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
      format('ix_suff_p_%s_upper_role_category', v_snapshot_id),
      v_user_filter_partition_name
    );

    FOREACH v_partition_name IN ARRAY ARRAY[
      v_open_rows_partition_name,
      v_completed_rows_partition_name,
      v_user_completed_facts_partition_name,
      v_task_daily_partition_name,
      v_wait_time_partition_name,
      v_overview_filter_partition_name,
      v_outstanding_filter_partition_name,
      v_completed_filter_partition_name,
      v_user_filter_partition_name
    ] LOOP
      EXECUTE format('ANALYZE analytics.%I', v_partition_name);
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      v_batch_failed := TRUE;
      v_batch_error_message := SQLERRM;
  END;

  IF v_batch_failed THEN
    FOREACH v_partition_name IN ARRAY ARRAY[
      format('snapshot_open_task_rows_p_%s', v_snapshot_id),
      format('snapshot_completed_task_rows_p_%s', v_snapshot_id),
      format('snapshot_user_completed_facts_p_%s', v_snapshot_id),
      format('snapshot_task_daily_facts_p_%s', v_snapshot_id),
      format('snapshot_wait_time_by_assigned_date_p_%s', v_snapshot_id),
      format('snapshot_overview_filter_facts_p_%s', v_snapshot_id),
      format('snapshot_outstanding_filter_facts_p_%s', v_snapshot_id),
      format('snapshot_completed_filter_facts_p_%s', v_snapshot_id),
      format('snapshot_user_filter_facts_p_%s', v_snapshot_id)
    ] LOOP
      BEGIN
        EXECUTE format('DROP TABLE IF EXISTS analytics.%I', v_partition_name);
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Failed to drop partition % after failed batch %: %',
            v_partition_name,
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
    FOR v_drop_snapshot_id IN
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
      SELECT batches.snapshot_id
      FROM analytics.snapshot_batches batches
      WHERE batches.status = 'succeeded'
        AND batches.snapshot_id NOT IN (SELECT snapshot_id FROM keep_succeeded)
        AND batches.snapshot_id NOT IN (SELECT snapshot_id FROM pinned WHERE snapshot_id IS NOT NULL)
    LOOP
      FOREACH v_partition_name IN ARRAY ARRAY[
        format('snapshot_open_task_rows_p_%s', v_drop_snapshot_id),
        format('snapshot_completed_task_rows_p_%s', v_drop_snapshot_id),
        format('snapshot_user_completed_facts_p_%s', v_drop_snapshot_id),
        format('snapshot_task_daily_facts_p_%s', v_drop_snapshot_id),
        format('snapshot_wait_time_by_assigned_date_p_%s', v_drop_snapshot_id),
        format('snapshot_overview_filter_facts_p_%s', v_drop_snapshot_id),
        format('snapshot_outstanding_filter_facts_p_%s', v_drop_snapshot_id),
        format('snapshot_completed_filter_facts_p_%s', v_drop_snapshot_id),
        format('snapshot_user_filter_facts_p_%s', v_drop_snapshot_id)
      ] LOOP
        EXECUTE format('DROP TABLE IF EXISTS analytics.%I', v_partition_name);
      END LOOP;
      DELETE FROM analytics.snapshot_batches WHERE snapshot_id = v_drop_snapshot_id;
    END LOOP;

    FOR v_drop_snapshot_id IN
      WITH keep_failed AS (
        SELECT snapshot_id
        FROM analytics.snapshot_batches
        WHERE status = 'failed'
        ORDER BY snapshot_id DESC
        LIMIT 100
      )
      SELECT batches.snapshot_id
      FROM analytics.snapshot_batches batches
      WHERE batches.status = 'failed'
        AND batches.snapshot_id NOT IN (SELECT snapshot_id FROM keep_failed)
    LOOP
      FOREACH v_partition_name IN ARRAY ARRAY[
        format('snapshot_open_task_rows_p_%s', v_drop_snapshot_id),
        format('snapshot_completed_task_rows_p_%s', v_drop_snapshot_id),
        format('snapshot_user_completed_facts_p_%s', v_drop_snapshot_id),
        format('snapshot_task_daily_facts_p_%s', v_drop_snapshot_id),
        format('snapshot_wait_time_by_assigned_date_p_%s', v_drop_snapshot_id),
        format('snapshot_overview_filter_facts_p_%s', v_drop_snapshot_id),
        format('snapshot_outstanding_filter_facts_p_%s', v_drop_snapshot_id),
        format('snapshot_completed_filter_facts_p_%s', v_drop_snapshot_id),
        format('snapshot_user_filter_facts_p_%s', v_drop_snapshot_id)
      ] LOOP
        EXECUTE format('DROP TABLE IF EXISTS analytics.%I', v_partition_name);
      END LOOP;
      DELETE FROM analytics.snapshot_batches WHERE snapshot_id = v_drop_snapshot_id;
    END LOOP;
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
