import { buildOutstandingPage, fetchOpenByNameResponse } from '../../../../main/modules/analytics/outstanding/page';
import { outstandingService } from '../../../../main/modules/analytics/outstanding/service';
import { buildOutstandingViewModel } from '../../../../main/modules/analytics/outstanding/viewModel';
import {
  buildAssignmentDonutChart,
  buildOpenByNameChartConfig,
  buildOpenTasksChart,
  buildPriorityDonutChart,
  buildTasksDueChart,
  buildTasksDuePriorityChart,
  buildWaitTimeChart,
} from '../../../../main/modules/analytics/outstanding/visuals/charts';
import { criticalTasksTableService } from '../../../../main/modules/analytics/outstanding/visuals/criticalTasksTableService';
import { openTasksByNameChartService } from '../../../../main/modules/analytics/outstanding/visuals/openTasksByNameChartService';
import { openTasksByRegionLocationTableService } from '../../../../main/modules/analytics/outstanding/visuals/openTasksByRegionLocationTableService';
import { openTasksCreatedByAssignmentChartService } from '../../../../main/modules/analytics/outstanding/visuals/openTasksCreatedByAssignmentChartService';
import { openTasksSummaryStatsService } from '../../../../main/modules/analytics/outstanding/visuals/openTasksSummaryStatsService';
import { tasksDueByDateChartService } from '../../../../main/modules/analytics/outstanding/visuals/tasksDueByDateChartService';
import { tasksDueByPriorityChartService } from '../../../../main/modules/analytics/outstanding/visuals/tasksDueByPriorityChartService';
import { waitTimeByAssignedDateChartService } from '../../../../main/modules/analytics/outstanding/visuals/waitTimeByAssignedDateChartService';
import { getDefaultOutstandingSort } from '../../../../main/modules/analytics/shared/outstandingSort';
import { fetchFilterOptionsWithFallback } from '../../../../main/modules/analytics/shared/pageUtils';
import { courtVenueService, regionService } from '../../../../main/modules/analytics/shared/services';

