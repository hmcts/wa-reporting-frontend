# TM schema permissions runbook

`yarn bootstrap:tm-schema-permissions` grants analytics schema read permissions to a configured database reader role.

## Behaviour

The script grants:

- `USAGE` on schema `analytics`
- `SELECT` on all tables in schema `analytics`

The bootstrap is safe to rerun because repeated `GRANT` statements are idempotent for the target role.

Concurrent bootstrap runs against the same TM database are serialised with a transaction-scoped PostgreSQL advisory lock before schema/table ACLs are updated. This avoids catalog update races between Jenkins jobs while keeping the grants atomic.

This bootstrap is external to application startup. The runtime service remains read-only and should continue to use its normal TM read connection.

## Reader role

`TM_SCHEMA_PERMISSIONS_DB_READER_USERNAME` defaults to:

- `DTS JIT Access wa DB Reader SC`

Demo overrides this to:

- `DTS CFT DB Access Reader`

Prod bootstrap invocation does not set a stage-specific reader username.

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

Demo and Prod stages invoke the bootstrap directly after Flyway, so stage selection is the environment toggle.
