import { buildFilterOptionsViewModel } from '../../../../../main/modules/analytics/shared/filters/viewModel';

describe('buildFilterOptionsViewModel', () => {
  test('uses all tasks when filter options are empty', () => {
    const viewModel = buildFilterOptionsViewModel(
      { services: [], roleCategories: [], regions: [], locations: [], taskNames: [], workTypes: [], users: [] },
      [
        { service: 'Service A', roleCategory: 'Ops', region: 'North', location: 'Leeds', taskName: 'Review' },
        { service: 'Service B', roleCategory: 'Admin', region: 'South', location: 'London', taskName: 'Approve' },
      ]
    );

    expect(viewModel.serviceOptions[0].text).toBe('All services');
    expect(viewModel.serviceOptions[1].value).toBe('Service A');
    expect(viewModel.roleCategoryOptions[1].value).toBe('Admin');
    expect(viewModel.workTypeOptions).toEqual([{ value: '', text: 'All work types' }]);
  });

  test('uses provided region and location options when available', () => {
    const viewModel = buildFilterOptionsViewModel(
      {
        services: ['Service A'],
        roleCategories: ['Ops'],
        regions: [{ value: 'N', text: 'North' }],
        locations: [{ value: 'L', text: 'Leeds' }],
        taskNames: [],
        workTypes: ['Hearing'],
        users: [],
      },
      []
    );

    expect(viewModel.regionOptions).toEqual([{ value: 'N', text: 'North' }]);
    expect(viewModel.locationOptions).toEqual([{ value: 'L', text: 'Leeds' }]);
    expect(viewModel.workTypeOptions).toEqual([
      { value: '', text: 'All work types' },
      { value: 'Hearing', text: 'Hearing' },
    ]);
  });
});
