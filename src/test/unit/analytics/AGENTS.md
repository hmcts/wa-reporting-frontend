# Analytics Unit Tests

## Patterns to keep

- Import the concrete service or view model under test and exercise pure
  functions directly.
- Use `Task` and analytics domain types from
  `main/modules/analytics/shared/types` to build realistic inputs.
- Cover edge cases (missing dates, invalid dates, empty arrays) alongside happy
  paths.
- Assert on formatted outputs (strings, summaries, row arrays) rather than
  internal implementation details.
- Ensure line and branch coverage of 95%+, verified by `yarn test:coverage`.
- When a change touches analytics business logic (helpers, aggregations,
  sorting/pagination, repositories, or view models), run targeted mutation
  checks against the changed source files (for example
  `yarn test:mutation --mutate src/main/modules/analytics/shared/utils.ts`),
  optionally pairing with `--testFiles` for the dedicated unit suite.
