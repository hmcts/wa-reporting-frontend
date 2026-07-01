# Local database runbook

This runbook covers the opt-in local PostgreSQL database used for unmocked analytics development and smoke checks.

## Container

`docker-compose.local-db.yml` provides a local PostgreSQL container separate from the default compose file.

- Default port: `${LOCAL_DB_PORT:-5432}`
- Default user/password: `postgres/password`
- Local destructive commands refuse to run unless `LOCAL_DB_HOST` is local (`localhost`, `127.0.0.1`, or `::1`).

## Commands

| Command | Purpose |
| --- | --- |
| `yarn db:local:up` | Start the local PostgreSQL container. |
| `yarn db:local:reset` | Recreate only `cft_task_db`, `dbrdcaseworker`, and `dbrdlocationref`, then apply the minimum TM source stub required by Flyway. |
| `yarn db:local:migrate` | Run `db/flyway/gradlew flywayMigrate` against the local TM database. |
| `yarn db:local:seed` | Seed TM/CRD/LRD reference data, generate source task rows, sync analytics-owned location lookup tables, run snapshot refresh, and publish a local analytics snapshot. |
| `yarn db:local:refresh` | Sync analytics-owned location lookup tables, then run `CALL analytics.run_snapshot_refresh_batch()` for diagnostics. |
| `yarn db:local:validate` | Validate the published local snapshot and required TM/CRD/LRD reference data. |
| `yarn db:local:rebuild` | Run reset, Flyway migrate, seed, refresh, and validation in order. |

## Flyway and schema ownership

- The local rebuild path uses Flyway as the only creator of the `analytics` schema.
- It does not apply `db/current-state/tm-analytics-schema.sql`.
- The reset step creates only the upstream objects Flyway and the refresh SQL need on a blank local database.
- The seed path generates upstream `cft_task_db.reportable_task` source rows, copies safe LRD court venue labels into analytics-owned lookup tables, and lets `analytics.run_snapshot_refresh_batch()` populate snapshot tables, rollups, filters, and indexes.

## Seed controls

- `LOCAL_DB_SEED_RECORD_COUNT` controls total generated `cft_task_db.reportable_task` source rows.
- Default record count: `500000`.
- Minimum record count: `20`.
- `LOCAL_DB_SEED_RANDOM_SEED` controls deterministic value variation. The default is `12345`.
- The same record count and random seed produce the same source rows.
- Seeded data uses weighted sampling across assigned, unassigned, overdue, due-soon, due-later, completed-within-SLA, completed-beyond-SLA, cancelled/deleted, and pending-auto-assign scenarios.
- Generated dimensions include 10 services, 8 regions, 100 weighted locations, 5 role categories, 5 work types, 500 task names, and 5,000 generated caseworkers.
- The LRD seed and first generated source rows also include fixed duplicate-EPIMMS fixtures so local snapshot refresh covers case-type-specific court venue labels, ambiguous generic fallback, and unambiguous generic fallback.
- Coverage is best effort: small or heavily skewed seeds may not include every configured value.

Examples:

```bash
yarn db:local:rebuild
LOCAL_DB_SEED_RECORD_COUNT=1000000 yarn db:local:rebuild
LOCAL_DB_SEED_RECORD_COUNT=250000 LOCAL_DB_SEED_RANDOM_SEED=98765 yarn db:local:rebuild
```

## Running the app

Runtime defaults point at the same local database names and schemas. Start without auth for local analytics checks:

```bash
AUTH_ENABLED=false yarn start:dev
```

If the database is exposed on a non-default port, set the matching runtime ports:

```bash
LOCAL_DB_PORT=5544 yarn db:local:up
TM_DB_PORT=5544 CRD_DB_PORT=5544 LRD_DB_PORT=5544 AUTH_ENABLED=false yarn start:dev
```

Smoke-check `/`, `/outstanding`, `/completed`, and `/users` after rebuilding or changing seed size.
