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

Used for location descriptions.

Required columns:

- `epimms_id`
- `site_name`
- `region_id`

## Caching

NodeCache caches:

- Filter options
- Caseworker profiles and names
- Regions and region descriptions
- Court venues and location descriptions

These caches use the configurable `analytics.cacheTtlSeconds` TTL.

The app also keeps a dedicated NodeCache entry for current published snapshot metadata using `analytics.publishedSnapshotCacheTtlSeconds`. That cache is intentionally separate so current snapshot routing can use a much shorter TTL than filter and reference caches.
