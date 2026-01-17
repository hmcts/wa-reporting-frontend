import { buildFilterOptionsViewModel } from '../shared/filters';
import { buildDateParts, formatNumber, formatPercent } from '../shared/formatting';
import { PaginationMeta } from '../shared/pagination';
import type { FilterOptions } from '../shared/services';
import { AnalyticsFilters, Task, UserOverviewResponse } from '../shared/types';
import { UserOverviewSort } from '../shared/userOverviewSort';
import { lookup, normaliseLabel } from '../shared/utils';
import type { FilterOptionsViewModel, SelectOption } from '../shared/viewModels/filterOptions';
import { buildPriorityRows } from '../shared/viewModels/priorityRows';
import { TableHeadCell, buildSortHeadCell } from '../shared/viewModels/sortHead';

import { paginateAssignedTasks, paginateCompletedTasks } from './pagination';
import { CompletedByDatePoint, UserOverviewMetrics } from './service';
import { CompletedByTaskNameAggregate } from './types';
import {
  buildUserCompletedByDateChart,
  buildUserCompletedComplianceChart,
  buildUserPriorityChart,
} from './visuals/charts';

type UserOverviewViewModel = FilterOptionsViewModel & {
  filters: AnalyticsFilters;
  completedFrom: { day: string; month: string; year: string };
  completedTo: { day: string; month: string; year: string };
  userOptions: SelectOption[];
  prioritySummary: UserOverviewResponse['prioritySummary'];
  assignedSort: UserOverviewSort['assigned'];
  completedSort: UserOverviewSort['completed'];
  assignedHead: TableHeadCell[];
  completedHead: TableHeadCell[];
  assignedPagination: PaginationMeta;
  completedPagination: PaginationMeta;
  charts: {
    priority: string;
    completedByDate: string;
    completedCompliance: string;
  };
  assignedSummaryRows: { key: { text: string }; value: { text: string } }[];
  completedSummaryRows: { key: { text: string }; value: { text: string } }[];
  assignedRows: UserOverviewAssignedRow[];
  completedRows: UserOverviewCompletedRow[];
  completedByTaskNameRows: { text: string }[][];
  completedByTaskNameTotalsRow: { text: string }[];
  completedByDateRows: { text: string }[][];
  completedByDateTotalsRow: { text: string }[];
};

