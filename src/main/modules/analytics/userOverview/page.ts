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

import { CompletedByDatePoint, userOverviewService } from './service';
import { CompletedByTaskNameAggregate } from './types';
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
    completedByDateResult,
    completedByTaskNameResult,
    completedComplianceResult,
    locationDescriptionsResult,
    caseWorkerNamesResult,
  ] = await Promise.allSettled([
    taskThinRepository.fetchUserOverviewAssignedTaskRows(filters, sort.assigned),
    taskThinRepository.fetchUserOverviewCompletedTaskRows(filters, sort.completed),
    taskThinRepository.fetchUserOverviewAssignedTaskRows(filters, sort.assigned, null),
    taskThinRepository.fetchUserOverviewCompletedByDateRows(filters),
    taskThinRepository.fetchUserOverviewCompletedByTaskNameRows(filters),
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
  const completedByDateRows = settledArrayWithFallback(
    completedByDateResult,
    'Failed to fetch user overview completed by date rows from database',
    []
  );
  const completedByTaskNameRows = settledArrayWithFallback(
    completedByTaskNameResult,
    'Failed to fetch user overview completed by task name rows from database',
    []
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
  const allTasks = [...assignedTasksAll, ...completedTasks];
  const overview = userOverviewService.buildUserOverview(allTasks);
  const filterOptions = await fetchFilterOptionsWithFallback(
    'Failed to fetch user overview filter options from database'
  );

  const completedByDate: CompletedByDatePoint[] = completedByDateRows.map(row => ({
    date: row.date_key,
    tasks: row.tasks,
    withinDue: row.within_due,
    beyondDue: row.beyond_due,
    handlingTimeSum: row.handling_time_sum ?? 0,
    handlingTimeCount: row.handling_time_count,
  }));
  const completedByTaskName: CompletedByTaskNameAggregate[] = completedByTaskNameRows.map(row => ({
    taskName: row.task_name ?? 'Unknown',
    tasks: row.tasks,
    handlingTimeSum: row.handling_time_sum ?? 0,
    handlingTimeCount: row.handling_time_count,
    daysBeyondSum: row.days_beyond_sum ?? 0,
    daysBeyondCount: row.days_beyond_count,
  }));
  const completedByDateTotals = completedByDate.reduce(
    (acc, row) => ({
      tasks: acc.tasks + row.tasks,
      withinDue: acc.withinDue + row.withinDue,
    }),
    { tasks: 0, withinDue: 0 }
  );
  const completedComplianceSummary = {
    total: completedCompliance?.total ?? completedByDateTotals.tasks,
    withinDueYes: completedCompliance?.within ?? completedByDateTotals.withinDue,
    withinDueNo:
      completedCompliance?.within !== undefined
        ? completedCompliance.total - completedCompliance.within
        : completedByDateTotals.tasks - completedByDateTotals.withinDue,
  };

  return buildUserOverviewViewModel({
    filters,
    overview,
    allTasks,
    assignedTasks,
    completedTasks,
    completedByDate,
    completedByTaskName,
    completedComplianceSummary,
    filterOptions,
    locationDescriptions,
    sort,
    assignedPage,
    completedPage,
  });
}
