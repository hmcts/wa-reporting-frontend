# Reference data

Reference data comes from CRD and LRD PostgreSQL databases through Prisma clients.

## CRD: `vw_case_worker_profile`

Used to map assignee IDs to names.

Required columns:

- `case_worker_id`
- `first_name`
- `last_name`
- `email_id`
- `region_id`

Outstanding-specific rule:

- On `/outstanding` critical tasks, if an assignee ID exists with no CRD match, the UI shows `Judge`.

## LRD: `region`

Used for region descriptions.

Required columns:

- `region_id`
- `description`

## LRD: `court_venue`

Used for court venue location labels. `court_venue.epimms_id` is not unique by itself; the discriminator needed for task locations is the court type. Runtime snapshot refresh cannot join LRD directly, so application startup and a periodic background sync copy the required LRD shape into analytics-owned lookup tables.

Required columns:

- `epimms_id`
- `court_type_id`
- `site_name`
- `region_id`

Related LRD association tables:

- `court_type_service_assoc`: maps `court_type_id` to `service_code`
- `service_to_ccd_case_type_assoc`: maps `service_code` to `ccd_case_type`

Analytics-owned copies:

- `analytics.court_venue_case_type_lookup`: keyed by `(epimms_id, ccd_case_type)` and populated from `court_venue`, `court_type_service_assoc`, and `service_to_ccd_case_type_assoc`. Rows are kept only when one distinct `court_type_id` and one distinct `site_name` exist for the pair.
- `analytics.court_venue_epimms_lookup`: keyed by `epimms_id` and populated only where the EPIMMS ID has exactly one distinct `site_name`.
- `analytics.location_reference_sync_state`: records the last successful sync time and row counts.

Refresh-time label resolution:

1. Use `analytics.court_venue_case_type_lookup.site_name` for `(reportable_task.location, reportable_task.case_type_id)`.
2. Otherwise use `analytics.court_venue_epimms_lookup.site_name` when the EPIMMS ID is unambiguous.
3. Otherwise keep the raw `reportable_task.location` value as the display value.

There is no case-type-specific fallback. `WaCaseType` and every other unmapped case type follow the same generic fallback chain.

## Caching

NodeCache caches:

- Filter options
- Caseworker profiles and names
- Regions and region descriptions
- Court venues for filter option population

These caches use the configurable `analytics.cacheTtlSeconds` TTL.

The app also keeps a dedicated NodeCache entry for current published snapshot metadata using `analytics.publishedSnapshotCacheTtlSeconds`. That cache is intentionally separate so current snapshot routing can use a much shorter TTL than filter and reference caches.
