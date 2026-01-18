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
  ON analytics.mv_reportable_task_thin(jurisdiction_label, role_category_label, region, location, task_name);

CREATE INDEX ix_thin_state
  ON analytics.mv_reportable_task_thin(state);

CREATE INDEX ix_thin_state_created_desc
  ON analytics.mv_reportable_task_thin(state, created_date DESC);

CREATE INDEX ix_thin_task_name
  ON analytics.mv_reportable_task_thin(task_name);

CREATE INDEX ix_thin_termination_reason
  ON analytics.mv_reportable_task_thin(termination_reason);

CREATE INDEX ix_thin_completed_reason_state_date_desc
  ON analytics.mv_reportable_task_thin(termination_reason, state, completed_date DESC);

CREATE INDEX ix_thin_completed_assignee_date_desc
  ON analytics.mv_reportable_task_thin(assignee, completed_date DESC)
  WHERE termination_reason = 'completed' AND state IN ('COMPLETED','TERMINATED') AND assignee IS NOT NULL;

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
  completed_date::date AS completed_date,
  COUNT(*)::int AS tasks,
  SUM(CASE WHEN is_within_sla = 'Yes' THEN 1 ELSE 0 END)::int AS within_due,
  SUM(CASE WHEN is_within_sla = 'No' THEN 1 ELSE 0 END)::int AS beyond_due,
  SUM(handling_time_days)::numeric AS handling_time_sum,
  COUNT(handling_time_days)::int AS handling_time_count,
  SUM(
    CASE
      WHEN due_date IS NOT NULL AND completed_date IS NOT NULL THEN completed_date::date - due_date::date
      ELSE 0
    END
  )::numeric AS days_beyond_sum,
  SUM(CASE WHEN due_date IS NOT NULL AND completed_date IS NOT NULL THEN 1 ELSE 0 END)::int AS days_beyond_count
FROM analytics.mv_reportable_task_thin
WHERE completed_date IS NOT NULL
  AND termination_reason = 'completed'
  AND state IN ('COMPLETED','TERMINATED')
GROUP BY
  assignee,
  jurisdiction_label,
  role_category_label,
  region,
  location,
  task_name,
  completed_date::date;

CREATE UNIQUE INDEX ux_mv_user_completed_facts_key
  ON analytics.mv_user_completed_facts(
    assignee,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    completed_date
  );

CREATE INDEX ix_user_completed_assignee_date
  ON analytics.mv_user_completed_facts(assignee, completed_date DESC);

CREATE INDEX ix_user_completed_assignee_task_name
  ON analytics.mv_user_completed_facts(assignee, task_name);

CREATE INDEX ix_user_completed_slicers
  ON analytics.mv_user_completed_facts(jurisdiction_label, role_category_label, region, location, task_name);

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
    handling_time_days,
    processing_time_days
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

  priority,

  CASE
    WHEN termination_reason = 'completed'
         AND state IN ('COMPLETED','TERMINATED')
      THEN 'completed'
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
    OR (termination_reason = 'completed' AND state IN ('COMPLETED','TERMINATED'))
  )
GROUP BY
  1,2,3,4,5,6,7,8,9,10,11

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
  1,2,3,4,5,6,7,8,9,10

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

  priority,

  'completed'::text AS task_status,

  NULL::text AS assignment_state,

  CASE
    WHEN is_within_sla IS TRUE THEN TRUE
    WHEN is_within_sla IS FALSE THEN FALSE
    ELSE NULL
  END AS sla_flag,

  SUM(handling_time_days)::numeric AS handling_time_days_sum,
  COUNT(handling_time_days)::bigint AS handling_time_days_count,
  SUM(processing_time_days)::numeric AS processing_time_days_sum,
  COUNT(processing_time_days)::bigint AS processing_time_days_count,

  COUNT(*) AS task_count
FROM base
WHERE completed_date IS NOT NULL
  AND termination_reason = 'completed'
  AND state IN ('COMPLETED','TERMINATED')
GROUP BY
  1,2,3,4,5,6,7,8,9,10,11

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
  1,2,3,4,5,6,7,8,9,10,11;

CREATE UNIQUE INDEX ux_mv_task_daily_facts_key
  ON analytics.mv_task_daily_facts(
    date_role,
    reference_date,
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
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
  (jurisdiction_label, role_category_label, region, location, task_name);

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
  priority_bucket;

CREATE UNIQUE INDEX ux_mv_open_tasks_by_name_key
  ON analytics.mv_open_tasks_by_name(
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    priority_bucket
  );

CREATE INDEX ix_open_tasks_by_name_slicers
  ON analytics.mv_open_tasks_by_name(jurisdiction_label, role_category_label, region, location, task_name);

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
  priority_bucket;

CREATE UNIQUE INDEX ux_mv_open_tasks_by_region_location_key
  ON analytics.mv_open_tasks_by_region_location(
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    priority_bucket
  );

CREATE INDEX ix_open_tasks_by_region_location_slicers
  ON analytics.mv_open_tasks_by_region_location(jurisdiction_label, role_category_label, region, location, task_name);

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
  state,
  priority_bucket;

CREATE UNIQUE INDEX ux_mv_open_tasks_summary_key
  ON analytics.mv_open_tasks_summary(
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    state,
    priority_bucket
  );

CREATE INDEX ix_open_tasks_summary_slicers
  ON analytics.mv_open_tasks_summary(jurisdiction_label, role_category_label, region, location, task_name);

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
  first_assigned_date AS reference_date,
  SUM(wait_time_days)::numeric AS total_wait_time_days,
  COUNT(*)::bigint AS assigned_task_count
FROM analytics.mv_reportable_task_thin
WHERE wait_time_days IS NOT NULL
GROUP BY
  jurisdiction_label,
  role_category_label,
  region,
  location,
  task_name,
  first_assigned_date;

CREATE UNIQUE INDEX ux_mv_open_tasks_wait_time_by_assigned_date_key
  ON analytics.mv_open_tasks_wait_time_by_assigned_date(
    jurisdiction_label,
    role_category_label,
    region,
    location,
    task_name,
    reference_date
  );

CREATE INDEX ix_open_tasks_wait_time_slicers
  ON analytics.mv_open_tasks_wait_time_by_assigned_date(jurisdiction_label, role_category_label, region, location, task_name);

CREATE INDEX ix_open_tasks_wait_time_reference_date
  ON analytics.mv_open_tasks_wait_time_by_assigned_date(reference_date);
