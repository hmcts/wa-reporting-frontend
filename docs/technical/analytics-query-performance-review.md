# Technical review: analytics query and schema performance

This document records the pre-redesign review that informed the current analytics schema. The implemented, current-state specification now lives in [docs/technical/data-sources.md](/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/docs/technical/data-sources.md), and the post-redesign benchmark pass lives in [docs/technical/analytics-benchmark-report.md](/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/docs/technical/analytics-benchmark-report.md).

## Scope
This document reviews the SQL read paths used by the analytics dashboards, how `scripts.sql` builds the `analytics` schema, and where the current design is likely to struggle once `cft_task_db.reportable_task` holds 3M+ rows.

The review is based on:
- `scripts.sql`
- `src/main/modules/analytics/shared/repositories/taskFactsRepository.ts`
- `src/main/modules/analytics/shared/repositories/taskThinRepository.ts`
- the functional dashboard specifications under `docs/functional/`

## Current workload summary

### Read paths actually used by the app
- Most overview, outstanding, and completed charts read `analytics.snapshot_task_daily_facts`.
- `/users` completed summary/count/by-date reads `analytics.snapshot_user_completed_facts`.
- Wait-time by assigned date reads `analytics.snapshot_wait_time_by_assigned_date`.
- Shared filter dropdowns read `analytics.snapshot_filter_facet_facts`.
- The expensive row-level reads still come from `analytics.snapshot_task_rows`:
  - `/users` assigned table
  - `/users` completed table
  - `/users` completed by task name
  - `/completed` task audit
  - `/completed` processing/handling time
  - `/outstanding` critical tasks

### Refresh flow built by `scripts.sql`
- Every refresh does a full rebuild.
- The procedure full-scans `cft_task_db.reportable_task` into `tmp_source_full`.
- It copies that data again into a new `snapshot_task_rows` partition.
- It then scans `snapshot_task_rows` multiple times to derive:
  - `snapshot_user_completed_facts`
  - `snapshot_task_daily_facts`
  - `snapshot_wait_time_by_assigned_date`
  - `snapshot_filter_facet_facts`
- Only `snapshot_task_rows` and `snapshot_task_daily_facts` are partitioned by `snapshot_id`.

## Findings

### 1. Snapshot partitioning helps publish/retention, not single-snapshot query speed
Every dashboard query filters to one published `snapshot_id`, so PostgreSQL can prune to one partition. After that, each request still scans or sorts within a single large child table. Partitioning by snapshot is therefore useful for atomic publish and retention cleanup, but it does not materially reduce the cost of querying the current 3M-row snapshot.

### 2. The refresh path repeatedly pays full-table cost
The current batch procedure does more full-volume work than needed:
- full scan from `reportable_task` into `tmp_source_full`
- full copy from `tmp_source_full` into `snapshot_task_rows`
- full scan for completed facts
- full scan for daily facts
- full scan for wait-time facts
- full scan for facet facts

At 3M+ rows, this is the main reason refresh cost rises almost linearly with source volume.

### 3. `snapshot_task_rows` is broader than the app needs
`snapshot_task_rows` is created with `LIKE cft_task_db.reportable_task INCLUDING DEFAULTS`, but the refresh only populates 29 of the 68 columns defined on the source table. The analytics row store therefore inherits a source-oriented shape rather than a query-oriented one.

That has three costs:
- wider heap rows and indexes than necessary
- more maintenance work during every snapshot build
- less freedom to design indexes around the actual dashboard queries

### 4. The warm path still has several row-scan bottlenecks
The most expensive runtime queries are still row-level:
- paged `/users` assigned table plus a separate `COUNT(*)`
- paged `/users` completed table plus a separate `COUNT(*)`
- paged `/outstanding` critical tasks plus a separate `COUNT(*)`
- `/users` completed by task name grouped directly from `snapshot_task_rows`
- `/completed` processing/handling time grouped directly from `snapshot_task_rows`
- `/completed` task audit ordered by `completed_date DESC` with no pagination

The `/users` page currently fetches assigned rows twice: once paginated for the table and once unpaginated for the summary/donut inputs. That duplicates a heavy query path inside a single request.

### 5. The facet precompute is high-cardinality and expensive to query
`snapshot_filter_facet_facts` groups by:
- service
- role category
- region
- location
- task name
- work type
- assignee

For large snapshots, that can approach row-level cardinality while still carrying a wide unique index. On top of that, building filter options runs 6 to 7 grouped scans of the same table and can do the whole cycle twice when filter canonicalisation triggers a second fetch.

### 6. Several read queries still compute derived values at query time
The current schema stores raw values and repeatedly derives:
- `LOWER(termination_reason)`
- `task_status`
- `assignment_state`
- priority bucket from `major_priority` and `due_date`
- interval-to-days conversions with `EXTRACT(EPOCH ...)`

That adds CPU cost to hot queries and makes indexing less effective, especially for dynamic sorts.

### 7. Some indexes are expensive without matching the real predicates well
The current design builds many per-snapshot btree indexes during refresh. A number of them are costly and only partially aligned with query patterns:
- wide slicer indexes depend on leftmost-column alignment, but dashboard filters are optional and used in varying combinations
- low-selectivity indexes on `priority`, `assignment_state`, and `sla_flag` may cost more to build than they save
- child-partition indexes include `snapshot_id`, even though each child table already has a single fixed `snapshot_id`

For attached child partitions, leading with `snapshot_id` is redundant physical index width.

### 8. The three non-partitioned fact tables create avoidable churn
`snapshot_user_completed_facts`, `snapshot_wait_time_by_assigned_date`, and `snapshot_filter_facet_facts` keep multiple snapshots in a single heap and are cleaned up by delete cascades rather than partition drops. That means:
- dead tuples
- vacuum pressure
- wider global indexes than necessary
- stale planner statistics unless they are explicitly analysed after refresh

