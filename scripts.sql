CREATE SCHEMA IF NOT EXISTS analytics;

DROP MATERIALIZED VIEW IF EXISTS analytics.mv_reportable_task_thin CASCADE;

CREATE MATERIALIZED VIEW analytics.mv_reportable_task_thin AS
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
FROM cft_task_db.reportable_task;

CREATE UNIQUE INDEX ux_mv_reportable_task_thin_task
  ON analytics.mv_reportable_task_thin(task_id);

CREATE INDEX ix_thin_dates_completed
  ON analytics.mv_reportable_task_thin(completed_date);

CREATE INDEX ix_thin_dates_created
  ON analytics.mv_reportable_task_thin(created_date);

CREATE INDEX ix_thin_dates_due
  ON analytics.mv_reportable_task_thin(due_date);

CREATE INDEX ix_thin_dates_first_assigned
  ON analytics.mv_reportable_task_thin(first_assigned_date);

CREATE INDEX ix_thin_is_within_sla
  ON analytics.mv_reportable_task_thin(is_within_sla);

CREATE INDEX ix_thin_slicers
  ON analytics.mv_reportable_task_thin(jurisdiction_label, role_category_label, region, location, task_name, work_type);

CREATE INDEX ix_thin_state
  ON analytics.mv_reportable_task_thin(state);

CREATE INDEX ix_thin_state_created_desc
  ON analytics.mv_reportable_task_thin(state, created_date DESC);

CREATE INDEX ix_thin_task_name
  ON analytics.mv_reportable_task_thin(task_name);

CREATE INDEX ix_thin_termination_reason
  ON analytics.mv_reportable_task_thin(termination_reason);

CREATE INDEX ix_thin_completed_reason_state_date_desc
  ON analytics.mv_reportable_task_thin(LOWER(termination_reason), completed_date DESC);

CREATE INDEX ix_thin_completed_assignee_date_desc
  ON analytics.mv_reportable_task_thin(assignee, completed_date DESC)
  WHERE LOWER(termination_reason) = 'completed' AND assignee IS NOT NULL;

CREATE INDEX ix_thin_case_id
  ON analytics.mv_reportable_task_thin(case_id);

DROP MATERIALIZED VIEW IF EXISTS analytics.mv_user_completed_facts CASCADE;

CREATE MATERIALIZED VIEW analytics.mv_user_completed_facts AS
SELECT
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
FROM analytics.mv_reportable_task_thin
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

CREATE UNIQUE INDEX ux_mv_user_completed_facts_key
  ON analytics.mv_user_completed_facts(
    assignee,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    completed_date
  );

CREATE INDEX ix_user_completed_assignee_date
  ON analytics.mv_user_completed_facts(assignee, completed_date DESC);

CREATE INDEX ix_user_completed_assignee_task_name
  ON analytics.mv_user_completed_facts(assignee, task_name);

CREATE INDEX ix_user_completed_slicers
  ON analytics.mv_user_completed_facts(jurisdiction_label, role_category_label, region, location, task_name, work_type);

CREATE INDEX ix_user_completed_completed_date
  ON analytics.mv_user_completed_facts(completed_date);

DROP MATERIALIZED VIEW IF EXISTS analytics.mv_task_daily_facts CASCADE;

CREATE MATERIALIZED VIEW analytics.mv_task_daily_facts AS
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
    number_of_reassignments,
    CASE
      WHEN is_within_sla = 'Yes' THEN TRUE
      WHEN is_within_sla = 'No' THEN FALSE
      ELSE NULL
    END AS is_within_sla,
    created_date,
    due_date,
    completed_date,
    handling_time,
    processing_time
  FROM analytics.mv_reportable_task_thin
)

-- DUE DATE role: open + completed
SELECT
  'due'::text AS date_role,
  due_date    AS reference_date,

  jurisdiction_label,
  role_category_label,
  region,
  location,
  task_name,
  work_type,

  priority,

  CASE
    WHEN LOWER(termination_reason) = 'completed' THEN 'completed'
    WHEN state IN ('ASSIGNED','UNASSIGNED','PENDING AUTO ASSIGN','UNCONFIGURED')
      THEN 'open'
    ELSE 'other'
  END AS task_status,

  CASE
    WHEN state = 'ASSIGNED' THEN 'Assigned'
    WHEN state IN ('UNASSIGNED','PENDING AUTO ASSIGN','UNCONFIGURED') THEN 'Unassigned'
    ELSE NULL
  END AS assignment_state,

  CASE
    WHEN is_within_sla IS TRUE THEN TRUE
    WHEN is_within_sla IS FALSE THEN FALSE
    ELSE NULL
  END AS sla_flag,

  0::numeric AS handling_time_days_sum,
  0::bigint AS handling_time_days_count,
  0::numeric AS processing_time_days_sum,
  0::bigint AS processing_time_days_count,

  COUNT(*) AS task_count
