# Analytics Shared

## Patterns to keep

- Use `shared/types` for domain shapes passed between services, view models, and
  charts.
- Validate/filter request params with `shared/filters/validator` and build
  select options with `shared/filters/viewModel`.
- Fetch filter option data through `shared/services` and fall back via
  `shared/pageUtils`.
- Keep data access in `shared/repositories`; services should compose
  repositories and return domain-shaped results.
- Build Plotly config strings with `shared/charts/*` and `buildChartConfig`;
  reuse `shared/charts/colors` for palette consistency.
- Use `shared/formatting` and `shared/utils` helpers instead of reimplementing
  formatting or label normalization.
