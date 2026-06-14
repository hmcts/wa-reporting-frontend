# Snapshot table catalogue

This catalogue describes the runtime contract for analytics snapshot tables. Every table is read with `snapshot_id = :snapshotId`.

## Row tables

### `analytics.snapshot_open_task_rows`

Thin row store for row-backed open or otherwise not-completed task views.

Used by:

- `/users` assigned table and assigned count
- `/users` assigned total and priority summary when a `User` filter is active
- `/outstanding` critical tasks table

Population:

- Includes source rows where `state NOT IN ('COMPLETED', 'TERMINATED')`

Required columns:

- `snapshot_id`
- `task_id`
- `case_id`
- `task_name`
- `case_type_label`
- `jurisdiction_label`
- `role_category_label`
- `region`
- `location`
- `work_type`
- `state`
- `created_date`
- `first_assigned_date`
- `due_date`
- `major_priority`
- `assignee`
- `number_of_reassignments`

Notes:

- `/users` assigned table adds `state = 'ASSIGNED'`.
- `/outstanding` critical tasks adds the strict open-state set and `created_date IS NOT NULL`.
- Priority rank is calculated at query time from `major_priority`, `due_date`, and `CURRENT_DATE`.
- Child partitions create a User Overview partial index for default non-Judicial assigned-table reads ordered by `created_date DESC`.

### `analytics.snapshot_completed_task_rows`

Thin row store for completed-task row views.

Used by:

- `/users` completed table and completed row count
- `/completed` task audit

Population:

- Includes source rows where `LOWER(termination_reason) = 'completed'`

Required columns:

- `snapshot_id`
- `task_id`
- `case_id`
- `task_name`
- `jurisdiction_label`
- `role_category_label`
- `region`
- `location`
- `work_type`
- `created_date`
- `first_assigned_date`
- `due_date`
- `completed_date`
- `handling_time_days`
- `is_within_sla`
- `termination_process_label`
- `outcome`
- `major_priority`
- `assignee`
- `number_of_reassignments`
- `within_due_sort_value`

Notes:

- Runtime analytics queries no longer append `NULLS LAST` to completed-table sorts.
- Existing indexes continue to cover `completed_date`, `case_id`, and `within_due_sort_value` sorts used by User Overview.
- Child partitions create User Overview-specific non-Judicial partial indexes for default completed-table sorts on `created_date`, `first_assigned_date`, `due_date`, `handling_time_days`, `assignee`, `task_name`, `location`, and total assignments.

## User Overview completed facts

### `analytics.snapshot_user_completed_facts`

Assignee-aware completed-task facts for the User Overview page.

Used by:

- `/users` completed total
- `/users` completed summary
- `/users` completed by date
- `/users` completed by task name

Population:

- Source rows where `LOWER(termination_reason) = 'completed'` and `completed_date IS NOT NULL`
- Grouped by assignee, shared slicers, and `completed_date`

Required columns:

- `snapshot_id`
- `assignee`
- `jurisdiction_label`
- `role_category_label`
- `region`
- `location`
- `task_name`
- `work_type`
- `completed_date`
- `tasks`
- `within_due`
- `beyond_due`
- `handling_time_sum`
- `handling_time_count`
- `days_beyond_sum`
- `days_beyond_count`

Notes:

- `handling_time_sum` uses `COALESCE(handling_time_days, 0)`.
- `days_beyond_sum` uses refresh-time `days_beyond_due`, also with nulls treated as zero.
- `days_beyond_count` preserves `COUNT(*)` semantics for User Overview completed-by-task-name averages.
- User-filtered `/users` completed reads stay on this assignee-aware table.

### `analytics.snapshot_user_completed_daily_totals`

Date-only non-Judicial completed-task rollup for default User Overview completed paths.

Used by:

- `/users` completed summary when no `User` or shared slicer filter is selected
- `/users` completed by date when no `User` or shared slicer filter is selected

Population:

- Aggregated from `analytics.snapshot_user_completed_facts`
- Includes only rows where `completed_date IS NOT NULL`
- Excludes Judicial role category rows case-insensitively at refresh time
- Grouped by `completed_date`

Required columns:

- `snapshot_id`
- `completed_date`
- `tasks`
- `within_due`
- `beyond_due`
- `handling_time_sum`
- `handling_time_count`
- `days_beyond_sum`
- `days_beyond_count`

### `analytics.snapshot_user_completed_slicer_daily_facts`