FROM base
WHERE due_date IS NOT NULL
  AND (
    state IN ('ASSIGNED','UNASSIGNED','PENDING AUTO ASSIGN','UNCONFIGURED')
    OR LOWER(termination_reason) = 'completed'
  )
GROUP BY
  1,2,3,4,5,6,7,8,9,10,11,12

UNION ALL

-- CREATED DATE role: open only
SELECT
  'created'::text AS date_role,
  created_date    AS reference_date,

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

  COUNT(*) AS task_count
FROM base
WHERE created_date IS NOT NULL
  AND state IN ('ASSIGNED','UNASSIGNED','PENDING AUTO ASSIGN','UNCONFIGURED')
GROUP BY
  1,2,3,4,5,6,7,8,9,10,11

UNION ALL

-- COMPLETED DATE role: completed only
SELECT
  'completed'::text AS date_role,
  completed_date    AS reference_date,

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
    WHEN is_within_sla IS TRUE THEN TRUE
    WHEN is_within_sla IS FALSE THEN FALSE
    ELSE NULL
  END AS sla_flag,

  SUM(EXTRACT(EPOCH FROM handling_time) / EXTRACT(EPOCH FROM INTERVAL '1 day'))::numeric AS handling_time_days_sum,
  COUNT(handling_time)::bigint AS handling_time_days_count,
  SUM(EXTRACT(EPOCH FROM processing_time) / EXTRACT(EPOCH FROM INTERVAL '1 day'))::numeric AS processing_time_days_sum,
  COUNT(processing_time)::bigint AS processing_time_days_count,

  COUNT(*) AS task_count
FROM base
WHERE completed_date IS NOT NULL
  AND LOWER(termination_reason) = 'completed'
GROUP BY
  1,2,3,4,5,6,7,8,9,10,11,12

UNION ALL

-- CANCELLED DATE role: cancelled only
SELECT
  'cancelled'::text AS date_role,
  completed_date    AS reference_date,

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

  COUNT(*) AS task_count
FROM base
WHERE completed_date IS NOT NULL
  AND termination_reason = 'cancelled'
  AND state IN ('CANCELLED','TERMINATED')
GROUP BY
  1,2,3,4,5,6,7,8,9,10,11,12;

