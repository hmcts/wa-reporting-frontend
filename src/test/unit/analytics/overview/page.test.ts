import { buildOverviewPage } from '../../../../main/modules/analytics/overview/page';
import { overviewService } from '../../../../main/modules/analytics/overview/service';
import { buildOverviewViewModel } from '../../../../main/modules/analytics/overview/viewModel';
import { serviceOverviewTableService } from '../../../../main/modules/analytics/overview/visuals/serviceOverviewTableService';
import { taskEventsByServiceChartService } from '../../../../main/modules/analytics/overview/visuals/taskEventsByServiceChartService';
import { fetchFilterOptionsWithFallback } from '../../../../main/modules/analytics/shared/pageUtils';

jest.mock('../../../../main/modules/analytics/overview/service', () => ({
  overviewService: { buildOverview: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/overview/viewModel', () => ({
  buildOverviewViewModel: jest.fn(),
}));

jest.mock('../../../../main/modules/analytics/overview/visuals/serviceOverviewTableService', () => ({
  serviceOverviewTableService: { fetchServiceOverview: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/overview/visuals/taskEventsByServiceChartService', () => ({
  taskEventsByServiceChartService: { fetchTaskEventsByService: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/shared/pageUtils', () => ({
  fetchFilterOptionsWithFallback: jest.fn(),
  resolveDateRangeWithDefaults: jest.requireActual('../../../../main/modules/analytics/shared/pageUtils')
    .resolveDateRangeWithDefaults,
  settledValueWithError: jest.requireActual('../../../../main/modules/analytics/shared/pageUtils')
    .settledValueWithError,
}));

describe('buildOverviewPage', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses database overview when service rows exist', async () => {
    const fallback = {
      serviceRows: [],
      totals: {
        service: 'Total',
        open: 0,
        assigned: 0,
        assignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    };

    (overviewService.buildOverview as jest.Mock).mockReturnValue(fallback);
    (serviceOverviewTableService.fetchServiceOverview as jest.Mock).mockResolvedValue({
      serviceRows: [
        {
          service: 'Service A',
          open: 10,
          assigned: 5,
          assignedPct: 50,
          urgent: 1,
          high: 1,
          medium: 1,
          low: 2,
        },
      ],
      totals: {
        service: 'Total',
        open: 10,
        assigned: 5,
        assignedPct: 50,
        urgent: 1,
        high: 1,
        medium: 1,
        low: 2,
      },
    });
    (taskEventsByServiceChartService.fetchTaskEventsByService as jest.Mock).mockResolvedValue({
      rows: [{ service: 'Service A', completed: 2, cancelled: 1, created: 3 }],
      totals: { service: 'Total', completed: 2, cancelled: 1, created: 3 },
    });
    (fetchFilterOptionsWithFallback as jest.Mock).mockResolvedValue({
      services: [],
      roleCategories: [],
      regions: [],
      locations: [],
      taskNames: [],
      users: [],
    });
    (buildOverviewViewModel as jest.Mock).mockReturnValue({ view: 'overview' });

    const viewModel = await buildOverviewPage({});

    expect(viewModel).toEqual({ view: 'overview' });
    expect(buildOverviewViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        overview: expect.objectContaining({
          serviceRows: [
            { service: 'Service A', open: 10, assigned: 5, assignedPct: 50, urgent: 1, high: 1, medium: 1, low: 2 },
          ],
        }),
        taskEventsRows: [{ service: 'Service A', completed: 2, cancelled: 1, created: 3 }],
      })
    );
  });

  test('falls back when service overview or filters fail', async () => {
    const fallback = {
      serviceRows: [],
      totals: {
        service: 'Total',
        open: 0,
        assigned: 0,
        assignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    };

    (overviewService.buildOverview as jest.Mock).mockReturnValue(fallback);
    (serviceOverviewTableService.fetchServiceOverview as jest.Mock).mockRejectedValue(new Error('db'));
    (taskEventsByServiceChartService.fetchTaskEventsByService as jest.Mock).mockRejectedValue(new Error('db'));
    (fetchFilterOptionsWithFallback as jest.Mock).mockRejectedValueOnce(new Error('db')).mockResolvedValueOnce({
      services: [],
      roleCategories: [],
      regions: [],
      locations: [],
      taskNames: [],
      users: [],
    });
    (buildOverviewViewModel as jest.Mock).mockReturnValue({ view: 'overview-fallback' });

    await buildOverviewPage({});

    expect(fetchFilterOptionsWithFallback).toHaveBeenCalledTimes(2);
    expect(buildOverviewViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        overview: fallback,
        taskEventsRows: [],
        taskEventsTotals: { service: 'Total', completed: 0, cancelled: 0, created: 0 },
      })
    );
  });

  test('keeps fallback overview when no service rows are returned', async () => {
    const fallback = {
      serviceRows: [],
      totals: {
        service: 'Total',
        open: 0,
        assigned: 0,
        assignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    };

    (overviewService.buildOverview as jest.Mock).mockReturnValue(fallback);
    (serviceOverviewTableService.fetchServiceOverview as jest.Mock).mockResolvedValue({
      serviceRows: [],
      totals: fallback.totals,
    });
    (taskEventsByServiceChartService.fetchTaskEventsByService as jest.Mock).mockResolvedValue({
      rows: [],
      totals: { service: 'Total', completed: 0, cancelled: 0, created: 0 },
    });
    (fetchFilterOptionsWithFallback as jest.Mock).mockResolvedValue({
      services: [],
      roleCategories: [],
      regions: [],
      locations: [],
      taskNames: [],
      users: [],
    });
    (buildOverviewViewModel as jest.Mock).mockReturnValue({ view: 'overview-empty' });

    await buildOverviewPage({});

    expect(buildOverviewViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        overview: fallback,
      })
    );
  });
});
