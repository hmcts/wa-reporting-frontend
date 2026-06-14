# Snapshot refresh runbook

This runbook covers startup registration of the analytics snapshot refresh schedule and runtime notes for the refresh procedure. The data model details live in [Snapshot lifecycle](../data-sources/snapshot-lifecycle.md).

## Startup cron bootstrap

When `analytics.snapshotRefreshCronBootstrap.enabled=true`, app startup attempts to register the snapshot refresh schedule through `cron.schedule_in_database(...)`.

Registration behaviour:

- Uses TM connection credentials and host settings.
- Overrides the database name to `analytics.snapshotRefreshCronBootstrap.cronDatabase`, which defaults to `postgres`.
- Is non-fatal: startup logs failures and continues serving requests.
- Is idempotent: existing jobs matching `jobName` and `targetDatabase` are unscheduled before registering the configured definition.
- Does not initialize or advance Flyway schema history.

Failure logs include structured error fields:

- `errorName`
- `errorMessage`
- Optional `errorCode`
- Optional `errorDetail`
- Optional `errorHint`
- Optional `errorMeta`
- `errorStack`

## Prerequisites

- `pg_cron` extension and `cron` schema/functions are available in `cronDatabase`.
- The application DB role can read from `cron.job`.
- The application DB role can execute `cron.unschedule(...)`.
- The application DB role can execute `cron.schedule_in_database(...)`.

## Runtime refresh notes

- `analytics.run_snapshot_refresh_batch()` builds detached snapshot tables first.
- Parent-table metadata locks are taken only during the short final attach/publish step.
- Refresh-created aggregate partition indexes match corresponding parent partitioned indexes.
- Matching index definitions let Postgres attach/reuse those indexes at publish time instead of maintaining duplicate child-local index families.
- Post-publish retention cleanup uses a short `lock_timeout` while detaching obsolete partitions.
- If retention cleanup cannot obtain the lock quickly, it logs a warning and leaves the old snapshot for a later run.

```mermaid
flowchart LR
  Startup["Application startup"] --> Enabled{"Bootstrap enabled?"}
  Enabled -- "No" --> Serve["Serve requests"]
  Enabled -- "Yes" --> Unschedule["Unschedule existing matching job"]
  Unschedule --> Schedule["schedule_in_database"]
  Schedule --> Result{"Registration succeeds?"}
  Result -- "Yes" --> Serve
  Result -- "No" --> Log["Structured warning/error log"]
  Log --> Serve
```
