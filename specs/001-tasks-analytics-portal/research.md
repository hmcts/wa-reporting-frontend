# Phase 0 Research – Tasks analytics portal

## Decision: Plotly with GOV.UK styling and accessible tables

- **Rationale**: Plotly supports the mixed chart types shown (donut, line, stacked bars) and can be initialised client-side with server-provided JSON. GOV.UK palette can be applied via Plotly `marker.colors` for priority categories, while GOV.UK tables/tabs provide the data-table alternative for accessibility and screen readers. Chart/Data table toggles match the screenshots.
- **Alternatives considered**: Chart.js (lighter but would need more custom work for donut + stacked bar + line with dual axes), Highcharts (richer but license complexity).

## Decision: Mock data served by Express services

- **Rationale**: The feature requires mocked data only; providing typed in-memory datasets (JSON fixtures) keeps routes deterministic for tests, supports pagination/virtualization for large result sets (10k rows), and allows chart/table parity checks. Services can expose aggregation helpers to reuse across endpoints and views.
- **Alternatives considered**: Generating data on the client (would break SSR consistency and testing), wiring to a real datastore (out of scope).

## Decision: Read-only analytics routes with shared filter validation

- **Rationale**: Dedicated GET endpoints for overview/outstanding/completed/user/audit allow server-rendered pages to fetch data safely with CSRF and Helmet intact. Shared filter validation (service, role category, region, location, task name, user, date ranges) prevents invalid queries and supports consistent empty/zero states.
- **Alternatives considered**: Single monolithic endpoint (harder to tailor payloads per page), client-only filtering (would require shipping full datasets to browser and harms performance).

## Accessibility and palette alignment notes

- **Plotly palette**: Priority colors map to GOV.UK palette tokens defined in `src/main/assets/scss/analytics.scss` (urgent/high/medium/low/notProvided). Use these for chart series colors to maintain contrast and consistency.
- **Chart/table parity**: Every chart surface must have a data-table alternative via the GOV.UK toggle pattern so screen reader users can access the same information.
- **Focus/keyboard**: Keep chart containers non-interactive by default; rely on the data tables for keyboard navigation where possible.
