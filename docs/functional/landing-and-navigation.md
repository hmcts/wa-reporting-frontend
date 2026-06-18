# Functional specification: Landing and navigation

## Analytics default page
URL: `/`

Purpose:
- Provide the default Overview dashboard as the analytics entry point.

Content:
- Page title: "Service performance overview".
- Shows the Overview dashboard sections directly.

## Global navigation
All analytics pages share a common header and service navigation (GOV.UK header + service nav).

Navigation items:
- Overview
- Tasks outstanding
- Tasks completed
- User overview
- Sign out

The navigation highlights the current page by comparing the request path to the navigation URL.

## Shared filters (applies to most dashboards)
The shared filter block appears on analytics dashboard pages. Its common behaviour is defined in [Shared dashboard behaviour](shared-dashboard-behaviour.md).

It provides multi-select filters for:
- Service
- Role category
- Region
- Location
- Work type
- Task name
- User (only on User overview)

Additional filters by dashboard:
- Completed tasks and User overview include date range filters for completedFrom/completedTo.
- Overview includes a date range for eventsFrom/eventsTo (applied to created, completed, and cancelled task events by service).

## Charts and tables
Common chart, table, and CSV export behaviour is defined in [Shared dashboard behaviour](shared-dashboard-behaviour.md).

## Sorting and pagination
Common sorting and pagination behaviour is defined in [Shared dashboard behaviour](shared-dashboard-behaviour.md).

## Partial refresh (AJAX sections)
Common AJAX section refresh behaviour is defined in [Shared dashboard behaviour](shared-dashboard-behaviour.md).

## Error and empty states
Common error and empty-state behaviour is defined in [Shared dashboard behaviour](shared-dashboard-behaviour.md). Dashboard-specific empty states are documented on the relevant page specification.
