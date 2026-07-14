# TM schema permissions runbook

`yarn bootstrap:tm-schema-permissions` checks and, when required, grants read permissions on the durable analytics tables to a configured database reader role.

## Behaviour

The script maintains:

- `USAGE` on schema `analytics`
- `SELECT` on the durable analytics tables listed below

It first performs a read-only preflight outside an explicit transaction. The preflight checks effective schema `USAGE`, confirms that every required durable table exists, and identifies durable tables without effective `SELECT` access. When all permissions are current, the bootstrap logs that no repair is needed and exits without acquiring advisory locks or issuing `GRANT` statements.

If permissions need repair, the bootstrap starts a transaction, takes the shared `analytics_run_snapshot_refresh_batch_lock` used by snapshot refresh and coordinated Flyway DDL, then takes a bootstrap-specific transaction-scoped PostgreSQL advisory lock. It repeats the preflight after acquiring the locks so a concurrent bootstrap can complete the repair first. If permissions are still missing, it grants only the missing schema or durable-table permissions and commits atomically; if another bootstrap completed the repair, it commits without issuing grants.

The repair transaction uses `lock_timeout = '30min'`, so a lock acquisition can wait up to 30 minutes before PostgreSQL fails the transaction. The read-only fast path does not use this timeout because it does not acquire either advisory lock.

The bootstrap fails without attempting repair if an expected durable table is absent. Repeated grants remain safe because PostgreSQL `GRANT` statements are idempotent for the target role.

This bootstrap is external to application startup. The runtime service remains read-only and should continue to use its normal TM read connection.

## Durable tables

The permission contract includes the 18 stable partitioned parents used by `analytics.snapshot_partition_catalog()`:

- `snapshot_open_task_rows`
- `snapshot_completed_task_rows`
- `snapshot_user_completed_facts`
- `snapshot_user_completed_daily_totals`
- `snapshot_user_completed_slicer_daily_facts`
- `snapshot_completed_dashboard_facts`
- `snapshot_completed_daily_metrics_facts`
- `snapshot_completed_region_location_facts`
- `snapshot_outstanding_due_status_daily_facts`
- `snapshot_outstanding_created_assignment_daily_facts`
- `snapshot_open_due_daily_facts`
- `snapshot_task_event_daily_facts`
- `snapshot_task_event_service_daily_facts`
- `snapshot_wait_time_by_assigned_date`
- `snapshot_overview_filter_facts`
- `snapshot_outstanding_filter_facts`
- `snapshot_completed_filter_facts`
- `snapshot_user_filter_facts`

It also includes these durable metadata and reference tables:

- `snapshot_batches`
- `snapshot_state`
- `court_venue_case_type_lookup`
- `court_venue_epimms_lookup`
- `location_reference_sync_state`

Physical snapshot partitions, including detached tables being prepared by a refresh, are deliberately excluded. The reader accesses snapshot data through the partitioned parent tables; the bootstrap does not add or repair direct grants on physical partitions.

## Reader role

`TM_SCHEMA_PERMISSIONS_DB_READER_USERNAME` defaults to:

- `DTS JIT Access wa DB Reader SC`

The Prod Jenkins invocation explicitly uses this role. Other callers can override it through `TM_SCHEMA_PERMISSIONS_DB_READER_USERNAME`.

## Connection resolution order

The script resolves connection details in this order:

1. `TM_SCHEMA_PERMISSIONS_BOOTSTRAP_URL`
2. `TM_SCHEMA_PERMISSIONS_BOOTSTRAP_HOST`, `TM_SCHEMA_PERMISSIONS_BOOTSTRAP_PORT`, `TM_SCHEMA_PERMISSIONS_BOOTSTRAP_DATABASE`, `TM_SCHEMA_PERMISSIONS_BOOTSTRAP_USER`, `TM_SCHEMA_PERMISSIONS_BOOTSTRAP_PASSWORD`, and `TM_SCHEMA_PERMISSIONS_BOOTSTRAP_OPTIONS`
3. Fallback TM environment variables used by Jenkins or local shells:
   - `TM_DB_PRIMARY_HOST`
   - `TM_DB_REPLICA_HOST`
   - `TM_DB_HOST`
   - `TM_DB_MIGRATION_USER`
   - `TM_DB_USER`
   - `TM_DB_MIGRATION_PASSWORD`
   - `TM_DB_PASSWORD`
   - `TM_DB_NAME`
   - `TM_DB_PORT`
   - `TM_DB_OPTIONS`

## Jenkins

Only the Prod stage invokes the bootstrap, directly after its Flyway migration. The checked-in Jenkins pipeline does not invoke the bootstrap for AAT, Demo, ITHC, or Perftest.
