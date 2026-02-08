# Configuration and operations

## Configuration files
- `config/default.json` defines defaults for all runtime configuration.
- `config/custom-environment-variables.yaml` maps config keys to environment variables.

## Key configuration areas

### Analytics
- `analytics.cacheTtlSeconds`: NodeCache TTL for filter options and reference data.
- `analytics.manageCaseBaseUrl`: base URL used for case links.
- `analytics.filtersCookieName`: name for filter persistence cookie.
- `analytics.filtersCookieMaxAgeDays`: cookie lifetime in days.

### Authentication
- `auth.enabled`: enables/disables OIDC and RBAC.
- `services.idam.clientID`, `clientSecret`, `scope`.
- `services.idam.url.public`: IDAM base URL.
- `services.idam.url.wa`: base URL of this application.
- `RBAC.access`: required role for access.

### Session
- `session.secret`: session signing secret.
- `session.cookie.name`: cookie for OIDC session.
- `session.appCookie.name`: cookie for app session.
- `session.redis.host`, `port`, `key`: Redis connection for session storage.

### Database
- `database.tm`, `database.crd`, `database.lrd`: PostgreSQL connection details.
- Supports `url` overrides and `schema` for search_path.

### Security and logging
- `useCSRFProtection` and `csrfCookieSecret`.
- `security.referrerPolicy` and HSTS settings.
- `logging.prismaQueryTimings`: enable query timing logs.
- `appInsights.connectionString` for Application Insights.

## Environment variables (selected)
- `AUTH_ENABLED`
- `APPLICATIONINSIGHTS_CONNECTION_STRING`
- `IDAM_CLIENT_ID`, `IDAM_CLIENT_SECRET`, `IDAM_CLIENT_SCOPE`
- `IDAM_PUBLIC_URL`, `WA_BASE_URL`
- `TM_DB_*`, `CRD_DB_*`, `LRD_DB_*`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_KEY`
- `SESSION_SECRET`, `SESSION_COOKIE_NAME`, `SESSION_APP_COOKIE_NAME`

## Secrets via Properties Volume
When not in development, `PropertiesVolume` maps Kubernetes secrets into the configuration, including:
- IDAM client secret
- Session secret
- CSRF cookie secret
- Redis credentials
- Database credentials

## Build and runtime

### Build
- `yarn build` builds frontend assets via webpack.
- `yarn build:server` compiles server TypeScript to `dist/`.
- `yarn build:prod` builds assets and copies views/public into `dist/main`.

### Run
- `yarn start` runs the compiled server from `dist/main/server.js`.
- `yarn start:dev` runs via nodemon with webpack dev middleware.
- Default port is 3100 (configurable via `PORT`).

### Health and info endpoints
- `/health` returns liveness and readiness checks.
- `/info` returns build and runtime metadata.

### Logging and monitoring
- Uses `@hmcts/nodejs-logging` for server logs.
- Optional Application Insights integration.