jest.mock('../../../../main/modules/analytics/outstanding/service', () => ({
  outstandingService: { buildOutstanding: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/outstanding/viewModel', () => ({
  buildOutstandingViewModel: jest.fn(),
}));

jest.mock('../../../../main/modules/analytics/outstanding/visuals/openTasksByNameChartService', () => ({
  openTasksByNameChartService: { fetchOpenTasksByName: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/outstanding/visuals/openTasksByRegionLocationTableService', () => ({
  openTasksByRegionLocationTableService: { fetchOpenTasksByRegionLocation: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/outstanding/visuals/openTasksCreatedByAssignmentChartService', () => ({
  openTasksCreatedByAssignmentChartService: { fetchOpenTasksCreatedByAssignment: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/outstanding/visuals/openTasksSummaryStatsService', () => ({
  openTasksSummaryStatsService: { fetchOpenTasksSummary: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/outstanding/visuals/tasksDueByDateChartService', () => ({
  tasksDueByDateChartService: { fetchTasksDueByDate: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/outstanding/visuals/tasksDueByPriorityChartService', () => ({
  tasksDueByPriorityChartService: { fetchTasksDueByPriority: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/outstanding/visuals/waitTimeByAssignedDateChartService', () => ({
  waitTimeByAssignedDateChartService: { fetchWaitTimeByAssignedDate: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/outstanding/visuals/charts', () => ({
  buildOpenByNameChartConfig: jest.fn(),
  buildOpenTasksChart: jest.fn(),
  buildWaitTimeChart: jest.fn(),
  buildTasksDueChart: jest.fn(),
  buildTasksDuePriorityChart: jest.fn(),
  buildPriorityDonutChart: jest.fn(),
  buildAssignmentDonutChart: jest.fn(),
}));

jest.mock('../../../../main/modules/analytics/outstanding/visuals/criticalTasksTableService', () => ({
  criticalTasksTableService: { fetchCriticalTasksPage: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/shared/pageUtils', () => ({
  fetchFilterOptionsWithFallback: jest.fn(),
  settledArrayWithFallback: jest.requireActual('../../../../main/modules/analytics/shared/pageUtils')
    .settledArrayWithFallback,
  settledValueWithError: jest.requireActual('../../../../main/modules/analytics/shared/pageUtils')
    .settledValueWithError,
  settledValueWithFallback: jest.requireActual('../../../../main/modules/analytics/shared/pageUtils')
    .settledValueWithFallback,
}));

jest.mock('../../../../main/modules/analytics/shared/services', () => ({
  regionService: { fetchRegionDescriptions: jest.fn() },
  courtVenueService: { fetchCourtVenueDescriptions: jest.fn() },
}));

describe('buildOutstandingPage', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('builds the view model for full page load using deferred sections', async () => {
    (outstandingService.buildOutstanding as jest.Mock).mockReturnValue({
      summary: {
        open: 0,
        assigned: 0,
        unassigned: 0,
        assignedPct: 0,
        unassignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      timelines: {
        openByCreated: [],
        waitTimeByAssigned: [],
        dueByDate: [],
        tasksDueByPriority: [],
      },
      openByName: [],
      criticalTasks: [],
      outstandingByLocation: [],
      outstandingByRegion: [],
    });

    (criticalTasksTableService.fetchCriticalTasksPage as jest.Mock).mockResolvedValue({
      rows: [],
      totalResults: 0,
      page: 1,
    });

    (buildOpenByNameChartConfig as jest.Mock).mockReturnValue({ config: 'openByName' });
    (buildOpenTasksChart as jest.Mock).mockReturnValue('openTasks');
    (buildWaitTimeChart as jest.Mock).mockReturnValue('waitTime');
    (buildTasksDueChart as jest.Mock).mockReturnValue('tasksDue');
    (buildTasksDuePriorityChart as jest.Mock).mockReturnValue('tasksDueByPriority');
    (buildPriorityDonutChart as jest.Mock).mockReturnValue('priorityDonut');
    (buildAssignmentDonutChart as jest.Mock).mockReturnValue('assignmentDonut');

    (fetchFilterOptionsWithFallback as jest.Mock).mockResolvedValue({
      services: [],
      roleCategories: [],
      regions: [],
      locations: [],
      taskNames: [],
      workTypes: [],
      users: [],
    });
    (courtVenueService.fetchCourtVenueDescriptions as jest.Mock).mockResolvedValue({ Leeds: 'Leeds Crown Court' });

    (buildOutstandingViewModel as jest.Mock).mockReturnValue({ view: 'outstanding' });

    const viewModel = await buildOutstandingPage({}, getDefaultOutstandingSort());

    expect(viewModel).toEqual({ view: 'outstanding' });
    expect(openTasksByNameChartService.fetchOpenTasksByName).not.toHaveBeenCalled();
    expect(openTasksCreatedByAssignmentChartService.fetchOpenTasksCreatedByAssignment).not.toHaveBeenCalled();
    expect(waitTimeByAssignedDateChartService.fetchWaitTimeByAssignedDate).not.toHaveBeenCalled();
    expect(tasksDueByDateChartService.fetchTasksDueByDate).not.toHaveBeenCalled();
    expect(tasksDueByPriorityChartService.fetchTasksDueByPriority).not.toHaveBeenCalled();
    expect(openTasksSummaryStatsService.fetchOpenTasksSummary).not.toHaveBeenCalled();
    expect(openTasksByRegionLocationTableService.fetchOpenTasksByRegionLocation).not.toHaveBeenCalled();
    expect(criticalTasksTableService.fetchCriticalTasksPage).not.toHaveBeenCalled();
    expect(regionService.fetchRegionDescriptions).not.toHaveBeenCalled();
    expect(buildOutstandingViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: getDefaultOutstandingSort(),
        criticalTasksPage: 1,
        criticalTasksTotalResults: 0,
        charts: {
          openTasks: 'openTasks',
          waitTime: 'waitTime',
          tasksDue: 'tasksDue',
          tasksDueByPriority: 'tasksDueByPriority',
          priorityDonut: 'priorityDonut',
          assignmentDonut: 'assignmentDonut',
        },
        locationDescriptions: {},
      })
    );
  });

  test('builds only the requested ajax section data', async () => {
    (outstandingService.buildOutstanding as jest.Mock).mockReturnValue({
      summary: {
        open: 0,
        assigned: 0,
        unassigned: 0,
        assignedPct: 0,
        unassignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      timelines: {
        openByCreated: [],
        waitTimeByAssigned: [],
        dueByDate: [],
        tasksDueByPriority: [],
      },
      openByName: [],
      criticalTasks: [],
      outstandingByLocation: [
        { location: 'Fallback', region: 'Unknown', open: 0, urgent: 0, high: 0, medium: 0, low: 0 },
      ],
      outstandingByRegion: [{ region: 'Unknown', open: 0, urgent: 0, high: 0, medium: 0, low: 0 }],
    });

    (openTasksByNameChartService.fetchOpenTasksByName as jest.Mock).mockResolvedValue({
      breakdown: [{ name: 'Review', urgent: 1, high: 0, medium: 0, low: 0 }],
      totals: { name: 'Total', urgent: 1, high: 0, medium: 0, low: 0 },
    });

    (buildOpenByNameChartConfig as jest.Mock).mockReturnValue({ config: 'openByName' });
    (buildOpenTasksChart as jest.Mock).mockReturnValue('openTasks');
    (buildWaitTimeChart as jest.Mock).mockReturnValue('waitTime');
    (buildTasksDueChart as jest.Mock).mockReturnValue('tasksDue');
    (buildTasksDuePriorityChart as jest.Mock).mockReturnValue('tasksDueByPriority');
    (buildPriorityDonutChart as jest.Mock).mockReturnValue('priorityDonut');
    (buildAssignmentDonutChart as jest.Mock).mockReturnValue('assignmentDonut');

    (buildOutstandingViewModel as jest.Mock).mockReturnValue({ view: 'outstanding-ajax' });

    await buildOutstandingPage({}, getDefaultOutstandingSort(), 1, 'open-by-name');

    expect(fetchFilterOptionsWithFallback).not.toHaveBeenCalled();
    expect(openTasksCreatedByAssignmentChartService.fetchOpenTasksCreatedByAssignment).not.toHaveBeenCalled();
    expect(waitTimeByAssignedDateChartService.fetchWaitTimeByAssignedDate).not.toHaveBeenCalled();
    expect(tasksDueByDateChartService.fetchTasksDueByDate).not.toHaveBeenCalled();
    expect(tasksDueByPriorityChartService.fetchTasksDueByPriority).not.toHaveBeenCalled();
    expect(openTasksSummaryStatsService.fetchOpenTasksSummary).not.toHaveBeenCalled();
    expect(openTasksByRegionLocationTableService.fetchOpenTasksByRegionLocation).not.toHaveBeenCalled();
    expect(criticalTasksTableService.fetchCriticalTasksPage).not.toHaveBeenCalled();
    expect(buildOutstandingViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        openByNameInitial: expect.objectContaining({
          breakdown: [{ name: 'Review', urgent: 1, high: 0, medium: 0, low: 0 }],
          totals: { name: 'Total', urgent: 1, high: 0, medium: 0, low: 0 },
        }),
      })
    );
  });

  test('builds the critical tasks section on demand', async () => {
    (outstandingService.buildOutstanding as jest.Mock).mockReturnValue({
      summary: {
        open: 0,
        assigned: 0,
        unassigned: 0,
        assignedPct: 0,
        unassignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      timelines: {
        openByCreated: [],
        waitTimeByAssigned: [],
        dueByDate: [],
        tasksDueByPriority: [],
      },
      openByName: [],
      criticalTasks: [],
      outstandingByLocation: [],
      outstandingByRegion: [],
    });

    (criticalTasksTableService.fetchCriticalTasksPage as jest.Mock).mockResolvedValue({
      rows: [],
      totalResults: 0,
      page: 1,
    });
    (buildOpenByNameChartConfig as jest.Mock).mockReturnValue({ config: 'empty' });
    (buildOpenTasksChart as jest.Mock).mockReturnValue('openTasks');
    (buildWaitTimeChart as jest.Mock).mockReturnValue('waitTime');
    (buildTasksDueChart as jest.Mock).mockReturnValue('tasksDue');
    (buildTasksDuePriorityChart as jest.Mock).mockReturnValue('tasksDueByPriority');
    (buildPriorityDonutChart as jest.Mock).mockReturnValue('priorityDonut');
    (buildAssignmentDonutChart as jest.Mock).mockReturnValue('assignmentDonut');
    (courtVenueService.fetchCourtVenueDescriptions as jest.Mock).mockResolvedValue({});
    (buildOutstandingViewModel as jest.Mock).mockReturnValue({ view: 'outstanding-critical' });

    await buildOutstandingPage({}, getDefaultOutstandingSort(), 1, 'criticalTasks');

    expect(criticalTasksTableService.fetchCriticalTasksPage).toHaveBeenCalled();
    expect(fetchFilterOptionsWithFallback).not.toHaveBeenCalled();
  });

  test('falls back to safe defaults when open-by-name fails', async () => {
    (outstandingService.buildOutstanding as jest.Mock).mockReturnValue({
      summary: {
        open: 0,
        assigned: 0,
        unassigned: 0,
        assignedPct: 0,
        unassignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      timelines: {
        openByCreated: [],
        waitTimeByAssigned: [],
        dueByDate: [],
        tasksDueByPriority: [],
      },
      openByName: [],
      criticalTasks: [],
      outstandingByLocation: [
        { location: 'Fallback', region: 'Unknown', open: 0, urgent: 0, high: 0, medium: 0, low: 0 },
      ],
      outstandingByRegion: [{ region: 'Unknown', open: 0, urgent: 0, high: 0, medium: 0, low: 0 }],
    });

    (openTasksByNameChartService.fetchOpenTasksByName as jest.Mock).mockRejectedValue(new Error('db'));

    (buildOpenByNameChartConfig as jest.Mock).mockReturnValue({ config: 'empty' });
    (buildOpenTasksChart as jest.Mock).mockReturnValue('openTasks');
    (buildWaitTimeChart as jest.Mock).mockReturnValue('waitTime');
    (buildTasksDueChart as jest.Mock).mockReturnValue('tasksDue');
    (buildTasksDuePriorityChart as jest.Mock).mockReturnValue('tasksDueByPriority');
    (buildPriorityDonutChart as jest.Mock).mockReturnValue('priorityDonut');
    (buildAssignmentDonutChart as jest.Mock).mockReturnValue('assignmentDonut');

    (buildOutstandingViewModel as jest.Mock).mockReturnValue({ view: 'outstanding-fallback' });

    await buildOutstandingPage({}, getDefaultOutstandingSort(), 1, 'open-by-name');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch open tasks by name', expect.any(Error));
    expect(buildOpenByNameChartConfig).toHaveBeenCalledWith([]);
    expect(buildOutstandingViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        openByNameInitial: expect.objectContaining({
          breakdown: [],
          totals: { name: 'Total', urgent: 0, high: 0, medium: 0, low: 0 },
        }),
      })
    );
  });

  test('treats unknown ajax section as full page load with deferred sections', async () => {
    (outstandingService.buildOutstanding as jest.Mock).mockReturnValue({
      summary: {
        open: 0,
        assigned: 0,
        unassigned: 0,
        assignedPct: 0,
        unassignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      timelines: { openByCreated: [], waitTimeByAssigned: [], dueByDate: [], tasksDueByPriority: [] },
      openByName: [],
      criticalTasks: [],
      outstandingByLocation: [],
      outstandingByRegion: [],
    });
    (buildOpenByNameChartConfig as jest.Mock).mockReturnValue({ config: 'empty' });
    (buildOpenTasksChart as jest.Mock).mockReturnValue('openTasks');
    (buildWaitTimeChart as jest.Mock).mockReturnValue('waitTime');
    (buildTasksDueChart as jest.Mock).mockReturnValue('tasksDue');
    (buildTasksDuePriorityChart as jest.Mock).mockReturnValue('tasksDueByPriority');
    (buildPriorityDonutChart as jest.Mock).mockReturnValue('priorityDonut');
    (buildAssignmentDonutChart as jest.Mock).mockReturnValue('assignmentDonut');
    (fetchFilterOptionsWithFallback as jest.Mock).mockResolvedValue({
      services: [],
      roleCategories: [],
      regions: [],
      locations: [],
      taskNames: [],
      workTypes: [],
      users: [],
    });
    (buildOutstandingViewModel as jest.Mock).mockReturnValue({ view: 'unknown-section' });

    await buildOutstandingPage({}, getDefaultOutstandingSort(), 1, 'not-a-section');

    expect(fetchFilterOptionsWithFallback).toHaveBeenCalled();
    expect(openTasksByNameChartService.fetchOpenTasksByName).not.toHaveBeenCalled();
    expect(openTasksCreatedByAssignmentChartService.fetchOpenTasksCreatedByAssignment).not.toHaveBeenCalled();
    expect(waitTimeByAssignedDateChartService.fetchWaitTimeByAssignedDate).not.toHaveBeenCalled();
    expect(tasksDueByDateChartService.fetchTasksDueByDate).not.toHaveBeenCalled();
  });

  test('fetches region and location descriptions only for required ajax sections', async () => {
    (outstandingService.buildOutstanding as jest.Mock).mockReturnValue({
      summary: {
        open: 0,
        assigned: 0,
        unassigned: 0,
        assignedPct: 0,
        unassignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      timelines: { openByCreated: [], waitTimeByAssigned: [], dueByDate: [], tasksDueByPriority: [] },
      openByName: [],
      criticalTasks: [],
      outstandingByLocation: [],
      outstandingByRegion: [],
    });
    (openTasksByRegionLocationTableService.fetchOpenTasksByRegionLocation as jest.Mock).mockResolvedValue({
      locationRows: [],
      regionRows: [],
    });
    (buildOpenByNameChartConfig as jest.Mock).mockReturnValue({ config: 'empty' });
    (buildOpenTasksChart as jest.Mock).mockReturnValue('openTasks');
    (buildWaitTimeChart as jest.Mock).mockReturnValue('waitTime');
    (buildTasksDueChart as jest.Mock).mockReturnValue('tasksDue');
    (buildTasksDuePriorityChart as jest.Mock).mockReturnValue('tasksDueByPriority');
    (buildPriorityDonutChart as jest.Mock).mockReturnValue('priorityDonut');
    (buildAssignmentDonutChart as jest.Mock).mockReturnValue('assignmentDonut');
    (regionService.fetchRegionDescriptions as jest.Mock).mockResolvedValue({ N: 'North' });
    (courtVenueService.fetchCourtVenueDescriptions as jest.Mock).mockResolvedValue({ L: 'Leeds' });
    (buildOutstandingViewModel as jest.Mock).mockReturnValue({ view: 'region-location' });

    await buildOutstandingPage({}, getDefaultOutstandingSort(), 1, 'open-by-region-location');

    expect(regionService.fetchRegionDescriptions).toHaveBeenCalled();
    expect(courtVenueService.fetchCourtVenueDescriptions).toHaveBeenCalled();
    expect(buildOutstandingViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        outstandingByLocation: [],
        outstandingByRegion: [],
      })
    );

    jest.clearAllMocks();
    (outstandingService.buildOutstanding as jest.Mock).mockReturnValue({
      summary: {
        open: 0,
        assigned: 0,
        unassigned: 0,
        assignedPct: 0,
        unassignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      timelines: { openByCreated: [], waitTimeByAssigned: [], dueByDate: [], tasksDueByPriority: [] },
      openByName: [],
      criticalTasks: [],
      outstandingByLocation: [],
      outstandingByRegion: [],
    });
    (criticalTasksTableService.fetchCriticalTasksPage as jest.Mock).mockResolvedValue({
      rows: [],
      totalResults: 0,
      page: 1,
    });
    (buildOpenByNameChartConfig as jest.Mock).mockReturnValue({ config: 'empty' });
    (buildOpenTasksChart as jest.Mock).mockReturnValue('openTasks');
    (buildWaitTimeChart as jest.Mock).mockReturnValue('waitTime');
    (buildTasksDueChart as jest.Mock).mockReturnValue('tasksDue');
    (buildTasksDuePriorityChart as jest.Mock).mockReturnValue('tasksDueByPriority');
    (buildPriorityDonutChart as jest.Mock).mockReturnValue('priorityDonut');
    (buildAssignmentDonutChart as jest.Mock).mockReturnValue('assignmentDonut');
    (courtVenueService.fetchCourtVenueDescriptions as jest.Mock).mockResolvedValue({ L: 'Leeds' });
    (buildOutstandingViewModel as jest.Mock).mockReturnValue({ view: 'critical-only' });

    await buildOutstandingPage({}, getDefaultOutstandingSort(), 2, 'criticalTasks');

    expect(regionService.fetchRegionDescriptions).not.toHaveBeenCalled();
    expect(courtVenueService.fetchCourtVenueDescriptions).toHaveBeenCalled();
  });

  test('logs exact region-location failure message and preserves fallback region/location rows', async () => {
    (outstandingService.buildOutstanding as jest.Mock).mockReturnValue({
      summary: {
        open: 0,
        assigned: 0,
        unassigned: 0,
        assignedPct: 0,
        unassignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      timelines: { openByCreated: [], waitTimeByAssigned: [], dueByDate: [], tasksDueByPriority: [] },
      openByName: [],
      criticalTasks: [],
      outstandingByLocation: [
        { location: 'Fallback', region: 'Fallback', open: 1, urgent: 1, high: 0, medium: 0, low: 0 },
      ],
      outstandingByRegion: [{ region: 'Fallback', open: 1, urgent: 1, high: 0, medium: 0, low: 0 }],
    });
    (openTasksByRegionLocationTableService.fetchOpenTasksByRegionLocation as jest.Mock).mockRejectedValue(
      new Error('db')
    );
    (buildOpenByNameChartConfig as jest.Mock).mockReturnValue({ config: 'empty' });
    (buildOpenTasksChart as jest.Mock).mockReturnValue('openTasks');
    (buildWaitTimeChart as jest.Mock).mockReturnValue('waitTime');
    (buildTasksDueChart as jest.Mock).mockReturnValue('tasksDue');
    (buildTasksDuePriorityChart as jest.Mock).mockReturnValue('tasksDueByPriority');
    (buildPriorityDonutChart as jest.Mock).mockReturnValue('priorityDonut');
    (buildAssignmentDonutChart as jest.Mock).mockReturnValue('assignmentDonut');
    (regionService.fetchRegionDescriptions as jest.Mock).mockRejectedValue(new Error('region-db'));
    (courtVenueService.fetchCourtVenueDescriptions as jest.Mock).mockRejectedValue(new Error('location-db'));
    (buildOutstandingViewModel as jest.Mock).mockReturnValue({ view: 'region-location-fallback' });

    await buildOutstandingPage({}, getDefaultOutstandingSort(), 1, 'open-by-region-location');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch open tasks by region/location from database',
      expect.any(Error)
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch region descriptions from database',
      expect.any(Error)
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch court venue descriptions from database',
      expect.any(Error)
    );
    expect(buildOutstandingViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        outstandingByLocation: [
          { location: 'Fallback', region: 'Fallback', open: 1, urgent: 1, high: 0, medium: 0, low: 0 },
        ],
        outstandingByRegion: [{ region: 'Fallback', open: 1, urgent: 1, high: 0, medium: 0, low: 0 }],
      })
    );
  });

  test('uses exact filter-options fallback message on full page loads', async () => {
    (outstandingService.buildOutstanding as jest.Mock).mockReturnValue({
      summary: {
        open: 0,
        assigned: 0,
        unassigned: 0,
        assignedPct: 0,
        unassignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      timelines: { openByCreated: [], waitTimeByAssigned: [], dueByDate: [], tasksDueByPriority: [] },
      openByName: [],
      criticalTasks: [],
      outstandingByLocation: [],
      outstandingByRegion: [],
    });
    (buildOpenByNameChartConfig as jest.Mock).mockReturnValue({ config: 'empty' });
    (buildOpenTasksChart as jest.Mock).mockReturnValue('openTasks');
    (buildWaitTimeChart as jest.Mock).mockReturnValue('waitTime');
    (buildTasksDueChart as jest.Mock).mockReturnValue('tasksDue');
    (buildTasksDuePriorityChart as jest.Mock).mockReturnValue('tasksDueByPriority');
    (buildPriorityDonutChart as jest.Mock).mockReturnValue('priorityDonut');
    (buildAssignmentDonutChart as jest.Mock).mockReturnValue('assignmentDonut');
    (fetchFilterOptionsWithFallback as jest.Mock).mockResolvedValue({
      services: [],
      roleCategories: [],
      regions: [],
      locations: [],
      taskNames: [],
      workTypes: [],
      users: [],
    });
    (buildOutstandingViewModel as jest.Mock).mockReturnValue({ view: 'full-page' });

    await buildOutstandingPage({}, getDefaultOutstandingSort(), 1, 'not-a-section');

    expect(fetchFilterOptionsWithFallback).toHaveBeenCalledWith(
      'Failed to fetch outstanding filter options from database'
    );
  });

  test.each([
    ['open-tasks-table', 'Failed to fetch open tasks by assignment from database'],
    ['wait-time-table', 'Failed to fetch wait time from database'],
    ['tasks-due', 'Failed to fetch tasks due from database'],
    ['open-tasks-priority', 'Failed to fetch tasks due by priority from database'],
    ['open-tasks-summary', 'Failed to fetch open tasks summary from database'],
    ['criticalTasks', 'Failed to fetch critical tasks from database'],
  ] as const)('logs exact section fallback message for %s failures', async (section, expectedMessage) => {
    (outstandingService.buildOutstanding as jest.Mock).mockReturnValue({
      summary: {
        open: 0,
        assigned: 0,
        unassigned: 0,
        assignedPct: 0,
        unassignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      timelines: { openByCreated: [], waitTimeByAssigned: [], dueByDate: [], tasksDueByPriority: [] },
      openByName: [],
      criticalTasks: [],
      outstandingByLocation: [],
      outstandingByRegion: [],
    });
    (openTasksCreatedByAssignmentChartService.fetchOpenTasksCreatedByAssignment as jest.Mock).mockResolvedValue([]);
    (waitTimeByAssignedDateChartService.fetchWaitTimeByAssignedDate as jest.Mock).mockResolvedValue([]);
    (tasksDueByDateChartService.fetchTasksDueByDate as jest.Mock).mockResolvedValue([]);
    (tasksDueByPriorityChartService.fetchTasksDueByPriority as jest.Mock).mockResolvedValue([]);
    (openTasksSummaryStatsService.fetchOpenTasksSummary as jest.Mock).mockResolvedValue(null);
    (criticalTasksTableService.fetchCriticalTasksPage as jest.Mock).mockResolvedValue({
      rows: [],
      totalResults: 0,
      page: 1,
    });
    (buildOpenByNameChartConfig as jest.Mock).mockReturnValue({ config: 'empty' });
    (buildOpenTasksChart as jest.Mock).mockReturnValue('openTasks');
    (buildWaitTimeChart as jest.Mock).mockReturnValue('waitTime');
    (buildTasksDueChart as jest.Mock).mockReturnValue('tasksDue');
    (buildTasksDuePriorityChart as jest.Mock).mockReturnValue('tasksDueByPriority');
    (buildPriorityDonutChart as jest.Mock).mockReturnValue('priorityDonut');
    (buildAssignmentDonutChart as jest.Mock).mockReturnValue('assignmentDonut');
    (regionService.fetchRegionDescriptions as jest.Mock).mockResolvedValue({});
    (courtVenueService.fetchCourtVenueDescriptions as jest.Mock).mockResolvedValue({});
    (buildOutstandingViewModel as jest.Mock).mockReturnValue({ view: 'section-error' });

    if (section === 'open-tasks-table') {
      (openTasksCreatedByAssignmentChartService.fetchOpenTasksCreatedByAssignment as jest.Mock).mockRejectedValue(
        new Error('db')
      );
    } else if (section === 'wait-time-table') {
      (waitTimeByAssignedDateChartService.fetchWaitTimeByAssignedDate as jest.Mock).mockRejectedValue(new Error('db'));
    } else if (section === 'tasks-due') {
      (tasksDueByDateChartService.fetchTasksDueByDate as jest.Mock).mockRejectedValue(new Error('db'));
    } else if (section === 'open-tasks-priority') {
      (tasksDueByPriorityChartService.fetchTasksDueByPriority as jest.Mock).mockRejectedValue(new Error('db'));
    } else if (section === 'open-tasks-summary') {
      (openTasksSummaryStatsService.fetchOpenTasksSummary as jest.Mock).mockRejectedValue(new Error('db'));
    } else {
      (criticalTasksTableService.fetchCriticalTasksPage as jest.Mock).mockRejectedValue(new Error('db'));
    }

    await buildOutstandingPage({}, getDefaultOutstandingSort(), 1, section);

    expect(consoleErrorSpy).toHaveBeenCalledWith(expectedMessage, expect.any(Error));
  });
});

describe('fetchOpenByNameResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns breakdown totals and chart config', async () => {
    (openTasksByNameChartService.fetchOpenTasksByName as jest.Mock).mockResolvedValue({
      breakdown: [{ name: 'Task A', urgent: 1, high: 0, medium: 0, low: 0 }],
      totals: { name: 'Total', urgent: 1, high: 0, medium: 0, low: 0 },
    });
    (buildOpenByNameChartConfig as jest.Mock).mockReturnValue({ chart: 'openByName' });

    const result = await fetchOpenByNameResponse({ service: ['Civil'] });

    expect(openTasksByNameChartService.fetchOpenTasksByName).toHaveBeenCalledWith({ service: ['Civil'] });
    expect(result).toEqual({
      breakdown: [{ name: 'Task A', urgent: 1, high: 0, medium: 0, low: 0 }],
      totals: { name: 'Total', urgent: 1, high: 0, medium: 0, low: 0 },
      chart: { chart: 'openByName' },
    });
  });
});
