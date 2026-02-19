# Functional specification: Tasks outstanding dashboard

## Purpose
Provide detail on tasks that are open or otherwise not completed, including priority, wait time, and location/region breakdowns.

## URL
- `/outstanding`

## Filters
- Shared filters: service, role category, region, location, task name, work type.
- No date range filters on this page (other than due dates within the data itself).

## Sections and behaviors

### 1) Open tasks summary
- Title: "Open tasks".
- Summary values:
  - Total, Assigned, Unassigned
  - Urgent, High, Medium, Low
- Two donut charts:
  - Assignment (Assigned vs Unassigned)
  - Priority (Urgent/High/Medium/Low)

```mermaid
flowchart TB
  Filters["Shared filters"] --> Summary["Open tasks summary"]
  Filters --> Timelines["Open tasks by date, wait time, tasks due"]
  Filters --> Critical["Critical tasks (paged)"]
  Filters --> Breakdown["By name/region/location"]
  Summary --> Donuts["Assignment + Priority donuts"]
  Timelines --> Charts["Time-series charts + tables"]
  Critical --> Table["Critical tasks table"]
  Breakdown --> Tables["Breakdown tables"]
```

### 2) Open tasks by created date
- Title: "Open tasks".
- Chart: stacked bar time series by created date (Assigned vs Unassigned).
- Table columns:
  - Created date
  - Open tasks
  - Assigned tasks
  - Assigned %
  - Unassigned tasks
  - Unassigned %

### 3) Wait time by assigned date
- Title: "Wait time".
- Chart: line chart of average wait (days) by assigned date.
- Table columns:
  - Assigned date
  - Assigned count
  - Average wait (days)

### 4) Critical tasks
- Title: "Critical tasks".
- Table only, with server-side sorting and pagination.
- Columns:
  - Case ID (link to Manage Case)
  - Case type
  - Location
  - Task name
  - Created date
  - Due date
  - Priority
  - Agent name
- Sort order defaults to due date ascending.
- Pagination page size: 50.

### 5) Tasks due
- Title: "Tasks due".
- Chart: stacked bar time series (Open vs Completed by due date).
- Table columns:
  - Due date
  - Total due
  - Open
  - Completed

### 6) Open tasks priority
- Title: "Open tasks priority".
- Chart: stacked bar time series of open tasks due by priority.
- Table columns:
  - Due date
  - Total open
  - Urgent
  - High
  - Medium
  - Low

### 7) Open tasks by name
- Title: "Open tasks by name".
- Chart: stacked horizontal bar by task name (Urgent/High/Medium/Low).
- Table columns:
  - Task name
  - Urgent
  - High
  - Medium
  - Low
- Uses an initial payload embedded in the page for fast load.

### 8) Tasks outstanding by region or location
- Title: "Tasks outstanding by region or location".
- Tabbed tables:
  - By region and location
  - By region
  - By location
- Columns include counts for total open tasks and each priority bucket.

## Notes
- CSV export is available for each table section.
- Filters are applied consistently across all sections.
- Dates are displayed as `D Mon YYYY` in tables/charts, while date sorting and CSV export use ISO `YYYY-MM-DD` values.
