# Technical report: post-redesign analytics benchmarks

This document records the current benchmark and query-plan review for the implemented `analytics` schema.

The pre-redesign rationale and original findings remain in [docs/technical/analytics-query-performance-review.md](/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/docs/technical/analytics-query-performance-review.md). The implemented schema and data-shaping decisions are documented in [docs/technical/data-sources.md](/Users/danlysiak/development/hmcts/expressjs-speckit-powerbi/docs/technical/data-sources.md).

## Current status

- On 2026-03-10, the `/users` assigned summary/count path was moved off the old full-row fetch, and the dedicated default-sort indexes for `/users` assigned and completed tables were implemented.
- On 2026-03-11, a full `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` audit was rerun across the live query set used by the app.
- On 2026-03-11, the `/outstanding` critical-task total count was moved from `snapshot_open_task_rows` to `snapshot_outstanding_filter_facts`.
- On 2026-03-13, the strategic Overview split was implemented in schema and repository code:
  - `analytics.snapshot_open_due_daily_facts` now owns the due/open aggregate workload used by `/`, `/outstanding`, and the no-user branch of `/users`
  - `analytics.snapshot_task_event_daily_facts` now owns Overview created/completed/cancelled service events
- On 2026-03-13, a local prototype against the current published snapshot confirmed the final grains and lean index set for those two new table families before the next cron-built snapshot publishes them.
- Remaining substantial opportunities after that work are:
  - redesign the `/users` assignee filter source
  - create dedicated facts for the remaining `created/open` and completed aggregate workloads when they become the next bottleneck

## Scope and method

Benchmark dates:
- 2026-03-10
- 2026-03-11
- 2026-03-13

Environment:
- local PostgreSQL instance configured from `config/default.json`
- database: `cft_task_db`
- published snapshot at benchmark time: `snapshot_id = 1`

Dataset at benchmark time:
- `cft_task_db.reportable_task`: `1,469,326` rows
- `analytics.snapshot_open_task_rows_p_1`: `1,092,334` rows
- `analytics.snapshot_completed_task_rows_p_1`: `225,905` rows
- `analytics.snapshot_user_completed_facts_p_1`: `32,550` rows
- `analytics.snapshot_task_daily_facts_p_1`: `254,591` rows
- `analytics.snapshot_user_filter_facts_p_1`: `43,939` rows
- `analytics.tmp_open_due_daily_facts`: `80,762` rows
- `analytics.tmp_task_event_daily_facts_v2`: `115,373` rows

Method:
- representative SQL was taken from the live repository methods under `src/main/modules/analytics/shared/repositories/`
- server timings used `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`
- where a query has more than one real runtime shape, each shape was benchmarked separately
- the 2026-03-11 pass used the exact repository ordering semantics, including `ORDER BY rows.created_date`, `rows.completed_date`, and `rows.due_date`
- the 2026-03-13 pass added disposable prototype tables projected from `analytics.snapshot_task_daily_facts_p_1` to validate the final dedicated-table grains and child-local indexes before schema migration
- results are directional local-machine measurements, not production SLAs

Important correction:
- an earlier ad hoc benchmark pass accidentally sorted a few row-table queries by formatted text aliases from `to_char(...)` instead of the raw date columns the repo actually orders by
- the live repo queries do not have that problem
- when rerun with the exact repository SQL shape, the implemented `/users` and `/outstanding` page-1 row queries use the intended indexes and are fast

## Representative current results

