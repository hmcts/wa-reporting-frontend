# Feature Specification: Tasks analytics portal

**Feature Branch**: `001-tasks-analytics-portal`  
**Created**: 2025-12-19  
**Status**: Draft  
**Input**: User description: "Build an application that can help business users visualise and interrogate "tasks" related data. It should include the followig pages: Overview (first two screenshots), Tasks Outstanding (third, fourth and fifth secreenshots), Tasks Completed (sixth, seventh and eighth screenshots), User Overview (ninth, tenth and eleventh screenshots). The capabilities in the included screenshots need to be included in the application."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View service overview (Priority: P1)

Business performance lead reviews the Overview dashboard with filters (service, role category, region, location, task name) to see open/assigned volumes and priority split by service, including totals.

**Why this priority**: Establishes a single high-level view of workload health for leadership decisions.

**Independent Test**: Load Overview with and without filters and confirm table totals update to reflect the selection with correct subtotals.

**Acceptance Scenarios**:

1. **Given** the Overview dashboard loads with default “All” filters, **When** the user views the service table, **Then** open, assigned, assigned %, and priority counts display for each service plus a total row.
2. **Given** a user selects specific service and region filters, **When** the dashboard reloads, **Then** the table and totals reflect only the filtered scope.

---

### User Story 2 - Analyse outstanding tasks (Priority: P1)

Operations manager examines outstanding tasks to see assignment split, priority mix, wait times, critical tasks, and due-date trends via charts and tables with chart/data-table toggles.

**Why this priority**: Enables proactive backlog management and risk mitigation for urgent work.

**Independent Test**: Apply filters, verify summary tiles and charts (assignment donut, priority donut, timelines, critical tasks table, due/due-priority charts, open tasks by name) all refresh consistently and match totals.

**Acceptance Scenarios**:

1. **Given** outstanding tasks are filtered by location and role category, **When** the user views summary donuts and charts, **Then** assigned/unassigned percentages and urgent/high/medium/low counts match the filtered dataset totals.
2. **Given** the user switches a chart to “Data table”, **When** they review the table, **Then** the numeric values match the chart currently displayed for the same filter selection.

---

### User Story 3 - Track completed tasks and timeliness (Priority: P2)

Service lead monitors completed tasks within a date range to see volumes, within-due-date compliance, and handling/processing times, with timelines and task-name breakdowns.

**Why this priority**: Demonstrates throughput and timeliness performance for reporting and compliance.

**Independent Test**: Select a date range and verify counts (completed today, within date range, within due date), timeline chart, compliance pie, completed-by-name bar chart, handling/processing time view, and task audit table all align numerically.

**Acceptance Scenarios**:

1. **Given** a date range and task name filter, **When** the completed tasks timeline renders, **Then** totals and compliance counts align with the summary figures for the same filters.
2. **Given** the user switches between handling time and processing time, **When** viewing the metric chart/table, **Then** averages and ranges update to the selected metric without altering the underlying filtered records.

---

### User Story 4 - Investigate workload per user (Priority: P3)

Team leader selects a user to inspect current assignments and completed tasks, with filters (service, role, region, location, task name, date range) and priority summaries.

**Why this priority**: Supports coaching, workload balancing, and audit needs at the individual level.

**Independent Test**: Choose a user and confirm the assigned tasks table, priority donut, completed tasks list, and completed-by-date chart all reflect only that user and respect additional filters.

**Acceptance Scenarios**:

1. **Given** a specific user and date range, **When** viewing assigned tasks, **Then** all rows show that user/assignee and counts match the priority donut totals.
2. **Given** the same user and filters, **When** reviewing completed tasks by date, **Then** volumes and compliance figures match the completed tasks list for that user.

### Edge Cases

- Filters that yield no results should display zero states and empty tables/charts without errors.
- Date ranges where start date is after end date should be validated with user-friendly guidance.
- Tasks with missing due dates or priorities should still appear in tables with “Not provided” labels and be excluded from due-date-specific calculations.
- Users or task names not present in the dataset should return a clear “no data” message while keeping other filters intact.
- Very large result sets should paginate or virtualize tables to prevent timeouts while keeping totals accurate.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Provide an Overview page with filters for service, role category, region, location, and task name, defaulting to “All” and applying selections across displayed metrics.
- **FR-002**: Display a service table on the Overview page showing open, assigned, assigned %, and priority counts (urgent, high, medium, low) with a total row that sums visible records.
- **FR-003**: Provide a Tasks Outstanding page that reuses the filter set and renders summary cards/donuts for open vs assigned/unassigned counts and priority mix, reflecting the active filters.
- **FR-004**: Render outstanding tasks charts with Chart/Data table toggle: open tasks over time (by created date), average wait time (by assigned date), tasks due vs completed by due date, open tasks due by priority, and open tasks by name grouped by priority.
- **FR-005**: Show a Critical tasks table ordered by selected ranking, including case ID, case type, location, task name, created date, due date, priority, and agent name, honoring the active filters.
- **FR-006**: Provide a Tasks Completed page with the common filters plus a completed-tasks date range, showing counts for completed today, completed within date range, within-due-date compliance, and a compliance pie/donut.
- **FR-007**: Render completed tasks charts with Chart/Data table toggle: completed tasks over time with compliance overlay, completed tasks by name segmented by due-date compliance, and completed tasks by task name with handling-time and days-beyond-due metrics.
- **FR-008**: Allow switching between handling time and processing time views, updating averages, ranges (±1 standard deviation), and associated data tables without changing the filtered task set.
- **FR-009**: Provide a Task Audit table filterable by case ID that lists task name, agent name, completed date, total assignments, location, and status for the selected case.
- **FR-010**: Provide a User Overview page with filters (service, role category, region, location, user, task name, completed date range) and visible user email list to select a specific user.
- **FR-011**: Display a currently assigned tasks table for the selected user showing case ID, created date, task name, assigned date, due date, priority, total assignments, assignee, and location with sortable columns.
- **FR-012**: Summarize user-level totals of assigned tasks by priority with a donut/pie chart and show completed tasks list plus completed-by-date chart, both restricted to the filtered user and date range.
- **FR-013**: Ensure all charts have an adjacent “Chart/Data table” toggle to view the same dataset in tabular form with matching totals and labels.
- **FR-014**: Provide clear empty/error states for filters that produce no data, invalid date ranges, or missing values, without breaking other filters or page navigation.