function formatAverage(valueSum: number, valueCount: number): string {
  if (valueCount === 0) {
    return '-';
  }
  return formatNumber(valueSum / valueCount, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type UserOverviewAssignedRow = {
  caseId: string;
  createdDate: string;
  taskName: string;
  assignedDate: string;
  dueDate: string;
  priority: string;
  totalAssignments: string;
  assigneeName: string;
  location: string;
};

type UserOverviewCompletedRow = {
  caseId: string;
  createdDate: string;
  taskName: string;
  assignedDate: string;
  dueDate: string;
  completedDate: string;
  handlingTimeDays: string;
  withinDue: string;
  totalAssignments: string;
  assigneeName: string;
  location: string;
};

type SortHeadContext = {
  sort: UserOverviewSort;
};

function buildAssignedHead(context: SortHeadContext): TableHeadCell[] {
  const { sort } = context;
  const current = sort.assigned;

  return [
    buildSortHeadCell({
      label: 'Case ID',
      sortKey: 'caseId',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Created date',
      sortKey: 'createdDate',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Task name',
      sortKey: 'taskName',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Assigned date',
      sortKey: 'assignedDate',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Due date',
      sortKey: 'dueDate',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Priority',
      sortKey: 'priority',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Total assignments',
      sortKey: 'totalAssignments',
      format: 'numeric',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Assignee',
      sortKey: 'assignee',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Location',
      sortKey: 'location',
      activeSort: current,
    }),
  ];
}

function buildCompletedHead(context: SortHeadContext): TableHeadCell[] {
  const { sort } = context;
  const current = sort.completed;

  return [
    buildSortHeadCell({
      label: 'Case ID',
      sortKey: 'caseId',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Created date',
      sortKey: 'createdDate',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Task name',
      sortKey: 'taskName',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Assigned date',
      sortKey: 'assignedDate',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Due date',
      sortKey: 'dueDate',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Completed date',
      sortKey: 'completedDate',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Handling time (days)',
      sortKey: 'handlingTimeDays',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Within due date',
      sortKey: 'withinDue',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Total assignments',
      sortKey: 'totalAssignments',
      format: 'numeric',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Assignee',
      sortKey: 'assignee',
      activeSort: current,
    }),
    buildSortHeadCell({
      label: 'Location',
      sortKey: 'location',
      activeSort: current,
    }),
  ];
}

function buildCompletedByDateRows(rows: CompletedByDatePoint[]): { text: string }[][] {
  return rows.map(row => [
    { text: row.date },
    { text: formatNumber(row.tasks) },
    { text: formatNumber(row.withinDue) },
    {
      text: formatPercent((row.withinDue / (row.tasks || 1)) * 100, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    },
    { text: formatNumber(row.beyondDue) },
    { text: formatAverage(row.handlingTimeSum, row.handlingTimeCount) },
  ]);
}

function buildCompletedByDateTotalsRow(rows: CompletedByDatePoint[]): { text: string }[] {
  const totals = rows.reduce(
    (acc, row) => ({
      tasks: acc.tasks + row.tasks,
      withinDue: acc.withinDue + row.withinDue,
      beyondDue: acc.beyondDue + row.beyondDue,
      handlingTimeSum: acc.handlingTimeSum + row.handlingTimeSum,
      handlingTimeCount: acc.handlingTimeCount + row.handlingTimeCount,
    }),
    { tasks: 0, withinDue: 0, beyondDue: 0, handlingTimeSum: 0, handlingTimeCount: 0 }
  );
  return [
    { text: 'Total' },
    { text: formatNumber(totals.tasks) },
    { text: formatNumber(totals.withinDue) },
    {
      text: formatPercent((totals.withinDue / (totals.tasks || 1)) * 100, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    },
    { text: formatNumber(totals.beyondDue) },
    { text: formatAverage(totals.handlingTimeSum, totals.handlingTimeCount) },
  ];
}

export function buildUserOverviewViewModel(params: {
  filters: AnalyticsFilters;
  overview: UserOverviewMetrics;
  allTasks: Task[];
  assignedTasks: Task[];
  completedTasks: Task[];
  completedComplianceSummary: {
    total: number;
    withinDueYes: number;
    withinDueNo: number;
  };
  completedByDate: CompletedByDatePoint[];
  completedByTaskName: CompletedByTaskNameAggregate[];
  filterOptions: FilterOptions;
  locationDescriptions: Record<string, string>;
  sort: UserOverviewSort;
  assignedPage: number;
  completedPage: number;
}): UserOverviewViewModel {
  const {
    filters,
    overview,
    allTasks,
    assignedTasks,
    completedTasks,
    completedComplianceSummary,
    completedByDate,
    completedByTaskName,
    filterOptions,
    locationDescriptions,
    sort,
    assignedPage,
    completedPage,
  } = params;
  const userOptions = filterOptions.users.length > 0 ? filterOptions.users : [{ value: '', text: 'All users' }];

  const priorityChart = buildUserPriorityChart(overview.prioritySummary);
  const completedByDateChart = buildUserCompletedByDateChart(completedByDate);
  const completedComplianceChart = buildUserCompletedComplianceChart(completedComplianceSummary);
  const filterViewModel = buildFilterOptionsViewModel(filterOptions, allTasks);
  const completedByTaskNameAggregates = completedByTaskName
    .map(row => ({
      ...row,
      taskName: normaliseLabel(row.taskName, 'Unknown'),
    }))
    .sort((a, b) => b.tasks - a.tasks || a.taskName.localeCompare(b.taskName));
  const completedByTaskNameTotals = completedByTaskNameAggregates.reduce(
    (acc, row) => ({
      tasks: acc.tasks + row.tasks,
      handlingTimeSum: acc.handlingTimeSum + row.handlingTimeSum,
      handlingTimeCount: acc.handlingTimeCount + row.handlingTimeCount,
      daysBeyondSum: acc.daysBeyondSum + row.daysBeyondSum,
      daysBeyondCount: acc.daysBeyondCount + row.daysBeyondCount,
    }),
    { tasks: 0, handlingTimeSum: 0, handlingTimeCount: 0, daysBeyondSum: 0, daysBeyondCount: 0 }
  );
  const { pagedRows: assignedPagedRows, pagination: assignedPagination } = paginateAssignedTasks({
    rows: assignedTasks,
    filters,
    sort: sort.assigned,
    page: assignedPage,
  });
  const { pagedRows: completedPagedRows, pagination: completedPagination } = paginateCompletedTasks({
    rows: completedTasks,
    filters,
    sort: sort.completed,
    page: completedPage,
  });

  return {
    filters,
    ...filterViewModel,
    completedFrom: buildDateParts(filters.completedFrom),
    completedTo: buildDateParts(filters.completedTo),
    userOptions,
    prioritySummary: overview.prioritySummary,
    assignedSort: sort.assigned,
    completedSort: sort.completed,
    assignedHead: buildAssignedHead({ sort }),
    completedHead: buildCompletedHead({ sort }),
    assignedPagination,
    completedPagination,
    charts: {
      priority: priorityChart,
      completedByDate: completedByDateChart,
      completedCompliance: completedComplianceChart,
    },
    assignedSummaryRows: [
      { key: { text: 'Total assigned' }, value: { text: formatNumber(overview.assigned.length) } },
      ...buildPriorityRows(overview.prioritySummary).map(row => ({
        key: { text: row.label },
        value: { text: row.value },
      })),
    ],
    completedSummaryRows: [
      { key: { text: 'Completed' }, value: { text: formatNumber(completedComplianceSummary.total) } },
      { key: { text: 'Within due date' }, value: { text: formatNumber(completedComplianceSummary.withinDueYes) } },
      { key: { text: 'Beyond due date' }, value: { text: formatNumber(completedComplianceSummary.withinDueNo) } },
    ],
    assignedRows: assignedPagedRows.map(row => ({
      caseId: row.caseId,
      createdDate: row.createdDate,
      taskName: row.taskName,
      assignedDate: row.assignedDate ?? '-',
      dueDate: row.dueDate ?? '-',
      priority: row.priority,
      totalAssignments: formatNumber(row.totalAssignments ?? 0),
      assigneeName: row.assigneeName ?? '',
      location: lookup(row.location, locationDescriptions),
    })),
    completedRows: completedPagedRows.map(row => ({
      caseId: row.caseId,
      createdDate: row.createdDate,
      taskName: row.taskName,
      assignedDate: row.assignedDate ?? '-',
      dueDate: row.dueDate ?? '-',
      completedDate: row.completedDate ?? '-',
      handlingTimeDays:
        row.handlingTimeDays !== undefined
          ? formatNumber(row.handlingTimeDays, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '-',
      withinDue: row.withinSla === null || row.withinSla === undefined ? '-' : row.withinSla ? 'Yes' : 'No',
      totalAssignments: formatNumber(row.totalAssignments ?? 0),
      assigneeName: row.assigneeName ?? '',
      location: lookup(row.location, locationDescriptions),
    })),
    completedByTaskNameRows: completedByTaskNameAggregates.map(row => [
      { text: row.taskName },
      { text: formatNumber(row.tasks) },
      { text: formatAverage(row.handlingTimeSum, row.handlingTimeCount) },
      { text: formatAverage(row.daysBeyondSum, row.daysBeyondCount) },
    ]),
    completedByTaskNameTotalsRow: [
      { text: 'Total' },
      { text: formatNumber(completedByTaskNameTotals.tasks) },
      { text: formatAverage(completedByTaskNameTotals.handlingTimeSum, completedByTaskNameTotals.handlingTimeCount) },
      { text: formatAverage(completedByTaskNameTotals.daysBeyondSum, completedByTaskNameTotals.daysBeyondCount) },
    ],
    completedByDateRows: buildCompletedByDateRows(completedByDate),
    completedByDateTotalsRow: buildCompletedByDateTotalsRow(completedByDate),
  };
}