CREATE UNIQUE INDEX ux_mv_task_daily_facts_key
  ON analytics.mv_task_daily_facts(
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

-- Recreate indexes for this MV
CREATE INDEX ix_facts_date_role_date
  ON analytics.mv_task_daily_facts(date_role, reference_date);

CREATE INDEX ix_facts_date_role_status_date
  ON analytics.mv_task_daily_facts(date_role, task_status, reference_date);

CREATE INDEX ix_facts_due_open_date
  ON analytics.mv_task_daily_facts(reference_date)
  WHERE date_role = 'due' AND task_status = 'open';

CREATE INDEX ix_facts_due_date_status_cover
  ON analytics.mv_task_daily_facts(reference_date, task_status)
  INCLUDE (task_count)
  WHERE date_role = 'due';

CREATE INDEX ix_facts_created_open_date_assignment_cover
  ON analytics.mv_task_daily_facts(reference_date, assignment_state)
  INCLUDE (task_count)
  WHERE date_role = 'created' AND task_status = 'open';

CREATE INDEX ix_facts_slicers
  ON analytics.mv_task_daily_facts
  (jurisdiction_label, role_category_label, region, location, task_name, work_type);

CREATE INDEX ix_facts_status
  ON analytics.mv_task_daily_facts(task_status);

CREATE INDEX ix_facts_priority
  ON analytics.mv_task_daily_facts(priority);

CREATE INDEX ix_facts_assignment_state
  ON analytics.mv_task_daily_facts(assignment_state);

CREATE INDEX ix_facts_sla_flag
  ON analytics.mv_task_daily_facts(sla_flag);

DROP MATERIALIZED VIEW IF EXISTS analytics.mv_open_tasks_by_name CASCADE;

CREATE MATERIALIZED VIEW analytics.mv_open_tasks_by_name AS
SELECT
  jurisdiction_label,
  role_category_label,
  region,
  location,
  task_name,
  work_type,
  CASE
    WHEN due_date IS NULL THEN 'No due date'
    WHEN major_priority <= 2000 THEN 'Urgent'
    WHEN major_priority < 5000 THEN 'High'
    WHEN major_priority = 5000 AND due_date < CURRENT_DATE THEN 'High'
    WHEN major_priority = 5000 AND due_date = CURRENT_DATE THEN 'Medium'
    ELSE 'Low'
  END AS priority_bucket,
  COUNT(*)::bigint AS task_count
FROM analytics.mv_reportable_task_thin
WHERE state IN ('ASSIGNED','UNASSIGNED','PENDING AUTO ASSIGN','UNCONFIGURED')
GROUP BY
  jurisdiction_label,
  role_category_label,
  region,
  location,
  task_name,
  work_type,
  priority_bucket;

CREATE UNIQUE INDEX ux_mv_open_tasks_by_name_key
  ON analytics.mv_open_tasks_by_name(
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    priority_bucket
  );

CREATE INDEX ix_open_tasks_by_name_slicers
  ON analytics.mv_open_tasks_by_name(jurisdiction_label, role_category_label, region, location, task_name, work_type);

CREATE INDEX ix_open_tasks_by_name_priority
  ON analytics.mv_open_tasks_by_name(priority_bucket);

DROP MATERIALIZED VIEW IF EXISTS analytics.mv_open_tasks_by_region_location CASCADE;

CREATE MATERIALIZED VIEW analytics.mv_open_tasks_by_region_location AS
SELECT
  jurisdiction_label,
  role_category_label,
  region,
  location,
  task_name,
  work_type,
  CASE
    WHEN due_date IS NULL THEN 'No due date'
    WHEN major_priority <= 2000 THEN 'Urgent'
    WHEN major_priority < 5000 THEN 'High'
    WHEN major_priority = 5000 AND due_date < CURRENT_DATE THEN 'High'
    WHEN major_priority = 5000 AND due_date = CURRENT_DATE THEN 'Medium'
    ELSE 'Low'
  END AS priority_bucket,
  COUNT(*)::bigint AS task_count
FROM analytics.mv_reportable_task_thin
WHERE state IN ('ASSIGNED','UNASSIGNED','PENDING AUTO ASSIGN','UNCONFIGURED')
GROUP BY
  jurisdiction_label,
  role_category_label,
  region,
  location,
  task_name,
  work_type,
  priority_bucket;

CREATE UNIQUE INDEX ux_mv_open_tasks_by_region_location_key
  ON analytics.mv_open_tasks_by_region_location(
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    priority_bucket
  );

CREATE INDEX ix_open_tasks_by_region_location_slicers
  ON analytics.mv_open_tasks_by_region_location(jurisdiction_label, role_category_label, region, location, task_name, work_type);

CREATE INDEX ix_open_tasks_by_region_location_priority
  ON analytics.mv_open_tasks_by_region_location(priority_bucket);

DROP MATERIALIZED VIEW IF EXISTS analytics.mv_open_tasks_summary CASCADE;

CREATE MATERIALIZED VIEW analytics.mv_open_tasks_summary AS
SELECT
  jurisdiction_label,
  role_category_label,
  region,
  location,
  task_name,
  work_type,
  state,
  CASE
    WHEN due_date IS NULL THEN 'No due date'
    WHEN major_priority <= 2000 THEN 'Urgent'
    WHEN major_priority < 5000 THEN 'High'
    WHEN major_priority = 5000 AND due_date < CURRENT_DATE THEN 'High'
    WHEN major_priority = 5000 AND due_date = CURRENT_DATE THEN 'Medium'
    ELSE 'Low'
  END AS priority_bucket,
  COUNT(*)::bigint AS task_count
FROM analytics.mv_reportable_task_thin
WHERE state IN ('ASSIGNED','UNASSIGNED','PENDING AUTO ASSIGN','UNCONFIGURED')
GROUP BY
  jurisdiction_label,
  role_category_label,
  region,
  location,
  task_name,
  work_type,
  state,
  priority_bucket;

CREATE UNIQUE INDEX ux_mv_open_tasks_summary_key
  ON analytics.mv_open_tasks_summary(
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    state,
    priority_bucket
  );

CREATE INDEX ix_open_tasks_summary_slicers
  ON analytics.mv_open_tasks_summary(jurisdiction_label, role_category_label, region, location, task_name, work_type);

CREATE INDEX ix_open_tasks_summary_state
  ON analytics.mv_open_tasks_summary(state);

CREATE INDEX ix_open_tasks_summary_priority
  ON analytics.mv_open_tasks_summary(priority_bucket);

DROP MATERIALIZED VIEW IF EXISTS analytics.mv_open_tasks_wait_time_by_assigned_date CASCADE;

CREATE MATERIALIZED VIEW analytics.mv_open_tasks_wait_time_by_assigned_date AS
SELECT
  jurisdiction_label,
  role_category_label,
  region,
  location,
  task_name,
  work_type,
  first_assigned_date AS reference_date,
  SUM(wait_time) AS total_wait_time,
  COUNT(*)::bigint AS assigned_task_count
FROM analytics.mv_reportable_task_thin
WHERE wait_time IS NOT NULL
GROUP BY
  jurisdiction_label,
  role_category_label,
  region,
  location,
  task_name,
  work_type,
  first_assigned_date;

CREATE UNIQUE INDEX ux_mv_open_tasks_wait_time_by_assigned_date_key
  ON analytics.mv_open_tasks_wait_time_by_assigned_date(
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    reference_date
  );

CREATE INDEX ix_open_tasks_wait_time_slicers
  ON analytics.mv_open_tasks_wait_time_by_assigned_date(jurisdiction_label, role_category_label, region, location, task_name, work_type);

CREATE INDEX ix_open_tasks_wait_time_reference_date
  ON analytics.mv_open_tasks_wait_time_by_assigned_date(reference_date);

-- ============================================================================
-- Hard-consistency analytics snapshot orchestration
--
-- Purpose:
-- 1) Refresh source analytics MVs in dependency order.
-- 2) Copy refreshed data into immutable snapshot tables (single snapshot_id).
-- 3) Publish only after a full successful batch.
-- 4) Keep retention bounded and schedule one 30-minute batch job.
-- ============================================================================

