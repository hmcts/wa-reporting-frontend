# Data sources and data model

## Databases
The application connects to three PostgreSQL databases using Prisma clients and raw SQL:

1) Task Management analytics database (tm)
- Purpose: aggregated and per-task analytics for work allocation tasks.
- Prisma client: `tmPrisma`.
- Config prefix: `database.tm`.

2) Caseworker reference database (crd)
- Purpose: caseworker profiles for user display names.
- Prisma client: `crdPrisma`.
- Config prefix: `database.crd`.

3) Location reference database (lrd)
- Purpose: region and court venue descriptions.
- Prisma client: `lrdPrisma`.
- Config prefix: `database.lrd`.

Connection building:
- Uses `database.<prefix>.url` when provided; otherwise builds from host/port/user/password/db_name/schema.
- Optional `schema` is passed via PostgreSQL `search_path` in the connection string.

```mermaid
flowchart TB
  App["Analytics module"] --> TMRepo["Task facts + thin repositories"]
  App --> RefSvc["Reference data services"]
  TMRepo --> TM["TM analytics DB"]
  RefSvc --> CRD["CRD DB (caseworkers)"]
  RefSvc --> LRD["LRD DB (regions/locations)"]
  TM --> Snapshots["Analytics snapshot tables (snapshot_*)"]
  Snapshots --> Dashboards["Dashboards"]
```

## Core analytics snapshot tables (tm database)
The application relies on published snapshot tables in the `analytics` schema. Snapshot data tables are version-ranged and queried as-of a selected snapshot id:

- `valid_from_snapshot_id <= :snapshotId`
- `valid_to_snapshot_id IS NULL OR valid_to_snapshot_id > :snapshotId`

Minimum columns required are listed below (based on query usage).

### analytics.snapshot_batches
Snapshot metadata and immutable date context for query-time priority rank calculation.

Required columns:
- snapshot_id
- as_of_date
- status
- started_at
- completed_at
- window_start
- window_end

### analytics.snapshot_task_daily_facts
Used for service overview, events, timelines, and completion summaries.

Required columns:
- valid_from_snapshot_id
- valid_to_snapshot_id
- jurisdiction_label (service)
- role_category_label
- region
- location
- task_name
- work_type
- assignment_state (Assigned/Unassigned/null)
- task_status (open/completed/cancelled/other)
- date_role (created/completed/cancelled/due)
- reference_date (date)
- task_count (integer)
- priority (numeric priority)
- sla_flag (boolean)
- handling_time_days_sum
- handling_time_days_count
- processing_time_days_sum
- processing_time_days_count

### analytics.snapshot_task_rows
Used for per-task lists (user overview, critical tasks, task audit) and processing/handling time.

Required columns:
- valid_from_snapshot_id
- valid_to_snapshot_id
- case_id
- task_id
- task_name
- case_type_label
- jurisdiction_label
- role_category_label
- work_type
- region
- location
- created_date
- first_assigned_date
- due_date
- completed_date
- handling_time_days
- handling_time (interval)
- processing_time_days
- processing_time (interval)
- is_within_sla (Yes/No/null)
- state (ASSIGNED/COMPLETED/TERMINATED/etc)
- termination_reason
- termination_process_label
- outcome
- major_priority (numeric)
- assignee
- number_of_reassignments
- within_due_sort_value (indexed sort rank for within-due ordering)

Note:
- Priority rank is calculated at query-time from `major_priority`, `due_date`, and the selected snapshot `as_of_date`.
- Row-level repositories return numeric `priority_rank`; labels are mapped in TypeScript when building UI-facing models.

### analytics.snapshot_user_completed_facts
Used for user overview aggregated charts.

Required columns:
- valid_from_snapshot_id
- valid_to_snapshot_id
- completed_date
- task_name
- work_type
- tasks
- within_due
- beyond_due
- handling_time_sum
- handling_time_count
- days_beyond_sum
- days_beyond_count
- assignee (for user filtering)

### analytics.snapshot_wait_time_by_assigned_date
Used for wait time by assigned date.

Required columns:
- valid_from_snapshot_id
- valid_to_snapshot_id
- reference_date
- work_type
- assigned_task_count
- total_wait_time (interval)

## Reference data (crd and lrd databases)

### CRD: vw_case_worker_profile
Used to map assignee IDs to names.
On `/outstanding` Critical tasks only, if an assignee ID is present and no CRD match is found, the UI displays `Judge` instead of the raw ID.

Required columns:
- case_worker_id
- first_name
- last_name
- email_id
- region_id

### LRD: region
Used for region descriptions.

Required columns:
- region_id
- description

### LRD: court_venue
Used for location descriptions.

Required columns:
- epimms_id
- site_name
- region_id

## Filter mapping to database columns
The shared filter block maps UI filters to database columns in analytics views:
- Service -> jurisdiction_label
- Role category -> role_category_label
- Region -> region
- Location -> location
- Task name -> task_name
- Work type -> work_type
- User -> assignee (only in user overview and related queries)

Work type display values:
- The filter still submits `work_type` IDs for querying.
- Dropdown labels are sourced from `cft_task_db.work_types.label` with fallback to the ID when no label is present.

Date filters:
- completedFrom/completedTo -> completed_date in snapshot_task_rows or reference_date in snapshot_task_daily_facts.
- eventsFrom/eventsTo -> reference_date in snapshot_task_daily_facts for created/completed/cancelled events.
- User Overview page applies an additional scoped exclusion: `UPPER(role_category_label) <> 'JUDICIAL'` (null-safe), and this scoped rule is not applied on `/`, `/outstanding`, or `/completed`.

## Derived concepts and calculations

### Priority rank and label mapping
Priority is calculated in SQL as a numeric rank using `major_priority` or `priority` with a due-date-aware rule against the selected snapshot `as_of_date`:
- <= 2000 => 4
- < 5000 => 3
- == 5000 and due_date < as_of_date => 3
- == 5000 and due_date == as_of_date => 2
- else => 1

SQL compares rank numbers only. UI-facing labels are mapped in TypeScript:
- 4 => Urgent
- 3 => High
- 2 => Medium
- 1 (and fallback) => Low

### Within due date
Within due date is computed as:
- `is_within_sla == 'Yes'` if present
- Otherwise, compare completed_date <= due_date

### Completed-task determination
Completed tasks are determined by case-insensitive `termination_reason = 'completed'` across thin/facts query paths. Completed-state values such as `COMPLETED` or `TERMINATED` are not required for completed classification.

### Created-event determination
Created events in task daily facts are determined by `created_date IS NOT NULL` (case state does not gate inclusion). For `date_role = 'created'`, `task_status` is derived as:
- `completed` when `LOWER(termination_reason) = 'completed'`
- `open` when `state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED')`
- `other` otherwise

For `date_role = 'created'`, `assignment_state` is:
- `Assigned` when `state = 'ASSIGNED'`
- `Unassigned` when `state IN ('UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED')`
- `NULL` otherwise

## Caching
NodeCache caches these datasets to reduce repeated lookups:
- Filter options
- Caseworker profiles and names
- Regions and region descriptions
- Court venues and location descriptions

Cache TTL is configurable via `analytics.cacheTtlSeconds`.
