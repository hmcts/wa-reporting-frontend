# Flyway runbook

The analytics schema is managed by Flyway migrations under `db/migrations/tm/`.

## Model

- `db/migrations/tm/V001__init_analytics_schema.sql` is a repository-local copy of the previously deployed HMCTS analytics baseline from `wa-task-management-api` `V1.0.44__init_analytics_schema.sql`.
- Later repository-owned migrations evolve that baseline to the schema expected by this application branch.
- `db/current-state/tm-analytics-schema.sql` is the rerunnable current-state bootstrap mirror of the TM analytics schema.
- Current-state SQL is used for local/disposable rebuilds and SQL design review.
- Current-state SQL is not canonical migration history and must stay aligned with the latest Flyway end state.
- `db/flyway/` contains a minimal Gradle wrapper project used only for Flyway commands.

## Commands

Supported wrapper tasks include:

- `flywayInfo`
- `flywayBaseline`
- `flywayValidate`
- `flywayMigrate`

## Baseline behaviour

The Flyway wrapper is configured with:

- `baselineOnMigrate = true`
- `baselineVersion = '001'`
- `baselineDescription = 'init analytics schema'`

On the first `flywayMigrate` against an existing environment with a non-empty `analytics` schema and no history table, Flyway records local `V001` as the baseline automatically and then applies later migrations.

New empty environments still run `flywayMigrate` directly, but they must already contain the upstream TM source schema expected by `V001`. The analytics migration chain is not a full bootstrap for an otherwise blank PostgreSQL database.

## Snapshot refresh coordination

Migrations that touch snapshot refresh procedures, refresh helper procedures, snapshot parent or partition tables, partition indexes, or refresh publish/retention cleanup must serialise with `analytics.run_snapshot_refresh_batch()` before taking DDL locks.

Put this block before the first affected DDL statement:

```sql
SET LOCAL lock_timeout = '20min';

SELECT pg_advisory_xact_lock(hashtext('analytics_run_snapshot_refresh_batch_lock'));
```

The advisory lock key must match the refresh procedure's session-level lock key. If a refresh is already running, the migration waits before attempting table/index/procedure DDL. After the migration has the transaction-scoped advisory lock, a scheduled refresh trigger cannot acquire its session-level lock and skips instead of overlapping the migration.

The 20 minute `lock_timeout` bounds later waits for PostgreSQL relation locks, such as `ALTER TABLE`, `DROP INDEX`, and partition attach/detach locks. If the timeout is exceeded, the Flyway migration fails and PostgreSQL rolls back the transaction.

## Jenkins wiring

Flyway is wired in Jenkins to use TM replica host and replica credential secrets.

In Jenkins, the Flyway step is an explicit post-`buildinfra` action for:

- `aat`
- `demo`
- `ithc`
- `perftest`
- `prod`

`TM_DB_MIGRATION_USER` and `TM_DB_MIGRATION_PASSWORD` are loaded inside that step from WA Key Vault secrets:

- `cft-task-POSTGRES-USER-FLEXIBLE-REPLICA`
- `cft-task-POSTGRES-PASS-FLEXIBLE-REPLICA`

The Flyway JDBC URL mirrors the Jenkins library Gradle migration pattern and uses `?ssl=true&sslmode=require`.

Jenkins runs `flywayMigrate` only. On first run in an existing environment, Flyway auto-baselines to `001` before applying later migrations.

Runtime application startup does not run schema migrations.
