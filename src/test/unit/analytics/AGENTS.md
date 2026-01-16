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
