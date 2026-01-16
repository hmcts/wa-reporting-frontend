# Implementation Plan: Tasks analytics portal

**Branch**: `001-tasks-analytics-portal` | **Date**: 2025-12-19 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-tasks-analytics-portal/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Deliver a GOV.UK-styled tasks analytics portal with four dashboards (Overview, Tasks Outstanding, Tasks Completed, User Overview) that let business users filter by service/role/region/location/task/user/date ranges, view Plotly-powered charts with data-table toggles, and inspect tables for critical tasks, audit history, and user-level workloads. Backend will serve mock data (no live integrations yet) via Express 5 endpoints, rendered through Nunjucks templates using govuk-frontend components; Plotly powers charts, with accessibility-compliant data tables for every chart.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript on Node.js (align to project baseline; upgrade path to Node 20 per constitution)  
**Primary Dependencies**: Express 5, Nunjucks/express-nunjucks, govuk-frontend components, Plotly for charts, axios for potential data fetch, lodash for aggregations  
**Storage**: None (mocked in-memory datasets served by backend)  
**Testing**: Jest (unit/route), supertest (routes), pa11y/jest-a11y (accessibility), Codecept/Playwright for smoke/functional where applicable  
**Target Platform**: Server-rendered web app (Express + Nunjucks) running in container; browsers consuming GOV.UK-styled pages  
**Project Type**: Web application (single repo with server-rendered views and static assets)  
**Performance Goals**: Dashboard initial loads ≤3s p95; filter interactions ≤2s p95; support rendering top 10k rows via pagination/virtualization  
**Constraints**: GOV.UK styling, accessible Chart/Data table toggles, no live data integrations; mock data must mirror expected shapes; adhere to security defaults (Helmet/CSRF)  
**Scale/Scope**: Four dashboards, multiple filters, chart/table parity, mock data only; initial scope limited to read-only analytics

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

1. **Code Quality Is Non-Negotiable** – Use existing Express/Nunjucks module boundaries; add govuk-frontend + Plotly integration with linted TypeScript utilities; document mock data modules and exit plan for real data in README/quickstart. No deliberate debt beyond temporary mock data.
2. **Tests Define Release Readiness** – Add/extend Jest unit + aggregation tests, route/contract tests for analytics endpoints, a11y coverage on filters/toggles/tables, and smoke path for page load + filter apply. Locate tests in `src/test/unit`, `src/test/routes`, `src/test/a11y`, `src/test/smoke`.
3. **GOV.UK Experience Consistency** – Reuse govuk-frontend filters (select, date inputs), tabs, tables, summary lists/tiles; Plotly charts paired with accessible data tables; color palette and contrast per GOV.UK; deviations only if Plotly default colors need mapping to GOV.UK palette (documented with screenshots).

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
specs/001-tasks-analytics-portal/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/

src/
├── main/
│   ├── app.ts
│   ├── server.ts
│   ├── modules/            # feature modules; add analytics module with routes/controllers/services
│   ├── routes/             # route registration; add analytics routes
│   ├── views/              # Nunjucks templates; add dashboard pages with govuk-frontend + Plotly hooks
│   ├── assets/             # scss/js entries; add Plotly bundling + GOV.UK styling hooks
│   └── public/             # static assets
└── test/                   # existing tests
    ├── unit/
    ├── routes/
    ├── a11y/
    ├── smoke/
    └── functional/
```

**Structure Decision**: Single Express/Nunjucks web app; add analytics module under `src/main/modules` plus views/assets; keep tests under `src/test/*` per constitution.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |

## Phase 0: Outline & Research

- Unknowns/clarifications: None flagged; scope is mock-data-only dashboards using existing stack.
- Research tasks dispatched:
  - Best practices for combining Plotly charts with GOV.UK styling and accessible data-table toggles in server-rendered Nunjucks pages.
  - Mock data strategy for analytics: shape, pagination/virtualization, and keeping chart/table totals in sync.
  - Route/contract patterns for read-only analytics endpoints in Express (with CSRF/Helmet intact) and alignment with existing test layout.
- Output: `research.md` summarizing decisions, rationale, alternatives (see file for details).

## Phase 1: Design & Contracts

- Data model: capture Task, User, Service, plus Aggregates for summary metrics; define required fields (service, role category, region, location, priority, created/assigned/due/completed dates, statuses, counts, handling/processing times).
- API contracts: read-only endpoints for `/analytics/overview`, `/analytics/outstanding`, `/analytics/completed`, `/analytics/users/{userId}`, `/analytics/task-audit/{caseId}` returning filtered datasets with chart/table-friendly shapes; Chart/Data table parity enforced.
- Quickstart: document yarn install/build, running server with mock data enabled, and commands for lint/test (unit, routes, a11y, smoke) plus how to view dashboards locally.
- Agent context: run `.specify/scripts/bash/update-agent-context.sh codex` after adding design outputs to record Plotly + mock-data additions.

## Phase 2: Delivery Planning (next)

- Not in scope for this command; will be populated during `/speckit.tasks` after design sign-off.

## Constitution Re-Check (post-Phase 1 design)

- Quality: Keep analytics logic in services with typed DTOs; lint/type checks required before PR.
- Tests: Unit tests for aggregations/filter validation; route/contract tests per endpoint; pa11y/jest-a11y for filters/toggles/tables; smoke tests for happy-path page load/filter apply.
- GOV.UK: Use govuk-frontend selects, date inputs, tables, tabs, summary tiles; map Plotly colors to GOV.UK palette and always supply data-table alternatives.
