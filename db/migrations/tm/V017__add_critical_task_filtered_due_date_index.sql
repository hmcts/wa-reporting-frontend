SET LOCAL lock_timeout = '20min';

SELECT pg_advisory_xact_lock(hashtext('analytics_run_snapshot_refresh_batch_lock'));

CREATE INDEX IF NOT EXISTS ix_snapshot_open_task_rows_critical_slicers_due_date
  ON analytics.snapshot_open_task_rows(jurisdiction_label, role_category_label, region, due_date)
  WHERE created_date IS NOT NULL
    AND state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED');