No-assignee non-Judicial completed-task rollup for User Overview completed paths that still need shared slicers.

Used by:

- `/users` completed summary when no `User` filter is selected and at least one shared slicer filter is selected
- `/users` completed by date when no `User` filter is selected and at least one shared slicer filter is selected
- `/users` completed by task name when no `User` filter is selected

Population:

- Aggregated from `analytics.snapshot_user_completed_facts`
- Includes only rows where `completed_date IS NOT NULL`
- Excludes Judicial role category rows case-insensitively at refresh time
- Grouped by shared slicers, task name, and `completed_date`

Required columns:

- `snapshot_id`
- `jurisdiction_label`
- `role_category_label`
- `region`
- `location`
- `task_name`
- `work_type`
- `completed_date`
- `tasks`
- `within_due`
- `beyond_due`
- `handling_time_sum`
- `handling_time_count`
- `days_beyond_sum`
- `days_beyond_count`

Notes:

- These rollups intentionally omit `assignee`.
- Any selected `User` filter falls back to `analytics.snapshot_user_completed_facts`.
- The repository uses these rollups only for the standard User Overview query option that excludes Judicial role categories.

## Outstanding facts

### `analytics.snapshot_outstanding_due_status_daily_facts`

Page-scoped due-status fact table for the `/outstanding` tasks-due workload.

Used by:

- `/outstanding` tasks due chart
- `/outstanding` tasks due table

Population:

- Source rows where `due_date IS NOT NULL` and `task_status IN ('open', 'completed')`
- Grouped by shared slicers plus `due_date`
- Populated directly from `tmp_snapshot_fact_source`

Required columns:

- `snapshot_id`
- `due_date`
- `jurisdiction_label`
- `role_category_label`
- `region`
- `location`
- `task_name`
- `work_type`
- `open_task_count`
- `completed_task_count`

### `analytics.snapshot_outstanding_created_assignment_daily_facts`

Page-scoped created-date assignment fact table for the `/outstanding` open-tasks-by-created-date workload.

Used by:

- `/outstanding` open tasks by created date chart
- `/outstanding` open tasks by created date table

Population:

- Source rows where `created_date IS NOT NULL` and `task_status = 'open'`
- Grouped by shared slicers plus `reference_date = created_date` and `assignment_state`
- Populated directly from `tmp_snapshot_fact_source`

Required columns:

- `snapshot_id`
- `reference_date`
- `jurisdiction_label`
- `role_category_label`
- `region`
- `location`
- `task_name`
- `work_type`
- `assignment_state`
- `task_count`

## Completed dashboard facts

### `analytics.snapshot_completed_dashboard_facts`

Page-scoped completed-task fact table for `/completed` aggregate workloads.

Used by:

- `/completed` completed summary
- `/completed` completed timeline
- `/completed` completed by name, region, and location
- `/completed` processing and handling time

Population:

- Source rows where `completed_date IS NOT NULL` and `LOWER(termination_reason) = 'completed'`
- Grouped by shared slicers plus `reference_date = completed_date`
- Populated directly from `tmp_snapshot_fact_source`

Required columns:

- `snapshot_id`
- `reference_date`
- `jurisdiction_label`
- `role_category_label`
- `region`
- `location`
- `task_name`
- `work_type`
- `total_task_count`
- `within_task_count`
- `handling_time_days_sum`
- `handling_time_days_sum_squares`
- `handling_time_days_count`
- `processing_time_days_sum`
- `processing_time_days_sum_squares`
- `processing_time_days_count`

Notes:

- Processing and handling time reconstructs averages and population standard deviations from `sum`, `sum_squares`, and `count`.
- Summary, timeline, and processing/handling sections fall back to this table when any shared filter or role-exclusion query option is active.
- Region and region/location tables fall back to this table when service, role category, task name, or work type filters are active.

### `analytics.snapshot_completed_daily_metrics_facts`

Completed-task date rollup for default `/completed` summary, timeline, and processing/handling sections.

Used by:

- `/completed` completed summary when no shared filters or role-exclusion options are active
- `/completed` completed timeline when no shared filters are active
- `/completed` processing and handling time when no shared filters are active

Population:

- Source rows come from the same snapshot's `analytics.snapshot_completed_dashboard_facts` child partition.
- Grouped by `reference_date`.
- Populated during snapshot refresh after completed dashboard facts are loaded and before publish.

Required columns:

