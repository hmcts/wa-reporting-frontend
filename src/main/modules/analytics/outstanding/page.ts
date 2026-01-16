import { OutstandingSort } from '../shared/outstandingSort';
import {
  fetchFilterOptionsWithFallback,
  settledArrayWithFallback,
  settledValueWithError,
  settledValueWithFallback,
} from '../shared/pageUtils';
import { courtVenueService, regionService } from '../shared/services';
import { AnalyticsFilters, PriorityBreakdown, Task } from '../shared/types';

import { outstandingService } from './service';
import { buildOutstandingViewModel } from './viewModel';
import {
  buildAssignmentDonutChart,
  buildOpenByNameChartConfig,
  buildOpenTasksChart,
  buildPriorityDonutChart,
  buildTasksDueChart,
  buildTasksDuePriorityChart,
  buildWaitTimeChart,
} from './visuals/charts';
import { criticalTasksTableService } from './visuals/criticalTasksTableService';
import { openTasksByNameChartService } from './visuals/openTasksByNameChartService';
import { openTasksByRegionLocationTableService } from './visuals/openTasksByRegionLocationTableService';
import { openTasksCreatedByAssignmentChartService } from './visuals/openTasksCreatedByAssignmentChartService';
import { openTasksSummaryStatsService } from './visuals/openTasksSummaryStatsService';
import { tasksDueByDateChartService } from './visuals/tasksDueByDateChartService';
import { tasksDueByPriorityChartService } from './visuals/tasksDueByPriorityChartService';
import { waitTimeByAssignedDateChartService } from './visuals/waitTimeByAssignedDateChartService';

type OutstandingPageViewModel = ReturnType<typeof buildOutstandingViewModel>;

export async function buildOutstandingPage(
  filters: AnalyticsFilters,
  sort: OutstandingSort,
  criticalTasksPage = 1
): Promise<OutstandingPageViewModel> {
  const outstanding = outstandingService.buildOutstanding([]);
  let summary = outstanding.summary;
  let openByNameInitial: { breakdown: PriorityBreakdown[]; totals: PriorityBreakdown; chart: Record<string, unknown> } =
    {
      breakdown: [],
      totals: { name: 'Total', urgent: 0, high: 0, medium: 0, low: 0 },
      chart: buildOpenByNameChartConfig([]),
    };

  let openByCreated = outstanding.timelines.openByCreated;
  let waitTime = outstanding.timelines.waitTimeByAssigned;
  let dueByDate = outstanding.timelines.dueByDate;
  let priorityByDueDate = outstanding.timelines.tasksDueByPriority;
  let outstandingByLocation = outstanding.outstandingByLocation;
  let outstandingByRegion = outstanding.outstandingByRegion;
  let criticalTasks = outstanding.criticalTasks;
  const [
    openByNameResult,
    openResult,
    waitResult,
    dueResult,
    priorityResult,
    summaryResult,
    regionLocationResult,
    criticalTasksResult,
  ] = await Promise.allSettled([
    openTasksByNameChartService.fetchOpenTasksByName(filters),
    openTasksCreatedByAssignmentChartService.fetchOpenTasksCreatedByAssignment(filters),
    waitTimeByAssignedDateChartService.fetchWaitTimeByAssignedDate(filters),
    tasksDueByDateChartService.fetchTasksDueByDate(filters),
    tasksDueByPriorityChartService.fetchTasksDueByPriority(filters),
    openTasksSummaryStatsService.fetchOpenTasksSummary(filters),
    openTasksByRegionLocationTableService.fetchOpenTasksByRegionLocation(filters),
    criticalTasksTableService.fetchCriticalTasks(filters, sort.criticalTasks),
  ]);

  const openByNameValue = settledValueWithError(openByNameResult, 'Failed to fetch open tasks by name');
  if (openByNameValue) {
    openByNameInitial = {
      breakdown: openByNameValue.breakdown,
      totals: openByNameValue.totals,
      chart: buildOpenByNameChartConfig(openByNameValue.breakdown),
    };
  }

  openByCreated = settledArrayWithFallback(
    openResult,
    'Failed to fetch open tasks by assignment from database',
    openByCreated
  );
  waitTime = settledArrayWithFallback(waitResult, 'Failed to fetch wait time from database', waitTime);
  dueByDate = settledArrayWithFallback(dueResult, 'Failed to fetch tasks due from database', dueByDate);
  priorityByDueDate = settledArrayWithFallback(
    priorityResult,
    'Failed to fetch tasks due by priority from database',
    priorityByDueDate
  );
  summary = settledValueWithFallback(summaryResult, 'Failed to fetch open tasks summary from database', summary);
  criticalTasks = settledArrayWithFallback(
    criticalTasksResult,
    'Failed to fetch critical tasks from database',
    criticalTasks
  );

  const regionLocationValue = settledValueWithError(
    regionLocationResult,
    'Failed to fetch open tasks by region/location from database'
  );
  if (regionLocationValue) {
    outstandingByLocation = regionLocationValue.locationRows;
    outstandingByRegion = regionLocationValue.regionRows;
  }

  const openTasksChart = buildOpenTasksChart(openByCreated);
  const waitTimeChart = buildWaitTimeChart(waitTime);
  const tasksDueChart = buildTasksDueChart(dueByDate);
  const tasksDuePriorityChart = buildTasksDuePriorityChart(priorityByDueDate);
  const priorityDonutChart = buildPriorityDonutChart(summary);
  const assignmentDonutChart = buildAssignmentDonutChart(summary);

  const filterOptions = await fetchFilterOptionsWithFallback(
    'Failed to fetch outstanding filter options from database'
  );
  const [regionDescriptionsResult, locationDescriptionsResult] = await Promise.allSettled([
    regionService.fetchRegionDescriptions(),
    courtVenueService.fetchCourtVenueDescriptions(),
  ]);
  const regionDescriptions = settledValueWithFallback(
    regionDescriptionsResult,
    'Failed to fetch region descriptions from database',
    {}
  );
  const locationDescriptions = settledValueWithFallback(
    locationDescriptionsResult,
    'Failed to fetch court venue descriptions from database',
    {}
  );
  const allTasks: Task[] = [];

  return buildOutstandingViewModel({
    filters,
    filterOptions,
    sort,
    criticalTasksPage,
    allTasks,
    summary,
    charts: {
      openTasks: openTasksChart,
      waitTime: waitTimeChart,
      tasksDue: tasksDueChart,
      tasksDueByPriority: tasksDuePriorityChart,
      priorityDonut: priorityDonutChart,
      assignmentDonut: assignmentDonutChart,
    },
    openByNameInitial,
    openByCreated,
    waitTime,
    dueByDate,
    priorityByDueDate,
    criticalTasks,
    outstandingByLocation,
    outstandingByRegion,
    regionDescriptions,
    locationDescriptions,
  });
}

type OpenByNameResponse = {
  breakdown: PriorityBreakdown[];
  totals: PriorityBreakdown;
  chart: Record<string, unknown>;
};

export async function fetchOpenByNameResponse(filters: AnalyticsFilters): Promise<OpenByNameResponse> {
  const { breakdown, totals } = await openTasksByNameChartService.fetchOpenTasksByName(filters);
  return {
    breakdown,
    totals,
    chart: buildOpenByNameChartConfig(breakdown),
  };
}
