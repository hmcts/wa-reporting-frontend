# Change recipes

Use these recipes before editing common areas. They list the usual files to inspect, likely files to change, docs to update, and verification to run. They are not a replacement for reading nearby code and tests.

## Add or change a dashboard section

Inspect:

- `docs/functional/shared-dashboard-behaviour.md`
- The relevant page spec under `docs/functional/`
- `src/main/modules/analytics/<page>/`
- `src/main/views/analytics/<page>/`
- Existing tests under `src/test/unit/analytics/<page>/`, `src/test/routes/`, `src/test/functional/`, and `src/test/a11y/`

Usually change:

- `controller.ts` if routing, partial selection, or AJAX handling changes
- `page.ts` if section composition, fallback, or section error behaviour changes
- `service.ts` or `visuals/*Service.ts` for data orchestration
- `viewModel.ts` for template-facing shape
- `visuals/charts.ts` for Plotly config
- `src/main/views/analytics/<page>/partials/*.njk`

Docs to update:

- Relevant dashboard spec
- `docs/functional/shared-dashboard-behaviour.md` if the behaviour is shared
- Data-source docs if query routing or metric semantics change

Verification:

- Unit tests for service/view-model/chart behaviour
- Route tests for partial/full response handling
- Functional/a11y tests when user-facing flow changes
- Mandatory non-doc commands from `AGENTS.md`

## Add or change a shared filter

Inspect:

- `docs/functional/shared-dashboard-behaviour.md`
- `docs/technical/data-sources/filter-facets.md`
- `src/main/modules/analytics/shared/filters/`
- `src/main/modules/analytics/shared/repositories/*FilterFactsRepository.ts`
- `src/main/views/analytics/partials/shared-filters.njk`
- `src/main/assets/js/analytics/forms.ts`

Usually change:

- Filter parsing and validation
- Filter option view models
- Page-scoped facet repository SQL
- Nunjucks filter partials
- Cookie persistence logic when the persisted shape changes

Docs to update:

- Shared dashboard behaviour
- Filter facets and mappings
- Glossary if the filter introduces new vocabulary
- Dashboard specs that expose the filter

Verification:

- Unit tests for parser/validator/view model
- Repository SQL tests for filter semantics
- Route tests for cookie, reset, and facet refresh behaviour
- Functional tests for the affected page

## Add a snapshot table or rollup

Inspect:

- `docs/technical/data-sources/README.md`
- `docs/technical/data-sources/snapshot-lifecycle.md`
- `docs/technical/data-sources/snapshot-tables.md`
- `docs/technical/data-sources/repository-ownership.md`
- `db/migrations/tm/`
- `db/current-state/tm-analytics-schema.sql`
- `src/main/modules/analytics/shared/repositories/`

Usually change:

- New Flyway migration under `db/migrations/tm/`
- Current-state SQL mirror
- One new table-scoped repository
- A coordinator/service that chooses the new table only when exact
- Focused repository and service tests

Docs to update:

- Snapshot lifecycle if refresh/publish shape changes
- Snapshot table catalogue
- Repository ownership map
- Derived metrics if the table materialises new calculations
- Relevant dashboard spec

Verification:

- Unit tests for repository SQL and coordinator routing
- Focused mutation tests when analytics logic is mutation-sensitive
- Mandatory non-doc commands from `AGENTS.md`

## Change a chart

Inspect:

- Relevant dashboard spec
- `docs/technical/frontend.md`
- `src/main/modules/analytics/shared/charts/`
- `src/main/modules/analytics/<page>/visuals/charts.ts`
- `src/main/assets/js/analytics/charts.ts`

Usually change:

- Chart builder
- Shared chart helper only when behaviour is reused
- View model if chart data shape changes
- Nunjucks partial if tabs, labels, or data attributes change

Docs to update:

- Relevant dashboard spec
- Frontend spec when shared chart behaviour changes
- Derived metrics if chart semantics change

Verification:

- Unit tests for serialized Plotly config
- Functional/a11y tests when chart/table tabs or accessible alternatives change

## Change AJAX partial refresh

Inspect:

- `docs/functional/shared-dashboard-behaviour.md`
- `docs/technical/frontend.md`
- Relevant controller and page builder
- `src/main/modules/analytics/shared/partials.ts`
- `src/main/assets/js/analytics/ajax.ts`
- Nunjucks partials with `data-section`

Usually change:

- Controller section selection
- Page builder to fetch only requested data
- Partial template and `data-section` wrapper
- Client refresh/reinitialisation logic only when shared behaviour changes

Docs to update:

- Shared dashboard behaviour
- Frontend spec
- Relevant dashboard spec for section-specific exceptions

Verification:

- Route tests for `X-Requested-With: fetch`, `ajaxSection`, and partial rendering
- Unit tests for page builder data minimisation and section errors
- Functional/a11y tests for replaced section behaviour

## Change sorting or pagination

Inspect:

- `docs/functional/shared-dashboard-behaviour.md`
- Relevant dashboard spec
- `src/main/modules/analytics/shared/pagination.ts`
- `src/main/modules/analytics/shared/sorting.ts`
- Page-specific sort helpers such as `outstandingSort.ts` or `userOverviewSort.ts`
- Row-backed repositories used by the affected table

Usually change:

- Sort mapping and validation
- Repository `ORDER BY` contract
- Hidden input state in Nunjucks
- Page-object helpers if functional tests drive sorting/pagination

Docs to update:

- Relevant dashboard spec
- Shared dashboard behaviour if the common cap or hidden-input contract changes
- Security doc if pagination safeguards change

Verification:

- Unit tests for sort validation and URL/form state
- Repository SQL tests for ordering
- Route tests for clamping and invalid input

## Add config or a secret

Inspect:

- `docs/technical/configuration.md`
- `config/default.json`
- `config/custom-environment-variables.yaml`
- `charts/wa-reporting-frontend/values.yaml`
- `charts/wa-reporting-frontend/values.preview.template.yaml`
- `src/main/modules/properties-volume/`

Usually change:

- Default config value
- Environment-variable mapping
- Helm secret list when the value is secret-backed
- Runtime config reader with explicit type
- Tests for config fallback/override behaviour

Docs to update:

- Configuration reference
- Runtime/build or operations docs when the setting changes operational behaviour
- Security doc when the value affects auth, sessions, cookies, headers, or CSRF

Verification:

- Unit tests for config consumption
- Mandatory non-doc commands from `AGENTS.md`

## Change security, session, OIDC, Helmet, or CSRF behaviour

Inspect:

- `docs/technical/security.md`
- `docs/technical/configuration.md`
- `src/main/modules/session/`
- `src/main/modules/oidc/`
- `src/main/modules/helmet/`
- `src/main/modules/csrf/`
- Related unit tests under `src/test/unit/modules/`

Usually change:

- Module wrapper
- Config mapping when behaviour becomes configurable
- Route/app tests when request lifecycle changes
- Security-sensitive unit tests with full configuration assertions

Docs to update:

- Security and authentication
- Configuration reference
- Testing and quality if expected security assertions change

Verification:

- Unit tests covering full security-relevant configuration contract
- Route tests for auth/session/CSRF outcomes
- Mandatory non-doc commands from `AGENTS.md`
