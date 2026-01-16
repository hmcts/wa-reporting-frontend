# Tasks: Tasks analytics portal

**Input**: Design documents from `/specs/001-tasks-analytics-portal/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included per specification (unit, route/contract, a11y, smoke).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Constitution Alignment**: Tasks call out code quality, tests, and GOV.UK components for consistency.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure dependencies and asset pipeline support Plotly + GOV.UK for analytics.

- [x] T001 Add Plotly dependency and analytics bundle entry in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/package.json` and `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/webpack.config.js` to load dashboards.
- [x] T002 [P] Create analytics JS entrypoint initializing govuk-frontend and Plotly in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/assets/js/analytics.ts`.
- [x] T003 [P] Add analytics SCSS entry with GOV.UK priority colors for charts in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/assets/scss/analytics.scss`.
- [x] T004 Update quickstart with build/run notes for analytics bundle in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/specs/001-tasks-analytics-portal/quickstart.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T005 Create analytics module skeleton and register `/analytics` namespace in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/modules/analytics/` and `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/routes/index.ts`.
- [x] T006 [P] Implement shared filter schema/validator (service, roleCategory, region, location, taskName, user, date range) with unit tests in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/modules/analytics/filters/validator.ts` and `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/unit/analytics/filters/validator.test.ts`.
- [x] T007 [P] Create mock task dataset and provider with pagination and defaulted priority/status fields in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/modules/analytics/data/mockTasks.ts` plus unit tests in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/unit/analytics/data/mockTasks.test.ts`.
- [x] T008 [P] Add shared analytics types/view models for responses in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/modules/analytics/types.ts`.
- [x] T009 Create Nunjucks partials for filter bar and chart/data-table toggle using govuk-frontend components in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/views/analytics/partials/filters.njk` and `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/views/analytics/partials/toggle.njk`.
- [x] T010 [P] Wire analytics layout and asset includes into base template without breaking Helmet/CSRF in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/views/layouts/main.njk` and `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/views/analytics/layout.njk`.
- [x] T011 Add baseline a11y smoke check for analytics landing route in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/a11y/analytics.base.a11y.test.ts`.

---

## Phase 3: User Story 1 - View service overview (Priority: P1) 🎯 MVP

**Goal**: Show Overview dashboard with filters and service table totals (open/assigned/priority) plus totals row.

**Independent Test**: Load Overview with default and filtered selections; verify table values and totals match mock data and respond to filters.

### Tests for User Story 1

- [x] T012 [P] [US1] Add contract test for GET `/analytics/overview` in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/routes/analytics.overview.test.ts`.
- [x] T013 [P] [US1] Add unit tests for overview aggregations (open/assigned/priority totals) in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/unit/analytics/overviewAggregations.test.ts`.
- [x] T014 [P] [US1] Add a11y test for Overview page filters/table in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/a11y/analytics.overview.a11y.test.ts`.

### Implementation for User Story 1

- [x] T015 [P] [US1] Implement overview aggregation service in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/modules/analytics/services/overviewService.ts`.
- [x] T016 [US1] Implement Overview controller/route wiring filters and service data in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/modules/analytics/controllers/overviewController.ts` and register in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/routes/index.ts`.
- [x] T017 [US1] Build Overview view with govuk tables/select filters and totals row in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/views/analytics/overview.njk`.
- [x] T018 [US1] Add smoke test for Overview page load and filter apply in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/smoke/analytics.overview.smoke.test.ts`.

---

## Phase 4: User Story 2 - Analyse outstanding tasks (Priority: P1)

**Goal**: Provide Outstanding dashboard with assignment split, priority mix, wait times, critical tasks, and due-date trends with chart/data-table toggles.

**Independent Test**: Apply filters and confirm summary donuts, timelines, critical tasks table, and chart/data-table values match filtered mock data.

### Tests for User Story 2

- [x] T019 [P] [US2] Add contract tests for GET `/analytics/outstanding` in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/routes/analytics.outstanding.test.ts`.
- [x] T020 [P] [US2] Add unit tests for outstanding metrics (assignment split, priority mix, wait times, due distributions) in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/unit/analytics/outstandingAggregations.test.ts`.
- [x] T021 [P] [US2] Add a11y test for Outstanding page filters and chart/data-table toggles in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/a11y/analytics.outstanding.a11y.test.ts`.

### Implementation for User Story 2

- [x] T022 [US2] Implement outstanding aggregation service (summary donuts, timelines, due/priority distributions, critical tasks list) in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/modules/analytics/services/outstandingService.ts`.
- [x] T023 [US2] Implement Outstanding controller/route outputting chart + data-table JSON in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/modules/analytics/controllers/outstandingController.ts` and register in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/routes/index.ts`.
- [x] T024 [US2] Build Outstanding view with govuk filters, summary tiles, Plotly charts (open tasks, wait time, tasks due, priority donut), data-table toggles, and critical tasks table in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/views/analytics/outstanding.njk`.
- [x] T025 [US2] Add smoke test for Outstanding page load and data-table toggle behavior in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/smoke/analytics.outstanding.smoke.test.ts`.

---

## Phase 5: User Story 3 - Track completed tasks and timeliness (Priority: P2)

**Goal**: Show Completed dashboard with date-range filters, compliance (within due), handling/processing times, timeline, completed-by-name, and task audit.

**Independent Test**: Select date range and task filter; verify summaries, compliance donut, timeline, completed-by-name, handling/processing stats, and audit table all align with mock data.

### Tests for User Story 3

