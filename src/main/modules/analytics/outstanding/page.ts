import { emptyOverviewFilterOptions } from '../shared/filters';
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

const outstandingSections = [
  'open-tasks-summary',
  'open-tasks-table',
  'wait-time-table',
  'tasks-due',
  'open-tasks-priority',
  'open-by-name',
  'open-by-region-location',
  'criticalTasks',
] as const;

type OutstandingAjaxSection = (typeof outstandingSections)[number];

const deferredSections = new Set<OutstandingAjaxSection>(outstandingSections);

function resolveOutstandingSection(raw?: string): OutstandingAjaxSection | undefined {
  if (!raw) {
    return undefined;
  }
  return outstandingSections.includes(raw as OutstandingAjaxSection) ? (raw as OutstandingAjaxSection) : undefined;
}

export async function buildOutstandingPage(
  filters: AnalyticsFilters,
  sort: OutstandingSort,
  criticalTasksPage = 1,
  ajaxSection?: string
): Promise<OutstandingPageViewModel> {
  const requestedSection = resolveOutstandingSection(ajaxSection);
  const shouldFetch = (section: OutstandingAjaxSection): boolean =>
    requestedSection ? requestedSection === section : !deferredSections.has(section);
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
  let criticalTasksTotalResults = 0;
  let resolvedCriticalTasksPage = criticalTasksPage;
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
    shouldFetch('open-by-name') ? openTasksByNameChartService.fetchOpenTasksByName(filters) : Promise.resolve(null),
    shouldFetch('open-tasks-table')
      ? openTasksCreatedByAssignmentChartService.fetchOpenTasksCreatedByAssignment(filters)
      : Promise.resolve([]),
    shouldFetch('wait-time-table')
      ? waitTimeByAssignedDateChartService.fetchWaitTimeByAssignedDate(filters)
      : Promise.resolve([]),
    shouldFetch('tasks-due') ? tasksDueByDateChartService.fetchTasksDueByDate(filters) : Promise.resolve([]),
    shouldFetch('open-tasks-priority')
      ? tasksDueByPriorityChartService.fetchTasksDueByPriority(filters)
      : Promise.resolve([]),
    shouldFetch('open-tasks-summary')
      ? openTasksSummaryStatsService.fetchOpenTasksSummary(filters)
      : Promise.resolve(null),
    shouldFetch('open-by-region-location')
      ? openTasksByRegionLocationTableService.fetchOpenTasksByRegionLocation(filters)
      : Promise.resolve(null),
    shouldFetch('criticalTasks')
      ? criticalTasksTableService.fetchCriticalTasksPage(filters, sort.criticalTasks, criticalTasksPage)
      : Promise.resolve(null),
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
  const criticalTasksValue = settledValueWithFallback(
    criticalTasksResult,
    'Failed to fetch critical tasks from database',
    { rows: criticalTasks, totalResults: 0, page: criticalTasksPage }
  );
  criticalTasks = criticalTasksValue.rows;
  criticalTasksTotalResults = criticalTasksValue.totalResults;
  resolvedCriticalTasksPage = criticalTasksValue.page;

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

  const filterOptions = requestedSection
    ? emptyOverviewFilterOptions()
    : await fetchFilterOptionsWithFallback('Failed to fetch outstanding filter options from database');
  const needsRegionDescriptions = shouldFetch('open-by-region-location');
  const needsLocationDescriptions = shouldFetch('open-by-region-location') || shouldFetch('criticalTasks');
  const [regionDescriptionsResult, locationDescriptionsResult] = await Promise.allSettled([
    needsRegionDescriptions ? regionService.fetchRegionDescriptions() : Promise.resolve({}),
    needsLocationDescriptions ? courtVenueService.fetchCourtVenueDescriptions() : Promise.resolve({}),
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
    criticalTasksPage: resolvedCriticalTasksPage,
    criticalTasksTotalResults,
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