### Engineering Quality Requirements _(mandatory)_

- **EQ-001**: Code MUST follow established project conventions (lint rules, module boundaries, naming) with any
  intentional debt documented plus an exit plan.
- **EQ-002**: Shared utilities/interfaces MUST be extracted when reuse appears more than once; avoid duplication
  and keep files small enough for clear ownership.
- **EQ-003**: Developer-facing docs (README excerpts, inline comments where intent is non-obvious) MUST be
  updated to reflect new behavior and how to run it locally.

### Testing Requirements _(mandatory)_

- **TST-001**: Define unit tests for filter validation (invalid date ranges, unknown users/task names) and correct aggregation of totals when filters are applied.
- **TST-002**: Define route/contract tests for dashboard data endpoints covering Overview, Outstanding, Completed, User Overview, including Chart/Data table parity.
- **TST-003**: Define accessibility coverage (automated accessibility checks plus manual keyboard/screen reader notes) for filter controls, table sorting, Chart/Data table toggles, and chart legends.
- **TST-004**: Define smoke tests for happy paths: load each page with defaults, apply combined filters, toggle to data tables, and verify counts match summaries.

### Key Entities _(include if feature involves data)_

- **Task**: Work item with attributes including ID/case ID, service, task name, role category, priority, status (open/assigned/completed), created date, assigned date, due date, completed date, location, assigned user, and handling/processing durations.
- **User**: Person assigned to tasks, with role category, region, location, email, and task assignment/completion history.
- **Service**: Business area grouping tasks; used for filtering and aggregating metrics across dashboards.

### Experience & Accessibility Requirements _(mandatory)_

- **UX-001**: Interfaces MUST prefer GOV.UK Design System patterns and reuse GOV.UK Frontend components/macros:
  filtering controls, tabs, tables, summary lists/tiles, pagination, and accessible chart legends.
- **UX-002**: Content MUST follow the GOV.UK style guide; filter labels and summaries should use plain language (e.g., “Open tasks”, “Within due date”).
- **UX-003**: Accessibility MUST be demonstrated via automated accessibility testing plus manual keyboard/screen reader
  notes for filters, table sorting, Chart/Data table toggles, and chart legends; document responsive breakpoints down to 320 px.
- **UX-004**: Any deviations from GOV.UK guidance MUST include rationale and approval source; provide data-table alternatives for every chart and ensure color contrast for priority categories.

### Performance & Observability Requirements _(mandatory)_

- **PERF-001**: Default load of each dashboard (Overview, Outstanding, Completed, User) should complete within 3 seconds at p95 for typical datasets; filter changes should refresh visualizations within 2 seconds at p95.
- **PERF-002**: Instrument key actions (page load, filter apply, Chart/Data table toggle, empty-state occurrences) with event logging and error capture to trace data freshness issues.
- **PERF-003**: Profile rendering and data-fetch performance for large result sets (top 10k rows) and document how budgets are met.
- **PERF-004**: Dependencies MUST justify added weight (visualization and table handling) and document caching/pagination choices to keep interactions responsive.

## Assumptions & Dependencies

- Source task data already contains required fields (service, role category, region, location, priority, dates, assignee) and is available with sufficient freshness for dashboard use.
- User access and permissions to view task data are managed outside this feature; dashboards respect existing authentication/authorization.
- Priority definitions and due-date rules are consistent across services and supplied with the dataset used for calculations.
- Charting/table components support both visual and tabular views with accessible legends and pagination/virtualization for large datasets.
- Date and time representations follow a consistent timezone (e.g., UK) for all filters and calculations.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 95% of dashboard loads (all pages) complete within 3 seconds for default filters during UAT.
- **SC-002**: 95% of filter changes render updated tables/charts within 2 seconds and show matching totals across summaries and data tables.
- **SC-003**: 100% of charts provide a functional data-table view with identical counts/labels verified in testing.
- **SC-004**: At least 90% of pilot business users report they can locate outstanding tasks by service/priority and confirm totals within two interactions.
- **SC-005**: Compliance metrics (within-due-date counts and percentages) match authoritative dataset samples within ±1% for the selected date ranges.
