import { completedComplianceSummaryService } from '../completed/visuals/completedComplianceSummaryService';
import {
  fetchFilterOptionsWithFallback,
  normaliseDateRange,
  settledArrayWithFallback,
  settledValueWithFallback,
} from '../shared/pageUtils';
import { UserOverviewTaskRow, taskThinRepository } from '../shared/repositories';
import { caseWorkerProfileService, courtVenueService } from '../shared/services';
import { AnalyticsFilters, Task, TaskPriority, TaskStatus } from '../shared/types';
import { UserOverviewSort } from '../shared/userOverviewSort';

import { userOverviewService } from './service';
import { buildUserOverviewViewModel } from './viewModel';

type UserOverviewPageViewModel = ReturnType<typeof buildUserOverviewViewModel>;

function mapUserOverviewRow(row: UserOverviewTaskRow, caseWorkerNames: Record<string, string>): Task {
  const totalAssignments = (row.number_of_reassignments ?? 0) + 1;
  const withinSla = row.is_within_sla === 'Yes' ? true : row.is_within_sla === 'No' ? false : null;
  const assigneeId = row.assignee ?? undefined;
  const assigneeName = assigneeId ? caseWorkerNames[assigneeId] ?? assigneeId : undefined;
  return {
    caseId: row.case_id,
    taskId: row.task_id,
    service: row.jurisdiction_label ?? '',
    roleCategory: row.role_category_label ?? '',
    region: row.region ?? '',
    location: row.location ?? '',
    taskName: row.task_name ?? '',
    priority: row.priority as TaskPriority,
    createdDate: row.created_date ?? '-',
    assignedDate: row.first_assigned_date ?? undefined,
    dueDate: row.due_date ?? undefined,
    completedDate: row.completed_date ?? undefined,
    handlingTimeDays: row.handling_time_days ?? undefined,
    withinSla,
    assigneeId,
    assigneeName,
    totalAssignments,
  };
}

export async function buildUserOverviewPage(
  filters: AnalyticsFilters,
  sort: UserOverviewSort,
  assignedPage = 1,
  completedPage = 1
): Promise<UserOverviewPageViewModel> {
  const range = normaliseDateRange({ from: filters.completedFrom, to: filters.completedTo });
  const [
    assignedResult,
    completedResult,
    assignedAllResult,
    completedAllResult,
    completedComplianceResult,
    locationDescriptionsResult,
    caseWorkerNamesResult,
  ] = await Promise.allSettled([
    taskThinRepository.fetchUserOverviewAssignedTaskRows(filters, sort.assigned),
    taskThinRepository.fetchUserOverviewCompletedTaskRows(filters, sort.completed),
    taskThinRepository.fetchUserOverviewAssignedTaskRows(filters, sort.assigned, null),
    taskThinRepository.fetchUserOverviewCompletedTaskRows(filters, sort.completed, null),
    completedComplianceSummaryService.fetchCompletedSummary(filters, range),
    courtVenueService.fetchCourtVenueDescriptions(),
    caseWorkerProfileService.fetchCaseWorkerProfileNames(),
  ]);
  const assignedRows = settledArrayWithFallback(
    assignedResult,
    'Failed to fetch user overview assigned tasks from database',
    []
  );
  const completedRows = settledArrayWithFallback(
    completedResult,
    'Failed to fetch user overview completed tasks from database',
    []
  );
  const assignedAllRows = settledArrayWithFallback(
    assignedAllResult,
    'Failed to fetch user overview assigned tasks for charts from database',
    assignedRows
  );
  const completedAllRows = settledArrayWithFallback(
    completedAllResult,
    'Failed to fetch user overview completed tasks for charts from database',
    completedRows
  );
  const completedCompliance = settledValueWithFallback(
    completedComplianceResult,
    'Failed to fetch completed compliance summary from database',
    null
  );
  const locationDescriptions = settledValueWithFallback(
    locationDescriptionsResult,
    'Failed to fetch court venue descriptions from database',
    {}
  );
  const caseWorkerNames = settledValueWithFallback(
    caseWorkerNamesResult,
    'Failed to fetch case worker profiles from database',
    {}
  );
  const assignedTasks = assignedRows.map(row => ({
    ...mapUserOverviewRow(row, caseWorkerNames),
    status: 'assigned' as TaskStatus,
  }));
  const completedTasks = completedRows.map(row => ({
    ...mapUserOverviewRow(row, caseWorkerNames),
    status: 'completed' as TaskStatus,
  }));
  const assignedTasksAll = assignedAllRows.map(row => ({
    ...mapUserOverviewRow(row, caseWorkerNames),
    status: 'assigned' as TaskStatus,
  }));
  const completedTasksAll = completedAllRows.map(row => ({
    ...mapUserOverviewRow(row, caseWorkerNames),
    status: 'completed' as TaskStatus,
  }));
  const allTasks = [...assignedTasksAll, ...completedTasksAll];
  const overview = userOverviewService.buildUserOverview(allTasks);
  const completedComplianceSummary = {
    total: completedCompliance?.total ?? overview.completedSummary.total,
    withinDueYes: completedCompliance?.within ?? overview.completedSummary.withinDueYes,
    withinDueNo:
      completedCompliance?.within !== undefined
        ? completedCompliance.total - completedCompliance.within
        : overview.completedSummary.withinDueNo,
  };

  const filterOptions = await fetchFilterOptionsWithFallback(
    'Failed to fetch user overview filter options from database'
  );

  return buildUserOverviewViewModel({
    filters,
    overview,
    allTasks,
    assignedTasks,
    completedTasks,
    completedComplianceSummary,
    filterOptions,
    locationDescriptions,
    sort,
    assignedPage,
    completedPage,
  });
}
