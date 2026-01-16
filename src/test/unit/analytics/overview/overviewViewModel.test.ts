import { buildOverviewViewModel } from '../../../../main/modules/analytics/overview/viewModel';

describe('buildOverviewViewModel', () => {
  test('builds table rows and date parts', () => {
    const viewModel = buildOverviewViewModel({
      filters: {},
      overview: {
        serviceRows: [
          {
            service: 'Service A',
            open: 10,
            assigned: 5,
            assignedPct: 50,
            urgent: 2,
            high: 1,
            medium: 1,
            low: 1,
          },
        ],
        totals: {
          service: 'Total',
          open: 10,
          assigned: 5,
          assignedPct: 50,
          urgent: 2,
          high: 1,
          medium: 1,
          low: 1,
        },
      },
      filterOptions: { services: [], roleCategories: [], regions: [], locations: [], taskNames: [], users: [] },
      allTasks: [],
      taskEventsRows: [{ service: 'Service A', completed: 3, cancelled: 1, created: 7 }],
      taskEventsTotals: { service: 'Total', completed: 3, cancelled: 1, created: 7 },
      eventsRange: { from: new Date('2024-01-05'), to: new Date('2024-01-10') },
    });

    expect(viewModel.rows).toHaveLength(1);
    expect(viewModel.tableRows[0][0].text).toBe('Service A');
    expect(viewModel.eventsFrom).toEqual({ day: '5', month: '1', year: '2024' });
    expect(viewModel.eventsTo).toEqual({ day: '10', month: '1', year: '2024' });
  });

  test('sorts rows alphabetically and builds totals rows', () => {
    const viewModel = buildOverviewViewModel({
      filters: {},
      overview: {
        serviceRows: [
          {
            service: 'Service B',
            open: 5,
            assigned: 2,
            assignedPct: 40,
            urgent: 1,
            high: 0,
            medium: 1,
            low: 0,
          },
          {
            service: 'Service A',
            open: 7,
            assigned: 3,
            assignedPct: 42.8,
            urgent: 1,
            high: 1,
            medium: 0,
            low: 1,
          },
        ],
        totals: {
          service: 'Total',
          open: 12,
          assigned: 5,
          assignedPct: 41.7,
          urgent: 2,
          high: 1,
          medium: 1,
          low: 1,
        },
      },
      filterOptions: { services: [], roleCategories: [], regions: [], locations: [], taskNames: [], users: [] },
      allTasks: [],
      taskEventsRows: [],
      taskEventsTotals: { service: 'Total', completed: 0, cancelled: 0, created: 0 },
      eventsRange: { from: new Date('2024-02-01'), to: new Date('2024-02-02') },
    });

    expect(viewModel.rows[0].service).toBe('Service A');
    expect(viewModel.totalsRow[0].text).toBe('Total');
    expect(viewModel.taskEventsTotalsRow[0].text).toBe('Total');
  });
});