-- Section 3: Hard reset snapshot artifacts so reruns always recreate cleanly.
-- This intentionally removes previous snapshot metadata/data before rebuilding.
DROP PROCEDURE IF EXISTS analytics.run_snapshot_refresh_batch();

DROP TABLE IF EXISTS analytics.mv_open_tasks_wait_time_by_assigned_date_snapshots CASCADE;
DROP TABLE IF EXISTS analytics.mv_open_tasks_summary_snapshots CASCADE;
DROP TABLE IF EXISTS analytics.mv_open_tasks_by_region_location_snapshots CASCADE;
DROP TABLE IF EXISTS analytics.mv_open_tasks_by_name_snapshots CASCADE;
DROP TABLE IF EXISTS analytics.mv_task_daily_facts_snapshots CASCADE;
DROP TABLE IF EXISTS analytics.mv_user_completed_facts_snapshots CASCADE;
DROP TABLE IF EXISTS analytics.mv_reportable_task_thin_snapshots CASCADE;

DROP TABLE IF EXISTS analytics.mv_snapshot_state CASCADE;
DROP TABLE IF EXISTS analytics.mv_snapshot_batches CASCADE;
DROP SEQUENCE IF EXISTS analytics.mv_snapshot_id_seq;

-- Section 4: Batch metadata and publish-state tables.
CREATE SEQUENCE analytics.mv_snapshot_id_seq;

CREATE TABLE analytics.mv_snapshot_batches (
  snapshot_id BIGINT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  error_message TEXT
);

CREATE TABLE analytics.mv_snapshot_state (
  singleton_id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_id),
  published_snapshot_id BIGINT REFERENCES analytics.mv_snapshot_batches(snapshot_id),
  published_at TIMESTAMPTZ,
  in_progress_snapshot_id BIGINT REFERENCES analytics.mv_snapshot_batches(snapshot_id)
);

