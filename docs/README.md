# Documentation index

This folder contains the durable business, functional, and technical specifications for the Task Management Report (`wa-reporting-frontend`) application. The docs are written for two audiences:

- Humans who need to understand or change the service safely.
- Agents that need stable entry points, vocabulary, file ownership, and verification expectations before editing code.

Start at the repository root [README.md](../README.md) for local setup and command semantics, then read [AGENTS.md](../AGENTS.md) for contributor expectations and verification guidance.

## Reading paths

### Product or domain reader
1. [Business context](business-context.md)
2. [Glossary](glossary.md)
3. [Landing and navigation](functional/landing-and-navigation.md)
4. The relevant dashboard specification under [functional](functional/)

### Dashboard implementer
1. [Shared dashboard behaviour](functional/shared-dashboard-behaviour.md)
2. The relevant dashboard specification under [functional](functional/)
3. [Frontend specification](technical/frontend.md)
4. [Architecture](technical/architecture.md)
5. [Testing and quality](technical/testing.md)

### Data or SQL implementer
1. [Data sources overview](technical/data-sources.md)
2. [Snapshot lifecycle](technical/data-sources/snapshot-lifecycle.md)
3. [Snapshot table catalogue](technical/data-sources/snapshot-tables.md)
4. [Filter facets and mappings](technical/data-sources/filter-facets.md)
5. [Derived metrics](technical/data-sources/derived-metrics.md)
6. [Repository ownership](technical/data-sources/repository-ownership.md)

### Operations or deployment reader
1. [Configuration and operations](technical/configuration-and-ops.md)
2. [Runtime and build](technical/runtime-and-build.md)
3. [Deployment and CI](technical/deployment-and-ci.md)
4. The relevant runbook under [technical/operations](technical/operations/)

### Security-sensitive change reader
1. [Security and authentication](technical/security.md)
2. [Configuration reference](technical/configuration.md)
3. [Testing and quality](technical/testing.md)

### Agent starting a task
1. [Glossary](glossary.md)
2. [Change recipes](technical/change-recipes.md)
3. The relevant functional and technical specs for the target area
4. [Testing and quality](technical/testing.md)

## Document map

### Business
- [Business context](business-context.md): product purpose, users, goals, scope, and constraints.
- [Glossary](glossary.md): shared vocabulary mapped to UI terms, code fields, and page scope.

### Functional
- [Landing and navigation](functional/landing-and-navigation.md): default page, global navigation, and analytics entry point.
- [Shared dashboard behaviour](functional/shared-dashboard-behaviour.md): filters, AJAX section refresh, sorting, pagination, CSV, and error-state contracts common to dashboards.
- [Overview dashboard](functional/overview-dashboard.md): `/` service performance overview.
- [Tasks outstanding dashboard](functional/outstanding-dashboard.md): `/outstanding` open-task workload, priority, wait-time, due-date, and critical-task views.
- [Tasks completed dashboard](functional/completed-dashboard.md): `/completed` completed-task compliance and timing views.
- [User overview dashboard](functional/user-overview-dashboard.md): `/users` user-centric assigned and completed workload views.

### Technical
- [Architecture](technical/architecture.md): runtime components, route structure, module boundaries, and request lifecycle.
- [Data sources overview](technical/data-sources.md): entry point for analytics data model documentation.
- [Data sources detail](technical/data-sources/README.md): database connections, source systems, and snapshot read model.
- [Snapshot lifecycle](technical/data-sources/snapshot-lifecycle.md): refresh, publish, retention, and snapshot metadata.
- [Snapshot table catalogue](technical/data-sources/snapshot-tables.md): row, facts, rollup, and facet tables.
- [Repository ownership](technical/data-sources/repository-ownership.md): table-scoped repository rules and coordinator exceptions.
- [Filter facets and mappings](technical/data-sources/filter-facets.md): page-scoped facet tables and filter-to-column mappings.
- [Derived metrics](technical/data-sources/derived-metrics.md): priority, SLA, completion, cancellation, and average calculations.
- [Reference data](technical/data-sources/reference-data.md): CRD/LRD joins and fallback rules.
- [Frontend specification](technical/frontend.md): templates, macros, client-side behaviours, charts, and styling.
- [Security and authentication](technical/security.md): OIDC, RBAC, sessions, CSRF, Helmet, cookies, and pagination safeguards.
- [Configuration and operations](technical/configuration-and-ops.md): entry point for config, build, deploy, and runbook documentation.
- [Configuration reference](technical/configuration.md): config precedence, key areas, env vars, secrets, and Redis dependency.
- [Runtime and build](technical/runtime-and-build.md): package management, builds, running, health, logging, and monitoring.
- [Deployment and CI](technical/deployment-and-ci.md): current CI/Jenkins behaviour and verification coverage.
- [Flyway runbook](technical/operations/flyway.md): analytics migration model and baseline behaviour.
- [Snapshot refresh runbook](technical/operations/snapshot-refresh.md): pg_cron bootstrap and runtime refresh notes.
- [Schema permissions runbook](technical/operations/schema-permissions.md): rerunnable analytics reader grants.
- [Testing and quality](technical/testing.md): test suites, command semantics, coverage, mutation testing, and assertion standards.
- [Change recipes](technical/change-recipes.md): file-by-file guidance for common change types.

## Source of truth

The specifications are derived from the current codebase and configuration under:

- `db/flyway` (Flyway wrapper project for analytics schema management)
- `db/migrations/tm` (repository-owned TM analytics schema migrations)
- `db/current-state` (rerunnable current-state TM analytics schema/bootstrap SQL)
- `scripts` (operational bootstrap helpers and local tooling)
- `src/main` (server, routes, modules, views, assets)
- `config` (application configuration and environment mappings)
- `prisma` (database client setup)
- `package.json` (scripts and dependencies)

When code, SQL, configuration, or runtime behaviour changes, update the relevant documentation page in the same change. Dependency-only upgrades do not need documentation changes unless the dependency version itself is an operational constraint.