- `snapshot_id`
- `reference_date`
- `total_task_count`
- `within_task_count`
- `handling_time_days_sum`
- `handling_time_days_sum_squares`
- `handling_time_days_count`
- `processing_time_days_sum`
- `processing_time_days_sum_squares`
- `processing_time_days_count`

### `analytics.snapshot_completed_region_location_facts`

Completed-task date, region, and location rollup for `/completed` region/location tables.

Used by:

- `/completed` completed by region/location when filters are absent or limited to completed date, region, and location

Population:

- Source rows come from the same snapshot's `analytics.snapshot_completed_dashboard_facts` child partition.
- Grouped by `reference_date`, `region`, and `location`.
- Populated during snapshot refresh after completed dashboard facts are loaded and before publish.

Required columns:

- `snapshot_id`
- `reference_date`
- `region`
- `location`
- `total_task_count`
- `within_task_count`
- `handling_time_days_sum`
- `handling_time_days_count`
- `processing_time_days_sum`
- `processing_time_days_count`

Notes:

- The repository emits one `GROUPING SETS ((location, region), (region))` query so the service/view-model contract is unchanged.
- Filters on service, role category, task name, or work type must use `analytics.snapshot_completed_dashboard_facts`.

## Shared open and event facts

### `analytics.snapshot_open_due_daily_facts`

Open-task fact table for shared due/open aggregate workloads.

Used by:

- `/` service overview
- `/outstanding` open-task summary
- `/outstanding` open tasks by name
- `/outstanding` open tasks by region/location
- `/outstanding` tasks due by priority
- `/users` assigned total and priority summary when no `User` filter is active

Population:

- Source rows where `due_date IS NOT NULL`
- Only open-task classification: `state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED')`
- Grouped by shared slicers plus `due_date`, `priority`, and `assignment_state`

Required columns:

- `snapshot_id`
- `due_date`
- `jurisdiction_label`
- `role_category_label`
- `region`
- `location`
- `task_name`
- `work_type`
- `priority`
- `assignment_state`
- `task_count`

Notes:

- This table intentionally omits completed and created event slices.
- Priority buckets are derived at read time from `priority` and `due_date` so ageing snapshots preserve current semantics.

### `analytics.snapshot_task_event_daily_facts`

Overview event fact table for created, completed, and cancelled counts by date and shared slicers.

Used by:

- `/` task events by service when role category, region, location, task name, or work type filters are selected

Population:

- Created rows where `created_date IS NOT NULL`
- Completed rows where `completed_date IS NOT NULL` and `LOWER(termination_reason) = 'completed'`
- Cancelled rows where `completed_date IS NOT NULL` and `LOWER(termination_reason) = 'deleted'`
- Grouped by shared slicers plus `event_date` and `event_type`

Required columns:

- `snapshot_id`
- `event_date`
- `event_type`
- `jurisdiction_label`
- `role_category_label`
- `region`
- `location`
- `task_name`
- `work_type`
- `task_count`

Notes:

- This table intentionally omits `priority` and `task_status`.
- The refresh aggregates across those fields so Overview event counts cannot be duplicated by dimensions the UI never groups on.

### `analytics.snapshot_task_event_service_daily_facts`

Narrow Overview event rollup for created, completed, and cancelled counts by service and date.

Used by:

- `/` task events by service when only the event date range and optional service filters are selected

Population:

- Aggregated from `analytics.snapshot_task_event_daily_facts`
- Grouped by `event_date`, `event_type`, and `jurisdiction_label`

Required columns:

- `snapshot_id`
- `event_date`
- `event_type`
- `jurisdiction_label`
- `task_count`

Notes:

- Role category, region, location, task name, and work type filters use `analytics.snapshot_task_event_daily_facts` because this rollup intentionally drops those dimensions.

### `analytics.snapshot_wait_time_by_assigned_date`

Assigned-task wait-time facts.

Used by:

- `/outstanding` wait time by assigned date

Population:

- Source rows where `state = 'ASSIGNED'` and `wait_time_days IS NOT NULL`
- Grouped by shared slicers plus `first_assigned_date`

Required columns:

- `snapshot_id`
- `reference_date`
- `jurisdiction_label`
- `role_category_label`
- `region`
- `location`
- `task_name`
- `work_type`
- `total_wait_time_days_sum`
- `assigned_task_count`

## Facet tables

Facet table contracts live in [filter facets and mappings](filter-facets.md).
