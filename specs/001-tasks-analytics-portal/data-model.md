# Data Model – Tasks analytics portal

## Entities

### Task

- **Identifiers**: `caseId` (string), `taskId` (string)
- **Classification**: `service`, `roleCategory`, `region`, `location`, `taskName`, `priority` (urgent|high|medium|low|notProvided)
- **Dates**: `createdDate`, `assignedDate?`, `dueDate?`, `completedDate?`
- **Status**: `status` (open|assigned|completed)
- **Assignee**: `assigneeId?`, `assigneeName?`
- **Metrics**: `handlingTimeDays?` (assigned→completed), `processingTimeDays?` (created→completed), `totalAssignments` (number)
- **Validation**: date ranges must be logical (start ≤ end); dueDate optional; priority defaults to `notProvided` when missing.

### User

- **Identifiers**: `userId`, `email`
- **Attributes**: `roleCategory`, `region`, `location`, `displayName?`
- **Relations**: linked tasks via `assigneeId`

### Service

- **Identifier**: `service`
- **Attributes**: `description?`
- **Relations**: groups tasks for aggregation

### Aggregates (page-level views)

- **OverviewAggregate**: per service counts: open, assigned, assignedPct, urgent/high/medium/low totals; plus grand totals.
- **OutstandingMetrics**: counts for open vs assigned/unassigned; priority mix; timelines by created/assigned date; due/priority distributions; critical task listing.
- **CompletedMetrics**: counts for completed today/date range; within-due-date compliance; timelines by completed date; completed-by-name; handling/processing time stats; task audit lines.
- **UserMetrics**: assigned tasks table for user; completed tasks list for user; priority donut; completed-by-date timeline.

## Relationships

- Service 1..n Tasks
- User 0..n Tasks (by assignee)
- Aggregates derive from filtered Task sets; no persistence required (mock data generated/loaded per request).

## State considerations

- Status transitions: open → assigned → completed (assigned optional for unassigned open tasks).
- Handling vs processing time calculations require presence of `assignedDate`/`completedDate` or `createdDate`/`completedDate`; fall back to null when missing and exclude from averages.
