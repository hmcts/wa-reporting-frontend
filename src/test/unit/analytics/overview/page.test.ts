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

  test('builds service performance overview when requested', async () => {
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
    (buildOverviewViewModel as jest.Mock).mockReturnValue({ view: 'overview' });

    const viewModel = await buildOverviewPage({}, 'overview-service-performance');

    expect(viewModel).toEqual({ view: 'overview' });
    expect(taskEventsByServiceChartService.fetchTaskEventsByService).not.toHaveBeenCalled();
    expect(fetchFilterOptionsWithFallback).not.toHaveBeenCalled();
    expect(buildOverviewViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        overview: expect.objectContaining({
          serviceRows: [
            { service: 'Service A', open: 10, assigned: 5, assignedPct: 50, urgent: 1, high: 1, medium: 1, low: 2 },
          ],
        }),
        taskEventsRows: [],
      })
    );
  });

  test('builds task events when requested', async () => {
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
    (taskEventsByServiceChartService.fetchTaskEventsByService as jest.Mock).mockResolvedValue({
      rows: [{ service: 'Service A', completed: 2, cancelled: 1, created: 3 }],
      totals: { service: 'Total', completed: 2, cancelled: 1, created: 3 },
    });
    (buildOverviewViewModel as jest.Mock).mockReturnValue({ view: 'overview-task-events' });

    await buildOverviewPage({}, 'overview-task-events');

    expect(serviceOverviewTableService.fetchServiceOverview).not.toHaveBeenCalled();
    expect(fetchFilterOptionsWithFallback).not.toHaveBeenCalled();
    expect(buildOverviewViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        overview: fallback,
        taskEventsRows: [{ service: 'Service A', completed: 2, cancelled: 1, created: 3 }],
        taskEventsTotals: { service: 'Total', completed: 2, cancelled: 1, created: 3 },
      })
    );
  });

  test('defers overview sections on full page load', async () => {
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

    expect(serviceOverviewTableService.fetchServiceOverview).not.toHaveBeenCalled();
    expect(taskEventsByServiceChartService.fetchTaskEventsByService).not.toHaveBeenCalled();
    expect(fetchFilterOptionsWithFallback).toHaveBeenCalled();
    expect(buildOverviewViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        overview: fallback,
      })
    );
  });

  test('falls back when service overview fails', async () => {
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
    (buildOverviewViewModel as jest.Mock).mockReturnValue({ view: 'overview-fallback' });

    await buildOverviewPage({}, 'overview-service-performance');

    expect(buildOverviewViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        overview: fallback,
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
    (buildOverviewViewModel as jest.Mock).mockReturnValue({ view: 'overview-empty' });

    await buildOverviewPage({}, 'overview-service-performance');

    expect(buildOverviewViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        overview: fallback,
      })
    );
  });
});