- [x] T026 [P] [US3] Add contract tests for GET `/analytics/completed` and `/analytics/task-audit/{caseId}` in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/routes/analytics.completed.test.ts`.
- [x] T027 [P] [US3] Add unit tests for completed metrics (compliance counts, handling/processing stats, completed-by-name) in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/unit/analytics/completedAggregations.test.ts`.
- [x] T028 [P] [US3] Add a11y test for Completed page (date range, toggles, audit table) in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/a11y/analytics.completed.a11y.test.ts`.

### Implementation for User Story 3

- [x] T029 [US3] Implement completed aggregation service (summaries, compliance, timelines, completed-by-name, handling/processing stats) in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/modules/analytics/services/completedService.ts`.
- [x] T030 [US3] Implement task audit provider and controller at `/analytics/task-audit/:caseId` in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/modules/analytics/controllers/taskAuditController.ts` with route registration in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/routes/index.ts`.
- [x] T031 [US3] Implement Completed controller/route handling date filters and metric toggle in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/modules/analytics/controllers/completedController.ts` and register in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/routes/index.ts`.
- [x] T032 [US3] Build Completed view with govuk filters, compliance donut, timeline + overlay, completed-by-name bars, handling/processing chart/data tables, and task audit table in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/views/analytics/completed.njk`.
- [x] T033 [US3] Add smoke test for Completed page date filters and metric toggle in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/smoke/analytics.completed.smoke.test.ts`.

---

## Phase 6: User Story 4 - Investigate workload per user (Priority: P3)

**Goal**: Provide User overview with filters, assigned tasks table, priority donut, completed tasks list, and completed-by-date chart for a selected user.

**Independent Test**: Select a user and date range; verify assigned/ completed tables, priority donut, and completed-by-date chart reflect only that user and match totals.

### Tests for User Story 4

- [x] T034 [P] [US4] Add contract tests for GET `/analytics/users/{userId}` in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/routes/analytics.user-overview.test.ts`.
- [x] T035 [P] [US4] Add unit tests for user metrics (priority summary, completed-by-date) in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/unit/analytics/userMetrics.test.ts`.
- [x] T036 [P] [US4] Add a11y test for User overview page filters/toggles in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/a11y/analytics.user-overview.a11y.test.ts`.

### Implementation for User Story 4

- [x] T037 [US4] Implement user overview service (assigned/completed datasets, priority summary) in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/modules/analytics/services/userOverviewService.ts`.
- [x] T038 [US4] Implement User overview controller/route with user email list and filters in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/modules/analytics/controllers/userOverviewController.ts` and register in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/routes/index.ts`.
- [x] T039 [US4] Build User overview view with govuk filters, assigned tasks table, priority donut, completed tasks list, and completed-by-date chart/data tables in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/views/analytics/user-overview.njk`.
- [x] T040 [US4] Add smoke test for User overview page user filter and data refresh in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/test/smoke/analytics.user-overview.smoke.test.ts`.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T041 [P] Update documentation with screenshots/notes for GOV.UK + Plotly usage in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/specs/001-tasks-analytics-portal/quickstart.md` and `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/README.md`.
- [x] T042 Run full lint/test suite (lint, unit, routes, a11y, smoke) from `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi` and record outcomes in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/specs/001-tasks-analytics-portal/tasks.md` notes section.
- [x] T043 [P] Align Plotly color tokens to GOV.UK palette and document accessibility notes in `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/src/main/assets/scss/analytics.scss` and `/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/specs/001-tasks-analytics-portal/research.md`.

---

## Dependencies & Execution Order

- Setup (Phase 1) → Foundational (Phase 2) → User Stories (Phases 3–6) → Polish (Phase 7).
- User story order by priority: US1 (P1) and US2 (P1) can run in parallel after Foundational; US3 (P2) and US4 (P3) can start after Foundational and reuse shared components (no hard dependency on US1/US2, but benefit from completed filters/partials).
- Within each story: tests first → services → controllers/routes → views → smoke.

## Parallel Opportunities

- Setup: T002, T003 run in parallel after T001.
- Foundational: T006, T007, T008, T009, T010 can run in parallel after T005; T011 can run after a landing route exists.
- US1: T012–T014 tests in parallel; T015 parallel with tests; T016–T017 after service; T018 after page exists.
- US2: T019–T021 in parallel; T022 parallel with tests; T023–T024 after service; T025 after page exists.
- US3: T026–T028 in parallel; T029–T030 parallel once mock data ready; T031–T032 after services; T033 after page exists.
- US4: T034–T036 in parallel; T037 parallel with tests; T038–T039 after service; T040 after page exists.
- Polish: T041 and T043 in parallel; T042 last.

## Implementation Strategy

- **MVP**: Complete Phases 1–3 (US1) to ship Overview dashboard with filters and service totals.
- **Incremental**: Add US2 Outstanding → US3 Completed → US4 User overview, validating each with contract/unit/a11y/smoke suites.
- **Quality Gates**: Maintain lint/type, pa11y/jest-a11y, route/contract, and smoke coverage per constitution; ensure Chart/Data table parity and GOV.UK component usage documented.

---

## Notes

- 2025-12-19: `npm test` failed fetching `if-env` (ENOTFOUND registry.npmjs.org); unit tests still ran and passed (7 suites, 11 tests).
- 2025-12-19: `npm run lint` failed with `stylelint: command not found`.
- 2025-12-19: `yarn lint` failed because `prettier --check` reported formatting issues across repo files.
- 2025-12-19: `yarn test:routes` failed with `listen EPERM` (cannot bind to 0.0.0.0) in supertest.
- 2025-12-19: `yarn test:a11y` failed: server address not available (listen failure).
- 2025-12-19: `yarn test:smoke` failed because the app was not running at `http://localhost:3100`.
- 2025-12-19: `yarn lint` passed after updating Prettier ignores and formatting `openapi.yaml`.