INSERT INTO analytics.mv_snapshot_state (singleton_id) VALUES (TRUE);

-- Section 5: Snapshot storage tables (immutable rows keyed by snapshot_id).
CREATE TABLE analytics.mv_reportable_task_thin_snapshots (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.mv_snapshot_batches(snapshot_id) ON DELETE CASCADE,
  LIKE analytics.mv_reportable_task_thin INCLUDING DEFAULTS
);

CREATE TABLE analytics.mv_user_completed_facts_snapshots (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.mv_snapshot_batches(snapshot_id) ON DELETE CASCADE,
  LIKE analytics.mv_user_completed_facts INCLUDING DEFAULTS
);

CREATE TABLE analytics.mv_task_daily_facts_snapshots (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.mv_snapshot_batches(snapshot_id) ON DELETE CASCADE,
  LIKE analytics.mv_task_daily_facts INCLUDING DEFAULTS
);

CREATE TABLE analytics.mv_open_tasks_by_name_snapshots (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.mv_snapshot_batches(snapshot_id) ON DELETE CASCADE,
  LIKE analytics.mv_open_tasks_by_name INCLUDING DEFAULTS
);

CREATE TABLE analytics.mv_open_tasks_by_region_location_snapshots (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.mv_snapshot_batches(snapshot_id) ON DELETE CASCADE,
  LIKE analytics.mv_open_tasks_by_region_location INCLUDING DEFAULTS
);

CREATE TABLE analytics.mv_open_tasks_summary_snapshots (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.mv_snapshot_batches(snapshot_id) ON DELETE CASCADE,
  LIKE analytics.mv_open_tasks_summary INCLUDING DEFAULTS
);

CREATE TABLE analytics.mv_open_tasks_wait_time_by_assigned_date_snapshots (
  snapshot_id BIGINT NOT NULL REFERENCES analytics.mv_snapshot_batches(snapshot_id) ON DELETE CASCADE,
  LIKE analytics.mv_open_tasks_wait_time_by_assigned_date INCLUDING DEFAULTS
);

-- Section 5b: Autovacuum tuning for high-churn snapshot tables.
-- Full snapshot inserts plus retention deletes every 30 minutes create frequent dead tuples.
ALTER TABLE analytics.mv_reportable_task_thin_snapshots
  SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_analyze_threshold = 1000
  );

ALTER TABLE analytics.mv_user_completed_facts_snapshots
  SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_analyze_threshold = 1000
  );

ALTER TABLE analytics.mv_task_daily_facts_snapshots
  SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_analyze_threshold = 1000
  );

ALTER TABLE analytics.mv_open_tasks_by_name_snapshots
  SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_analyze_threshold = 1000
  );

ALTER TABLE analytics.mv_open_tasks_by_region_location_snapshots
  SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_analyze_threshold = 1000
  );

ALTER TABLE analytics.mv_open_tasks_summary_snapshots
  SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_analyze_threshold = 1000
  );

ALTER TABLE analytics.mv_open_tasks_wait_time_by_assigned_date_snapshots
  SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_analyze_threshold = 1000
  );

-- Section 6: Indexes for snapshot-pinned query performance.

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_reportable_task_thin_snapshots_snapshot_task
  ON analytics.mv_reportable_task_thin_snapshots(snapshot_id, task_id);