## Recommended target design

### Principle
Keep row-level storage only for the parts of the UI that genuinely need individual task rows. Everything else should be facts-backed from tables shaped around the exact chart/table outputs.

### Recommended schema from scratch

#### 1. Replace `snapshot_task_rows` with two thin row tables
- `analytics.snapshot_open_task_rows`
  - only open/assigned/unassigned tasks
  - only columns needed by:
    - `/users` assigned table
    - `/outstanding` critical tasks
- `analytics.snapshot_completed_task_rows`
  - only completed tasks
  - only columns needed by:
    - `/users` completed table
    - `/completed` task audit

This reduces row counts per table, narrows each row, and lets indexes match the real sort/filter patterns.

#### 2. Split the generic daily fact table into purpose-built fact tables
- `analytics.snapshot_task_event_daily_facts`
  - for created/completed/cancelled event counts by date and service
- `analytics.snapshot_open_due_daily_facts`
  - for open-task summaries, due-date charts, priority charts, and region/location breakdowns
- `analytics.snapshot_completed_daily_facts`
  - for completed summary, timeline, by-name, by-region, and by-location
- `analytics.snapshot_wait_time_daily_facts`
  - keep the existing wait-time use case, but partition it by snapshot

This removes the current `date_role` and `task_status` multiplexing from one generic table and keeps each fact table smaller and easier to index.

#### 3. Extend completed facts so row-level aggregate queries disappear
The current row scans on completed tasks can be removed if completed facts also store:
- `task_count`
- `within_due_count`
- `handling_time_sum_zero_filled`
- `processing_time_sum_zero_filled`
- `days_beyond_sum_zero_filled`
- `handling_time_sum_squares`
- `processing_time_sum_squares`

With those values:
- `/users` completed by task name can read facts instead of `snapshot_task_rows`
- `/completed` processing/handling time can compute average and standard deviation from facts instead of row scans

#### 4. Precompute query-facing derived columns during refresh
Store these in snapshot tables instead of recomputing them on reads:
- `termination_reason_normalised`
- `task_status`
- `assignment_state`
- `priority_bucket`
- `handling_time_days`
- `processing_time_days`
- `days_beyond_due`
- `within_due_sort_value`

This makes both SQL and indexes simpler.

#### 5. Partition every snapshot table by `snapshot_id`
Apply the same partitioning strategy to:
- `snapshot_user_completed_facts`
- `snapshot_wait_time_by_assigned_date`
- `snapshot_filter_facet_facts` or its replacement tables

That keeps publish/retention consistent across all analytics tables and avoids delete-based churn.

#### 6. Replace the monolithic facet table
The current facet table is too generic for its cost. Prefer one of these designs:
- page-scoped facet tables:
  - overview/outstanding/completed facets without assignee
  - user-overview facets with assignee and judicial exclusion already applied
- or narrower per-facet aggregate tables if filter latency is still too high

The key requirement is to stop using one all-dimensions-plus-assignee table for every page.

## Tactical changes if the current shape must be kept temporarily

### Query changes
- Stop fetching `/users` assigned rows twice. Build the assigned summary/donut from a facts query.
- Move `/users` completed by task name onto facts by extending `snapshot_user_completed_facts`.
- Move `/completed` processing/handling time onto facts by storing `sum`, `count`, and `sum_squares`.
- Paginate or cap `/completed` task audit if unrestricted result sets are not required.
- If exact pagination counts remain necessary, keep them on the smallest possible row tables. Do not add more chart logic on top of those row queries.

### Refresh changes
- Remove `tmp_source_full` unless a narrow staging table is genuinely required.
- Stop cloning the source shape with `LIKE reportable_task`.
- Run `ANALYZE` on every snapshot-scoped fact table after loading, not only the two partitioned tables.

### Index changes
- On child partitions, remove `snapshot_id` from physical index keys.
- Prefer fewer, more targeted partial indexes over broad generic indexes.
- Bias indexes toward real row-table predicates:
  - open/assigned task lookups and sorts
  - completed task lookups and sorts
  - case-id audit lookups
  - due-date ordering for critical tasks

## Source-table implications

### What source indexes help today
Very little. The current snapshot refresh reads the whole source table, so additional indexes on `cft_task_db.reportable_task` will not materially improve the existing full-rebuild design.

### What source indexes matter if refresh becomes incremental
If analytics moves to delta refresh instead of full rebuild, the first source indexes to add are on the true change-watermark columns, for example:
- `update_id`
- `(update_id, task_id)`
- `(last_updated_date, update_id)` or `(report_refresh_time, update_id)` if one of those is the trusted incremental boundary

That is the point where source indexing becomes important. Until then, effort is better spent on reshaping the analytics schema.

## Priority order
1. Replace the generic row snapshot with thin open/completed row tables.
2. Move row-level completed aggregates onto completed facts.
3. Partition every snapshot table by `snapshot_id`.
4. Replace the current facet table with page-scoped or narrower facet facts.
5. Remove redundant refresh copying and recomputed read-time expressions.

## Conclusion
The current design is already better than querying `reportable_task` directly, but it still carries too much row-level and generic-aggregate cost into both refresh and runtime. The strongest redesign is to make the analytics schema match the dashboard workload directly:
- thin row tables only where pagination/audit requires them
- separate facts for open, completed, event, and wait-time workloads
- partition all snapshot tables
- precompute the derived values the UI actually uses

That is the clearest route to stable performance once source volume moves beyond 3M rows.
