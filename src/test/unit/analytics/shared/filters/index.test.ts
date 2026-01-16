import * as filters from '../../../../../main/modules/analytics/shared/filters';

describe('filters index', () => {
  test('re-exports filter helpers', () => {
    expect(filters.buildSelectOptions).toBeDefined();
    expect(filters.validateFilters).toBeDefined();
    expect(filters.buildFilterOptionsViewModel).toBeDefined();
  });
});