CREATE INDEX IF NOT EXISTS ix_mv_reportable_task_thin_snapshots_slicers
  ON analytics.mv_reportable_task_thin_snapshots(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX IF NOT EXISTS ix_mv_reportable_task_thin_snapshots_state_created_desc
  ON analytics.mv_reportable_task_thin_snapshots(snapshot_id, state, created_date DESC);

CREATE INDEX IF NOT EXISTS ix_mv_reportable_task_thin_snapshots_completed_reason_state_date_desc
  ON analytics.mv_reportable_task_thin_snapshots(snapshot_id, LOWER(termination_reason), completed_date DESC);

CREATE INDEX IF NOT EXISTS ix_mv_reportable_task_thin_snapshots_completed_assignee_date_desc
  ON analytics.mv_reportable_task_thin_snapshots(snapshot_id, assignee, completed_date DESC)
  WHERE LOWER(termination_reason) = 'completed' AND assignee IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_mv_reportable_task_thin_snapshots_case_id
  ON analytics.mv_reportable_task_thin_snapshots(snapshot_id, case_id);

CREATE INDEX IF NOT EXISTS ix_mv_reportable_task_thin_snapshots_assignee
  ON analytics.mv_reportable_task_thin_snapshots(snapshot_id, assignee);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_user_completed_facts_snapshots_key
  ON analytics.mv_user_completed_facts_snapshots(
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

CREATE INDEX IF NOT EXISTS ix_mv_user_completed_facts_snapshots_assignee_date
  ON analytics.mv_user_completed_facts_snapshots(snapshot_id, assignee, completed_date DESC);

CREATE INDEX IF NOT EXISTS ix_mv_user_completed_facts_snapshots_assignee_task_name
  ON analytics.mv_user_completed_facts_snapshots(snapshot_id, assignee, task_name);

CREATE INDEX IF NOT EXISTS ix_mv_user_completed_facts_snapshots_slicers
  ON analytics.mv_user_completed_facts_snapshots(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX IF NOT EXISTS ix_mv_user_completed_facts_snapshots_completed_date
  ON analytics.mv_user_completed_facts_snapshots(snapshot_id, completed_date);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_task_daily_facts_snapshots_key
  ON analytics.mv_task_daily_facts_snapshots(
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

CREATE INDEX IF NOT EXISTS ix_mv_task_daily_facts_snapshots_date_role_status_date
  ON analytics.mv_task_daily_facts_snapshots(snapshot_id, date_role, task_status, reference_date);

CREATE INDEX IF NOT EXISTS ix_mv_task_daily_facts_snapshots_due_open_date
  ON analytics.mv_task_daily_facts_snapshots(snapshot_id, reference_date)
  WHERE date_role = 'due' AND task_status = 'open';

CREATE INDEX IF NOT EXISTS ix_mv_task_daily_facts_snapshots_slicers
  ON analytics.mv_task_daily_facts_snapshots(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX IF NOT EXISTS ix_mv_task_daily_facts_snapshots_priority
  ON analytics.mv_task_daily_facts_snapshots(snapshot_id, priority);

CREATE INDEX IF NOT EXISTS ix_mv_task_daily_facts_snapshots_assignment_state
  ON analytics.mv_task_daily_facts_snapshots(snapshot_id, assignment_state);

CREATE INDEX IF NOT EXISTS ix_mv_task_daily_facts_snapshots_sla_flag
  ON analytics.mv_task_daily_facts_snapshots(snapshot_id, sla_flag);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_open_tasks_by_name_snapshots_key
  ON analytics.mv_open_tasks_by_name_snapshots(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    priority_bucket
  );

CREATE INDEX IF NOT EXISTS ix_mv_open_tasks_by_name_snapshots_slicers
  ON analytics.mv_open_tasks_by_name_snapshots(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_open_tasks_by_region_location_snapshots_key
  ON analytics.mv_open_tasks_by_region_location_snapshots(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    priority_bucket
  );

CREATE INDEX IF NOT EXISTS ix_mv_open_tasks_by_region_location_snapshots_slicers
  ON analytics.mv_open_tasks_by_region_location_snapshots(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_open_tasks_summary_snapshots_key
  ON analytics.mv_open_tasks_summary_snapshots(
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

CREATE INDEX IF NOT EXISTS ix_mv_open_tasks_summary_snapshots_slicers
  ON analytics.mv_open_tasks_summary_snapshots(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX IF NOT EXISTS ix_mv_open_tasks_summary_snapshots_state
  ON analytics.mv_open_tasks_summary_snapshots(snapshot_id, state);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_open_tasks_wait_time_by_assigned_date_snapshots_key
  ON analytics.mv_open_tasks_wait_time_by_assigned_date_snapshots(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type,
    reference_date
  );

CREATE INDEX IF NOT EXISTS ix_mv_open_tasks_wait_time_by_assigned_date_snapshots_slicers
  ON analytics.mv_open_tasks_wait_time_by_assigned_date_snapshots(
    snapshot_id,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    work_type
  );

CREATE INDEX IF NOT EXISTS ix_mv_open_tasks_wait_time_by_assigned_date_snapshots_reference_date
  ON analytics.mv_open_tasks_wait_time_by_assigned_date_snapshots(snapshot_id, reference_date);

-- Section 7: Batch procedure that refreshes source MVs, snapshots data, and atomically publishes.
-- It commits a visible "running" state first, then runs the heavy refresh/copy transaction.
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
  -- Ensure only one batch can run at a time across commit boundaries.
  IF NOT pg_try_advisory_lock(v_lock_key) THEN
    RAISE NOTICE 'Analytics snapshot batch already running; skipping trigger.';
    RETURN;
  END IF;

  -- Phase 1: persist visible in-progress state.
  BEGIN
    v_snapshot_id := nextval('analytics.mv_snapshot_id_seq');

    INSERT INTO analytics.mv_snapshot_batches (snapshot_id, status)
    VALUES (v_snapshot_id, 'running');

    UPDATE analytics.mv_snapshot_state
    SET in_progress_snapshot_id = v_snapshot_id
    WHERE singleton_id = TRUE;
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(v_lock_key);
      RAISE;
  END;

  COMMIT;

  -- Phase 2: refresh/copy in one transaction.
  BEGIN
    -- Refresh source MVs in dependency order.
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_reportable_task_thin;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_user_completed_facts;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_task_daily_facts;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_open_tasks_by_name;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_open_tasks_by_region_location;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_open_tasks_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_open_tasks_wait_time_by_assigned_date;

    -- Guardrail: refuse to publish an empty base snapshot.
    SELECT COUNT(*) INTO v_base_row_count
    FROM analytics.mv_reportable_task_thin;

    IF v_base_row_count = 0 THEN
      RAISE EXCEPTION 'Base MV analytics.mv_reportable_task_thin is empty; refusing to publish snapshot %', v_snapshot_id;
    END IF;

    -- Copy refreshed MV data into immutable snapshot tables keyed by snapshot_id.
    INSERT INTO analytics.mv_reportable_task_thin_snapshots (
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
      number_of_reassignments
    )
    SELECT
      v_snapshot_id,
      thin.task_id,
      thin.update_id,
      thin.task_name,
      thin.jurisdiction_label,
      thin.case_type_label,
      thin.role_category_label,
      thin.case_id,
      thin.region,
      thin.location,
      thin.state,
      thin.termination_reason,
      thin.termination_process_label,
      thin.outcome,
      thin.work_type,
      thin.is_within_sla,
      thin.created_date,
      thin.due_date,
      thin.completed_date,
      thin.first_assigned_date,
      thin.major_priority,
      thin.assignee,
      thin.wait_time_days,
      thin.wait_time,
      thin.handling_time_days,
      thin.handling_time,
      thin.processing_time_days,
      thin.processing_time,
      thin.number_of_reassignments
    FROM analytics.mv_reportable_task_thin thin;

    INSERT INTO analytics.mv_user_completed_facts_snapshots (
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
      facts.assignee,
      facts.jurisdiction_label,
      facts.role_category_label,
      facts.region,
      facts.location,
      facts.task_name,
      facts.work_type,
      facts.completed_date,
      facts.tasks,
      facts.within_due,
      facts.beyond_due,
      facts.handling_time_sum,
      facts.handling_time_count,
      facts.days_beyond_sum,
      facts.days_beyond_count
    FROM analytics.mv_user_completed_facts facts;

    INSERT INTO analytics.mv_task_daily_facts_snapshots (
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
    SELECT
      v_snapshot_id,
      facts.date_role,
      facts.reference_date,
      facts.jurisdiction_label,
      facts.role_category_label,
      facts.region,
      facts.location,
      facts.task_name,
      facts.work_type,
      facts.priority,
      facts.task_status,
      facts.assignment_state,
      facts.sla_flag,
      facts.handling_time_days_sum,
      facts.handling_time_days_count,
      facts.processing_time_days_sum,
      facts.processing_time_days_count,
      facts.task_count
    FROM analytics.mv_task_daily_facts facts;

    INSERT INTO analytics.mv_open_tasks_by_name_snapshots (
      snapshot_id,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      priority_bucket,
      task_count
    )
    SELECT
      v_snapshot_id,
      snapshot.jurisdiction_label,
      snapshot.role_category_label,
      snapshot.region,
      snapshot.location,
      snapshot.task_name,
      snapshot.work_type,
      snapshot.priority_bucket,
      snapshot.task_count
    FROM analytics.mv_open_tasks_by_name snapshot;

    INSERT INTO analytics.mv_open_tasks_by_region_location_snapshots (
      snapshot_id,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      task_name,
      work_type,
      priority_bucket,
      task_count
    )
    SELECT
      v_snapshot_id,
      snapshot.jurisdiction_label,
      snapshot.role_category_label,
      snapshot.region,
      snapshot.location,
      snapshot.task_name,
      snapshot.work_type,
      snapshot.priority_bucket,
      snapshot.task_count
    FROM analytics.mv_open_tasks_by_region_location snapshot;

    INSERT INTO analytics.mv_open_tasks_summary_snapshots (
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
      snapshot.jurisdiction_label,
      snapshot.role_category_label,
      snapshot.region,
      snapshot.location,
      snapshot.task_name,
      snapshot.work_type,
      snapshot.state,
      snapshot.priority_bucket,
      snapshot.task_count
    FROM analytics.mv_open_tasks_summary snapshot;

    INSERT INTO analytics.mv_open_tasks_wait_time_by_assigned_date_snapshots (
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
      snapshot.jurisdiction_label,
      snapshot.role_category_label,
      snapshot.region,
      snapshot.location,
      snapshot.task_name,
      snapshot.work_type,
      snapshot.reference_date,
      snapshot.total_wait_time,
      snapshot.assigned_task_count
    FROM analytics.mv_open_tasks_wait_time_by_assigned_date snapshot;
  EXCEPTION
    WHEN OTHERS THEN
      v_batch_failed := TRUE;
      v_batch_error_message := SQLERRM;
  END;

  IF v_batch_failed THEN
    -- The refresh/copy subtransaction is already rolled back.
    UPDATE analytics.mv_snapshot_batches
    SET status = 'failed', completed_at = clock_timestamp(), error_message = v_batch_error_message
    WHERE snapshot_id = v_snapshot_id;

    UPDATE analytics.mv_snapshot_state
    SET in_progress_snapshot_id = NULL
    WHERE singleton_id = TRUE AND in_progress_snapshot_id = v_snapshot_id;

    COMMIT;
    PERFORM pg_advisory_unlock(v_lock_key);
    RAISE EXCEPTION 'Analytics snapshot batch % failed: %', v_snapshot_id, v_batch_error_message;
  END IF;

  UPDATE analytics.mv_snapshot_batches
  SET status = 'succeeded', completed_at = clock_timestamp(), error_message = NULL
  WHERE snapshot_id = v_snapshot_id;

  UPDATE analytics.mv_snapshot_state
  SET published_snapshot_id = v_snapshot_id,
      published_at = clock_timestamp(),
      in_progress_snapshot_id = NULL
  WHERE singleton_id = TRUE;

  -- Retention cleanup after successful publish.
  -- Snapshot data rows are deleted via ON DELETE CASCADE from mv_snapshot_batches.
  BEGIN
    WITH pinned AS (
      SELECT published_snapshot_id AS snapshot_id
      FROM analytics.mv_snapshot_state
      WHERE singleton_id = TRUE
      UNION
      SELECT in_progress_snapshot_id AS snapshot_id
      FROM analytics.mv_snapshot_state
      WHERE singleton_id = TRUE
    ),
    keep_succeeded AS (
      SELECT snapshot_id
      FROM analytics.mv_snapshot_batches
      WHERE status = 'succeeded'
      ORDER BY snapshot_id DESC
      LIMIT 3
    )
    DELETE FROM analytics.mv_snapshot_batches batches
    WHERE batches.status = 'succeeded'
      AND batches.snapshot_id NOT IN (SELECT snapshot_id FROM keep_succeeded)
      AND batches.snapshot_id NOT IN (SELECT snapshot_id FROM pinned WHERE snapshot_id IS NOT NULL);

    WITH keep_failed AS (
      SELECT snapshot_id
      FROM analytics.mv_snapshot_batches
      WHERE status = 'failed'
      ORDER BY snapshot_id DESC
      LIMIT 100
    )
    DELETE FROM analytics.mv_snapshot_batches batches
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

-- Section 8: Best-effort pg_cron setup and scheduler registration.
-- Keep cron operations at the end so snapshot artifacts always rebuild first.
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
      PERFORM cron.unschedule('analytics_mv_refresh_consistent_snapshot_batch')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'analytics_mv_refresh_consistent_snapshot_batch');
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
        'analytics_mv_refresh_consistent_snapshot_batch',
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
