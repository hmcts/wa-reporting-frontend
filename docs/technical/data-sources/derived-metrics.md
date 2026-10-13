# Derived metrics

These rules define metric semantics shared by SQL, services, view models, charts, and tests.

## Priority rank

Priority rank is calculated in SQL at read time from `major_priority` or `priority` plus `CURRENT_DATE`:

| Condition | Rank | UI label |
| --- | --- | --- |
| `major_priority <= 2000` | 4 | Urgent |
| `major_priority < 5000` | 3 | High |
| `major_priority = 5000` and `due_date < CURRENT_DATE` | 3 | High |
| `major_priority = 5000` and `due_date = CURRENT_DATE` | 2 | Medium |
| Otherwise | 1 | Low |

Priority sorting uses severity ranking rather than alphabetical label order. UI cells carry numeric sort metadata so client-side enhancements keep the same ordering.

## Within due date

Within due date is computed as:

- `is_within_sla = 'Yes'` when present
- Otherwise `completed_date <= due_date`

Completed row paths also carry `within_due_sort_value` for sorting.

## Completed-task determination

Completed-task paths use case-insensitive `termination_reason = 'completed'`.

Task `state` is not used to classify completion.

## Cancelled-event determination

Overview cancelled task events use case-insensitive `termination_reason = 'deleted'`.

The facts-backed metric stores those rows as cancelled events and does not apply an additional `state` predicate.

## Open-task row contract

`snapshot_open_task_rows` includes source rows where `state NOT IN ('COMPLETED', 'TERMINATED')`.

The Outstanding critical tasks query narrows that population to:

- `state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED')`
- `created_date IS NOT NULL`

This keeps critical-task pagination aligned with the open-tasks-by-created-date workload.

## User Overview task-name averages

`/users` "Completed tasks by task name" preserves row-query average semantics while reading facts:

- Average handling time in days: `SUM(handling_time_sum) / SUM(tasks)`
- Average days beyond due date: `SUM(days_beyond_sum) / SUM(days_beyond_count)`

Fact columns are populated so null intervals contribute zero to the numerator while remaining in the denominator.

## Completed processing and handling time

`/completed` processing/handling time is derived from completed dashboard facts:

- Average: `sum / count`
- Population standard deviation: `sqrt((sum_squares / count) - power(sum / count, 2))`

This keeps the page facts-backed while preserving the same aggregates as the source row query.
