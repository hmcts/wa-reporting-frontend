import {
  fetchFilterOptionsWithFallback,
  normaliseDateRange,
  settledArrayWithFallback,
  settledValueWithError,
  settledValueWithFallback,
} from '../shared/pageUtils';
import { CompletedTaskAuditRow, taskThinRepository } from '../shared/repositories';
import { caseWorkerProfileService, courtVenueService, regionService } from '../shared/services';
import { AnalyticsFilters, CompletedMetric, CompletedResponse, Task } from '../shared/types';
import { lookup } from '../shared/utils';

import { completedService } from './service';
import { TaskAuditEntry, buildCompletedViewModel } from './viewModel';
import { completedByNameChartService } from './visuals/completedByNameChartService';
import { completedComplianceSummaryService } from './visuals/completedComplianceSummaryService';
import { completedProcessingHandlingTimeService } from './visuals/completedProcessingHandlingTimeService';
import { completedRegionLocationTableService } from './visuals/completedRegionLocationTableService';
import { completedTimelineChartService } from './visuals/completedTimelineChartService';

type CompletedPageViewModel = ReturnType<typeof buildCompletedViewModel>;

function mapTaskAuditRow(
  row: CompletedTaskAuditRow,
  caseWorkerNames: Record<string, string>,
  locationDescriptions: Record<string, string>
): TaskAuditEntry {
  const assigneeId = row.assignee ?? undefined;
  const agentName = assigneeId ? caseWorkerNames[assigneeId] ?? assigneeId : '-';
  return {
    caseId: row.case_id,
    taskName: row.task_name ?? '-',
    agentName,
    completedDate: row.completed_date ?? '-',
    totalAssignments: (row.number_of_reassignments ?? 0) + 1,
    location: row.location ? lookup(row.location, locationDescriptions) : '-',
    status: row.termination_process_label ?? '-',
  };
}

export async function buildCompletedPage(
  filters: AnalyticsFilters,
  selectedMetric: CompletedMetric,
  caseId?: string
): Promise<CompletedPageViewModel> {
  const fallback = completedService.buildCompleted([]);
  const fallbackRegionLocation = completedService.buildCompletedByRegionLocation([]);

  const filterOptions = await fetchFilterOptionsWithFallback('Failed to fetch completed filter options from database');
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

  let summary = fallback.summary;
  let timeline = fallback.timeline;
  let completedByName = fallback.completedByName;
  let completedByLocation = fallbackRegionLocation.byLocation;
  let completedByRegion = fallbackRegionLocation.byRegion;
  const range = normaliseDateRange({ from: filters.completedFrom, to: filters.completedTo });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    rangeSummaryResult,
    todaySummaryResult,
    timelineResult,
    processingHandlingResult,
    completedByNameResult,
    completedByLocationResult,
    completedByRegionResult,
    taskAuditRowsResult,
    caseWorkerNamesResult,
  ] = await Promise.allSettled([
    completedComplianceSummaryService.fetchCompletedSummary(filters, range),
    completedComplianceSummaryService.fetchCompletedSummary(filters, { from: today, to: today }),
    completedTimelineChartService.fetchCompletedTimeline(filters, range),
    completedProcessingHandlingTimeService.fetchCompletedProcessingHandlingTime(filters, range),
    completedByNameChartService.fetchCompletedByName(filters, range),
    completedRegionLocationTableService.fetchCompletedByLocation(filters, range),
    completedRegionLocationTableService.fetchCompletedByRegion(filters, range),
    caseId ? taskThinRepository.fetchCompletedTaskAuditRows(filters, caseId) : Promise.resolve([]),
    caseWorkerProfileService.fetchCaseWorkerProfileNames(),
  ]);

  const rangeSummary = settledValueWithError(rangeSummaryResult, 'Failed to fetch completed summary from database');
  if (rangeSummary) {
    summary = {
      ...summary,
      completedInRange: rangeSummary.total,
      withinDueYes: rangeSummary.within,
      withinDueNo: rangeSummary.total - rangeSummary.within,
    };
  }

  const todaySummary = settledValueWithError(
    todaySummaryResult,
    'Failed to fetch completed today summary from database'
  );
  if (todaySummary) {
    summary = {
      ...summary,
      completedToday: todaySummary.total,
      withinDueTodayYes: todaySummary.within,
      withinDueTodayNo: todaySummary.total - todaySummary.within,
    };
  }

  timeline = settledArrayWithFallback(timelineResult, 'Failed to fetch completed timeline from database', timeline);
  const processingHandlingTime = settledArrayWithFallback(
    processingHandlingResult,
    'Failed to fetch processing/handling time stats from database',
    fallback.processingHandlingTime
  );
  completedByName = settledArrayWithFallback(
    completedByNameResult,
    'Failed to fetch completed by name from database',
    completedByName
  );
  completedByLocation = settledArrayWithFallback(
    completedByLocationResult,
    'Failed to fetch completed by location from database',
    completedByLocation
  );
  completedByRegion = settledArrayWithFallback(
    completedByRegionResult,
    'Failed to fetch completed by region from database',
    completedByRegion
  );
  const taskAuditRows = settledArrayWithFallback(
    taskAuditRowsResult,
    'Failed to fetch completed task audit rows from database',
    []
  );
  const caseWorkerNames = settledValueWithFallback(
    caseWorkerNamesResult,
    'Failed to fetch case worker profiles from database',
    {}
  );

  const completed: CompletedResponse = {
    ...fallback,
    summary,
    timeline,
    completedByName,
    processingHandlingTime,
  };

  return buildCompletedViewModel({
    filters,
    completed,
    allTasks,
    filterOptions,
    completedByLocation,
    completedByRegion,
    regionDescriptions,
    locationDescriptions,
    taskAuditRows: taskAuditRows.map(row => mapTaskAuditRow(row, caseWorkerNames, locationDescriptions)),
    taskAuditCaseId: caseId ?? '',
    selectedMetric,
  });
}
