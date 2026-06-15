# Runtime and build

## Package management

- The repository uses the Yarn release declared by `package.json` `packageManager`.
- `package.json` may include top-level `resolutions` for transitive packages when upstream dependency ranges do not yet converge on the required version.
- Dependency upgrades should review each top-level resolution and remove any override that no longer changes the resolved dependency graph or production audit outcome.

## Build scripts

| Command | Purpose |
| --- | --- |
| `yarn build` | Builds frontend webpack assets only. It does not compile the server TypeScript entrypoint. |
| `yarn build:watch` | Rebuilds frontend assets continuously via webpack watch mode. |
| `yarn build:server` | Compiles server TypeScript to `dist/`. |
| `yarn build:prod` | Builds production frontend assets and copies views/public into `dist/main`. It does not compile the server by itself. |
| `db/flyway/gradlew` | Runs repository-owned Flyway commands for the TM analytics schema. |
| `yarn bootstrap:tm-schema-permissions` | Runs rerunnable TM analytics schema grants bootstrap. |

## Run scripts

| Command | Purpose |
| --- | --- |
| `yarn start:dev` | Runs via nodemon with webpack dev middleware. |
| `yarn start` | Runs compiled server from `dist/main/server.js`. Requires `yarn build:server` and `yarn build:prod` first. |

For local frontend iteration, `yarn start:dev` is enough to serve in-memory webpack bundles. Run `yarn build:watch` as well only if on-disk bundles need to be refreshed continuously.

Default port is 3100, configurable via `PORT`.

Express trusts one proxy hop (`trust proxy = 1`) to support AKS/ingress `X-Forwarded-For` headers.

## Health and info endpoints

- `/health` returns liveness and readiness checks.
- `/info` returns build and runtime metadata.
- When Redis is configured, `/health` includes a Redis ping check in both liveness and readiness.

## Logging and monitoring

- Uses a local Winston 3 logger wrapper for server logs.
- `LOG_LEVEL` controls verbosity and defaults to `info`.
- `JSON_PRINT=true` enables JSON output.

When `logging.prismaQueryTimings.enabled=true`, Prisma query events are emitted as:

- `db.query` for timings at or above `minDurationMs` and below `slowQueryThresholdMs`.
- `db.query.slow` for timings at or above `slowQueryThresholdMs`.

Payload fields include:

- `database` (`tm`, `crd`, or `lrd`)
- `durationMs`
- `target`
- `queryFingerprint`
- Optional `queryPreview` when enabled

OpenTelemetry (Azure Monitor) exports traces and logs to Application Insights when a connection string is available from `APPLICATIONINSIGHTS_CONNECTION_STRING` or `secrets.wa.app-insights-connection-string`.

In non-development environments, startup loads Properties Volume secrets into `config` before OpenTelemetry initialisation, so mounted Key Vault values are available during telemetry setup.

The service name is configured in code as `wa-reporting-frontend`.
