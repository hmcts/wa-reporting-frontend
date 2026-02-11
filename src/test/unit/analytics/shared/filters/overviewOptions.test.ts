import { emptyOverviewFilterOptions } from '../../../../../main/modules/analytics/shared/filters/overviewOptions';

describe('emptyOverviewFilterOptions', () => {
  test('returns empty arrays for all filter options', () => {
    expect(emptyOverviewFilterOptions()).toEqual({
      services: [],
      roleCategories: [],
      regions: [],
      locations: [],
      taskNames: [],
      workTypes: [],
      users: [],
    });
  });
});