| App path | Current source | Server execution | Notes |
| --- | --- | ---: | --- |
| `/` service overview | `tmp_open_due_daily_facts` prototype for `snapshot_open_due_daily_facts` | `54.1 ms` | parallel seq scan over the exact `due/open` slice only (`80,762` rows) |
| `/` task events by service | `tmp_task_event_daily_facts_v2` prototype for `snapshot_task_event_daily_facts` | `12.2 ms` | final grain aggregates across priority; unique key on `(event_date, event_type, slicers...)` was sufficient without extra secondary indexes |
| selective due/open aggregate | `tmp_open_due_daily_facts` with final slicer index set | `10.4 ms` | prototype stayed acceptable after dropping the experimental assignment-state and `UPPER(role_category_label)` indexes |
| `/users` shared filter options | `snapshot_user_filter_facts` | `261.0 ms` | returns `42,754` raw option rows and still scans the user facet table |
| `/outstanding` critical tasks total count (pre-change benchmark) | `snapshot_open_task_rows` | `114.8 ms` | old exact count did a full parallel scan of the open row table |
| `/outstanding` critical tasks total count candidate / implemented replacement | `snapshot_outstanding_filter_facts` | `0.544 ms` | `SUM(row_count)` matched the old count exactly in benchmark checks |
| `/` service overview (historical pre-split benchmark) | `snapshot_task_daily_facts` | `44.3 ms` | earlier smaller-snapshot baseline before the dedicated-table redesign |
| `/users` assigned table page 1 | `snapshot_open_task_rows` | `1.97 ms` | uses `ix_sotr_p_1_uo_assigned_default` |
| `/users` completed table page 1 | `snapshot_completed_task_rows` | `0.114 ms` | uses `ix_sctr_p_1_uo_completed_default` |
| `/outstanding` critical tasks page 1 | `snapshot_open_task_rows` | `0.11 ms` | uses `ix_sotr_p_1_due_date` |
| `/completed` processing/handling time | `snapshot_task_daily_facts` | `11.3 ms` | facts-backed; no row-scan concern |

Summary:
- the default row-page queries that previously looked suspicious are confirmed healthy
- the dedicated-table prototype validates the strategic Overview split and keeps the moved due/open and event reads in the low tens of milliseconds on the current local snapshot
- almost all remaining live queries are low tens of milliseconds or better
- the clearest remaining cost is `/users` user-filter options

## Findings

### 1. The dedicated Overview split was validated before migration

Prototype shape:
- `tmp_open_due_daily_facts`: projected from the `due/open` slice only, `80,762` rows on snapshot `1`
- `tmp_task_event_daily_facts_v2`: projected from created/completed/cancelled rows and regrouped to the final event grain, `115,373` rows on snapshot `1`

Important discovery:
- the first event-table prototype still duplicated rows at the intended event grain because the old generic facts include `priority`
- the final `snapshot_task_event_daily_facts` design therefore groups across priority and does not carry it as a column

Prototype-backed index decisions:
- `snapshot_open_due_daily_facts` keeps a unique key on `(due_date, jurisdiction_label, role_category_label, region, location, task_name, work_type, priority, assignment_state)` plus one shared slicer index on `(jurisdiction_label, role_category_label, region, location, task_name, work_type)`
- `snapshot_task_event_daily_facts` keeps only a unique key on `(event_date, event_type, jurisdiction_label, role_category_label, region, location, task_name, work_type)`; extra slicer and `UPPER(role_category_label)` indexes were not needed on the current dataset

Measured prototype results:
- service overview on the open-due shape: `54.1 ms`
- task events by service on the final event shape: `12.2 ms`
- representative filtered due/open aggregate after dropping experimental secondary indexes: `10.4 ms`

Conclusion:
- the storage redesign is doing the useful work here
- the remaining decision is when to move the not-yet-split created/open and completed aggregate workloads, not whether Overview needed dedicated facts

### 2. `/users` assignee filter source is still the biggest open problem

Measured current state on `snapshot_user_filter_facts_p_1`:
- `42,754` raw option rows returned on initial render
- `261.0 ms` server execution in the latest full query-plan audit
- the plan still performs a large scan of `snapshot_user_filter_facts_p_1`

What the app actually needs:
- a full visible dropdown of renderable caseworkers
- faceted narrowing by the other `/users` slicers

