CREATE SCHEMA IF NOT EXISTS cft_task_db;

CREATE TABLE IF NOT EXISTS cft_task_db.reportable_task (
  task_id TEXT,
  update_id BIGINT,
  task_name TEXT,
  jurisdiction_label TEXT,
  case_type_label TEXT,
  role_category_label TEXT,
  case_id TEXT,
  region TEXT,
  location TEXT,
  state TEXT,
  termination_reason TEXT,
  termination_process_label TEXT,
  outcome TEXT,
  work_type TEXT,
  is_within_sla TEXT,
  created_date DATE,
  due_date DATE,
  completed_date DATE,
  due_date_to_completed_diff_time INTERVAL,
  first_assigned_date DATE,
  major_priority INTEGER,
  assignee TEXT,
  wait_time_days DOUBLE PRECISION,
  wait_time INTERVAL,
  handling_time_days DOUBLE PRECISION,
  handling_time INTERVAL,
  processing_time_days DOUBLE PRECISION,
  processing_time INTERVAL,
  number_of_reassignments INTEGER
);

TRUNCATE cft_task_db.reportable_task;

CREATE TABLE IF NOT EXISTS cft_task_db.work_types (
  work_type_id TEXT PRIMARY KEY,
  label TEXT NOT NULL
);
