---
name: local-app-startup
description: "Start, restart, run up, or smoke-check the WA Reporting Frontend app locally with the preferred Flyway-backed seeded Docker Postgres database and auth disabled. Use when asked to run up the app, start the app locally, get the app running with local data, restart local app, seed local database, rebuild local DB data, change local seed size, set LOCAL_DB_SEED_RECORD_COUNT or LOCAL_DB_SEED_RANDOM_SEED, disable auth for local development, or verify local analytics routes."
---

# Local App Startup

## Workflow
- Run commands from the repository root.
- Start the local Docker database first:
  - `yarn db:local:up`
- For a normal "run up the app" request, validate before rebuilding:
  - `yarn db:local:validate`
  - If validation fails, or the user asks for a fresh dataset, run `yarn db:local:rebuild`.
- For an explicit dataset size, rebuild with:
  - `LOCAL_DB_SEED_RECORD_COUNT=<count> yarn db:local:rebuild`
- For a reproducible dataset variant, also set:
  - `LOCAL_DB_SEED_RANDOM_SEED=<seed>`
- Start the app without auth:
  - `PORT=${PORT:-3100} AUTH_ENABLED=false LOG_LEVEL=error yarn start:dev`

## Local Data Defaults
- The default local rebuild creates `500000` upstream `cft_task_db.reportable_task` rows.
- `LOCAL_DB_SEED_RECORD_COUNT` controls source rows, not analytics fact-table rows.
- Values below `20` are rejected.
- The seed is deterministic for the same record count and `LOCAL_DB_SEED_RANDOM_SEED`.
- Seeded data uses weighted local dimensions: 10 services, 8 regions, 100 locations, 5 role categories, 5 work types, 500 task names, and 5,000 users.

## Ports And Environment
- If `LOCAL_DB_PORT` is not the default, start the app with matching database ports:
  - `TM_DB_PORT=<port> CRD_DB_PORT=<port> LRD_DB_PORT=<port> PORT=${PORT:-3100} AUTH_ENABLED=false LOG_LEVEL=error yarn start:dev`
- If port `3100` is already in use, inspect the existing process. Reuse it if it is already this app and healthy; otherwise choose another `PORT`.
- Avoid destructive DB rebuilds when a valid local snapshot already exists unless the user asks for a rebuild, a different record count, or a different random seed.

## Verification
- Use Node `fetch` rather than `curl`, because `curl` may not be installed in this environment.
- Check `/health`, `/`, `/outstanding`, `/completed`, and `/users`.
- If route checks fail after a DB rebuild, restart the app to refresh database connections, then check the routes again.

```bash
node - <<'NODE'
const paths = ['/health', '/', '/outstanding', '/completed', '/users'];
(async () => {
  for (const path of paths) {
    const started = Date.now();
    const response = await fetch(`http://localhost:${process.env.PORT || 3100}${path}`);
    await response.arrayBuffer();
    console.log(`${path} ${response.status} ${Date.now() - started}ms`);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
NODE
```