What the current path actually does:
- materialises raw TM assignee IDs
- returns them all to the app
- then drops most of them when intersecting with CRD caseworker profiles

The core issue is still workload shape, not a missing index. The visible dropdown is backed by a source that is much broader than what the UI can render.

Recommendation:
- redesign the `/users` assignee filter source so it only materialises profile-backed, actually renderable users

What is not likely to help enough:
- more indexes on `snapshot_user_filter_facts.assignee`
- small rewrites of the current `GROUP BY assignee` query while it still returns `42k+` raw values

### 3. `/outstanding` critical-task total count was a real hotspot, and the facts-backed replacement was validated

Current behavior:
- the critical-task page query itself is fast
- the exact total-count query still runs:

```sql
SELECT COUNT(*)::int
FROM analytics.snapshot_open_task_rows
WHERE snapshot_id = :snapshotId
  AND state NOT IN ('COMPLETED', 'TERMINATED');
```

Measured current plan:
- `114.8 ms`
- full parallel scan of `snapshot_open_task_rows_p_1`

What the app actually needs:
- the total number of outstanding rows under the shared Outstanding filters
- no user filter
- no date range

That matches the grain of `analytics.snapshot_outstanding_filter_facts`, which already stores `row_count` aggregated by the same page slicers:
- `jurisdiction_label`
- `role_category_label`
- `region`
- `location`
- `task_name`
- `work_type`

Candidate replacement tested:

```sql
SELECT COALESCE(SUM(row_count), 0)::bigint
FROM analytics.snapshot_outstanding_filter_facts
WHERE snapshot_id = :snapshotId
```

Measured candidate:
- `0.544 ms`

Equivalence checks run locally:
- no filters: matched exactly (`1,092,334`)
- service only: matched exactly (`304,463`)
- service + region + task name sample: matched exactly (`0`)

Implemented direction:
- `fetchOutstandingCriticalTaskCount(...)` now reads `SUM(row_count)` from `snapshot_outstanding_filter_facts`
- the paginated critical-task table rows remain row-backed from `snapshot_open_task_rows`

This closes the only non-`/users` hotspot that still stood out in the corrected full query-plan audit.

### 4. The implemented `/users` row-page optimizations are now verified

Corrected query-plan audit results:
- assigned page 1: `1.97 ms` using `ix_sotr_p_1_uo_assigned_default`
- completed page 1: `0.114 ms` using `ix_sctr_p_1_uo_completed_default`

The relevant concern from the earlier benchmark draft is now closed:
- the new default-sort indexes are being used by the live repository query shape
- no further substantial work is justified on those two default page queries right now

### 5. The Outstanding critical-task page query itself is also verified

Corrected query-plan audit result:
- page 1 default sort: `0.11 ms`
- index used: `ix_sotr_p_1_due_date`

So the Outstanding row path does not need redesign. Only the exact count path remains expensive.

### 6. Everything else is acceptable on the current local dataset

After the corrected full audit, the following no longer justify another broad schema round on the current data volume:
- `/` service overview
- overview/outstanding/completed filter option queries other than `/users`
- `/completed` summary, timeline, by name, by region, by location, and processing/handling time
- `/users` assigned summary and `/users` completed facts-backed sections
- completed task audit, because it is keyed by case ID and already uses `ix_sctr_p_1_case_id_completed`

A possible future secondary optimization still exists:
- split the remaining `created/open` and completed aggregates away from `snapshot_task_daily_facts`

That is the next strategic step if those workloads become the next bottleneck. The current implementation intentionally leaves them on the generic daily-facts table so the proven Overview hotspot can be fixed coherently first.

## Recommended next steps

Priority order:
1. redesign the `/users` assignee filter source so it stops returning raw unusable assignee IDs
2. stop broader schema/index work here unless data volume or user behavior changes materially

If that remaining change lands, there is no other clearly substantial query-path improvement indicated by the current local query-plan audit.
