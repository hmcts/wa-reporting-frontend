# Analytics Module

## Responsibilities

- Controllers: validate input, orchestrate service calls, and assemble view models.
- Services: query data sources and return domain-shaped results.
- Charts: build Plotly-ready configs from service data.
- Filters: parse/validate and build select option view models.
- Repositories: each analytics repository file owns reads from exactly one physical table or view. If runtime logic needs to choose between tables, keep that decision in the page or service layer and call the table-scoped repositories explicitly.
