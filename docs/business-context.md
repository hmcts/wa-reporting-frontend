# Business context

## Product purpose
The Task Management Report (wa-reporting-frontend) provides analytics dashboards for work allocation and task management data. The application helps operational and service teams understand task volume, timeliness, and workload distribution across services, regions, locations, and users.

## Primary users
- Service and operations managers monitoring workload and performance.
- Team leaders supervising caseworkers and task queues.
- Performance analysts tracking throughput and compliance.
- Support and governance roles reviewing task audit history.

## Business goals
- Provide a single view of task performance across services.
- Highlight risk areas (urgent/high priority, overdue tasks, long wait times).
- Track completion compliance with due dates and service level targets.
- Enable drill-down to user and case-level task audit details.
- Provide data export options for offline analysis and reporting.

## Scope
In scope:
- Read-only analytics dashboards for task data.
- Filtering across service, role category, region, location, task name, user.
- Date range filtering for completed tasks and task events.
- Charts and data tables with CSV export.
- Basic navigation among dashboards.

Out of scope:
- Task creation, assignment, or modification.
- Case management and case data editing.
- Manual data entry or file uploads.
- Role administration or user provisioning.

## Key business metrics
- Open tasks by service, assignment state, and priority.
- Task events by service (created and completed shown in UI; cancelled retained in backend for future use).
- Completion totals and compliance within due date.
- Critical tasks ranked by due date and priority.
- User-level assigned and completed workload.
- Handling and processing time averages and ranges.

## Constraints and assumptions
- Data is sourced from upstream analytics views and reference datasets in PostgreSQL.
- The application is read-only and should not mutate downstream data.
- Users must be authenticated and authorized (RBAC) when auth is enabled.
- The UI should follow GOV.UK Design System patterns for consistency and accessibility.
