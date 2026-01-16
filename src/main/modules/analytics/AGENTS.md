# Analytics Modules

## Patterns to keep

- Each analytics page lives in `src/main/modules/analytics/<page>/` with
  `controller.ts`, `page.ts`, `service.ts`, `viewModel.ts`, and optional
  `visuals/`.
- Controllers register GET/POST routes, call `validateFilters`, and render
  `analytics/<page>` with the page view model.
- Page builders orchestrate data fetching with `Promise.allSettled` and
  `shared/pageUtils` fallbacks, then pass a single params object into the view
  model.
- Services focus on domain shaping and aggregations; they do not perform HTTP or
  template work.
- `visuals/` files either fetch data (`*Service`) or build chart configs
  (`charts.ts`) using shared chart helpers.
- `index.ts` wires new controllers into the analytics router.
