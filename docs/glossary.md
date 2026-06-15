# Glossary

This glossary is the shared vocabulary for product, engineering, data, and agent work. Use it before changing dashboard copy, SQL field names, filters, or metric calculations.

| Term | Code or SQL mapping | Scope | Meaning |
| --- | --- | --- | --- |
| Agent name | CRD caseworker profile, or fallback display label | Outstanding, User overview, Completed audit | Human-readable assignee name shown in row-backed tables. Outstanding critical tasks show `Judge` when an assignee ID exists but no Staff Ref Data profile matches. |
| Assignment state | `assignment_state` | Outstanding, Overview, User overview | Assigned/unassigned classification derived from task state and used in summary, donut, and workload facts. |
| Assignee | `assignee` | User overview, row-backed tables | User identifier associated with a task. The User overview `User` filter maps to this column. |
| Case ID | `case_id` | Row-backed tables | Identifier for a case linked to a task. The UI links case IDs to Manage Case using `analytics.manageCaseBaseUrl`. |
| Completed task | `LOWER(termination_reason) = 'completed'` | Completed, User overview, Overview events | A task counted as completed. Task `state` is not used to classify completion. |
| Created event | `created_date IS NOT NULL` | Overview events | A task event counted in created/completed/cancelled event facts. Created events can come from open, completed, or other current task states. |
| Critical task | `snapshot_open_task_rows` with open-state contract and non-null `created_date` | Outstanding | Row-backed open task ranked for attention by due date and priority. |
| Dashboard section | Nunjucks partial with `data-section` | All analytics pages | Independently rendered analytics block that can refresh through AJAX. |
| Due date | `due_date` | Outstanding, Completed, User overview | Target task completion date. Used for priority, SLA, and due-date charts. |
| Facet | Page-scoped `snapshot_*_filter_facts` tables | Shared filters | Filter option set constrained by current selections in other filters. |
| Facts-backed | `snapshot_*_facts` table | Analytics SQL | Query reads an aggregated snapshot table instead of task rows. Used for performance-sensitive charts and summaries. |
| Handling time | `handling_time_days` or `handling_time_sum / count` | Completed, User overview | Days between first assignment and completion. |
| Judicial exclusion | `UPPER(role_category_label) <> 'JUDICIAL'` null-safe predicate | User overview | User overview excludes Judicial role category data from tables, charts, summaries, and role-category filter options. |
| Location | `location` resolved from LRD court venue where applicable | Shared filters, tables | Court venue/site label associated with a task. |
| Page-scoped filter facts | `snapshot_overview_filter_facts`, `snapshot_outstanding_filter_facts`, `snapshot_completed_filter_facts`, `snapshot_user_filter_facts` | Shared filters | Materialised filter option tables for each dashboard workload. |
| Priority bucket | SQL priority rank mapped to Urgent/High/Medium/Low | Outstanding, User overview | Derived label calculated from major priority or priority plus current date. See [derived metrics](technical/data-sources/derived-metrics.md). |
| Processing time | `processing_time_days` or `processing_time_sum / count` | Completed | Days between task creation and completion. |
| Published snapshot | `analytics.snapshot_state.published_snapshot_id` | Data model | Immutable snapshot ID currently selected for ordinary analytics reads. |
| Reference date | `reference_date` | Fact tables | Normalised date column in rollups, such as created, completed, due, or assigned date depending on the table. |
| Region | `region` resolved from LRD where applicable | Shared filters, tables | Regional label associated with a task or location. |
| Role category | `role_category_label` | Shared filters | Role grouping attached to a task, for example caseworker role category. |
| Rollup | Smaller aggregated snapshot table | Data model | Facts table that intentionally drops dimensions for faster default or narrow-filter reads. Queries fall back to full facts when omitted dimensions are filtered. |
| Row-backed | `snapshot_open_task_rows` or `snapshot_completed_task_rows` | Analytics SQL | Query reads thin task-row snapshot data because exact row detail, sorting, pagination, assignee filtering, or case audit behaviour is required. |
| Service | `jurisdiction_label` | Shared filters, Overview | Jurisdiction or service label associated with a task. |
| Shared slicer | `jurisdiction_label`, `role_category_label`, `region`, `location`, `task_name`, `work_type` | Fact tables | Common grouping/filter columns used across dashboard facts. |
| Snapshot | `snapshot_id` | Data model | Immutable set of snapshot row, facts, rollup, and facet partitions read together by the app. |
| Snapshot token | Signed request token used by snapshot metadata helpers | Analytics routes | Optional request token that selects or validates a historical snapshot. Current published snapshots use a short TTL cache fast path. |
| Task audit | `snapshot_completed_task_rows` filtered by case ID | Completed | Completed task history view for a specific case ID. |
| Task name | `task_name` | Shared filters, tables, charts | Human-readable task name/type, for example `Review application`. |
| Task status | Derived classification | Facts and dashboards | Open, assigned, completed, cancelled, or other status used to build page-specific metrics. |
| User | `assignee` plus CRD profile data | User overview | Caseworker/assignee associated with tasks. |
| Within due date | `is_within_sla = 'Yes'` or `completed_date <= due_date` | Completed, User overview | SLA/compliance classification for completed tasks. |
| Work type | `work_type`, display resolved from `cft_task_db.work_types` | Shared filters | Work type/slicer attached to a task. |
