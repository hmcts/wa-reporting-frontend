import { buildFilterOptionsViewModel } from '../shared/filters';
import { formatNumber, formatPercent } from '../shared/formatting';
import { OutstandingSort } from '../shared/outstandingSort';
import { FilterOptions } from '../shared/services';
import {
  AnalyticsFilters,
  AssignmentSeriesPoint,
  CriticalTask,
  DueByDatePoint,
  OutstandingByLocationRow,
  OutstandingByRegionRow,
  PriorityBreakdown,
  PrioritySeriesPoint,
  WaitTimePoint,
} from '../shared/types';
import { lookup } from '../shared/utils';
import { FilterOptionsViewModel } from '../shared/viewModels/filterOptions';
import { buildPriorityRows } from '../shared/viewModels/priorityRows';
import { TableHeadCell, buildSortHeadCell } from '../shared/viewModels/sortHead';
import { buildTotalRow, buildTotalsRowWithLabelColumns, sumBy } from '../shared/viewModels/totalsRow';

import { CriticalTasksPagination, paginateCriticalTasks } from './criticalTasksPagination';

type OpenByNameInitial = {
  breakdown: PriorityBreakdown[];
  totals: PriorityBreakdown;
  chart: Record<string, unknown>;
};

type TableRow = { text: string }[];
type TableRows = TableRow[];
type CriticalTaskView = CriticalTask;

type OpenTasksTotals = { open: number; assigned: number; unassigned: number };
type WaitTimeTotals = { assignedCount: number; weightedTotal: number; average: number };
type DueTotals = { totalDue: number; open: number; completed: number };
type PriorityTotals = { urgent: number; high: number; medium: number; low: number };
type OutstandingTotals = { open: number; urgent: number; high: number; medium: number; low: number };

export type OutstandingViewModel = FilterOptionsViewModel & {
  filters: AnalyticsFilters;
  criticalTasksSort: OutstandingSort['criticalTasks'];
  criticalTasksHead: TableHeadCell[];
  criticalTasks: CriticalTaskView[];
  criticalTasksPagination: CriticalTasksPagination;
  summary: {
    open: number;
    assigned: number;
    unassigned: number;
    assignedPct: number;
    unassignedPct: number;
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  charts: {
    openTasks: string;
    waitTime: string;
    tasksDue: string;
    tasksDueByPriority: string;
    priorityDonut: string;
    assignmentDonut: string;
  };
  openByNameInitial: OpenByNameInitial;
  openByNameRows: TableRows;
  openByNameTotalsRow: TableRow;
  openTasksRows: TableRows;
  openTasksTotalsRow: TableRow;
  waitTimeRows: TableRows;
  waitTimeTotalsRow: TableRow;
  tasksDueRows: TableRows;
  tasksDueTotalsRow: TableRow;
  tasksDuePriorityRows: TableRows;
  tasksDuePriorityTotalsRow: TableRow;
  priorityTableRows: TableRows;
  outstandingByRegionRows: TableRows;
  outstandingByRegionTotalsRow: TableRow;
  outstandingByLocationRows: TableRows;
  outstandingByLocationTotalsRow: TableRow;
  outstandingByRegionLocationRows: TableRows;
  outstandingByRegionLocationTotalsRow: TableRow;
};

function buildOpenByNameRows(breakdown: PriorityBreakdown[]): TableRows {
  return breakdown.map(row => [
    { text: row.name },
    { text: formatNumber(row.urgent) },
    { text: formatNumber(row.high) },
    { text: formatNumber(row.medium) },
    { text: formatNumber(row.low) },
  ]);
}

function buildOpenByNameTotalsRow(totals: PriorityBreakdown): TableRow {
  return buildTotalRow([totals.urgent, totals.high, totals.medium, totals.low]);
}

function calculateOpenTasksTotals(openByCreated: AssignmentSeriesPoint[]): OpenTasksTotals {
  return {
    open: sumBy(openByCreated, point => point.open),
    assigned: sumBy(openByCreated, point => point.assigned),
    unassigned: sumBy(openByCreated, point => point.unassigned),
  };
}

function buildOpenTasksRows(openByCreated: AssignmentSeriesPoint[]): TableRows {
  return openByCreated.map(point => [
    { text: point.date },
    { text: formatNumber(point.open) },
    { text: formatNumber(point.assigned) },
    {
      text: formatPercent(point.assignedPct, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    },
    { text: formatNumber(point.unassigned) },
    {
      text: formatPercent(point.unassignedPct, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    },
  ]);
}

function buildOpenTasksTotalsRow(openTasksTotals: OpenTasksTotals): TableRow {
  return buildTotalRow([
    openTasksTotals.open,
    openTasksTotals.assigned,
    formatPercent((openTasksTotals.assigned / openTasksTotals.open) * 100, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
    openTasksTotals.unassigned,
    formatPercent((openTasksTotals.unassigned / openTasksTotals.open) * 100, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  ]);
}

function calculateWaitTimeTotals(waitTime: WaitTimePoint[]): WaitTimeTotals {
  const assignedCount = sumBy(waitTime, point => point.assignedCount);
  const weightedTotal = sumBy(waitTime, point => point.averageWaitDays * point.assignedCount);
  const average = assignedCount === 0 ? 0 : weightedTotal / assignedCount;
  return { assignedCount, weightedTotal, average };
}

function buildWaitTimeRows(waitTime: WaitTimePoint[]): TableRows {
  return waitTime.map(point => [
    { text: point.date },
    { text: formatNumber(point.assignedCount) },
    { text: formatNumber(point.averageWaitDays, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) },
  ]);
}

function buildWaitTimeTotalsRow(waitTimeTotals: WaitTimeTotals): TableRow {
  return buildTotalRow([
    waitTimeTotals.assignedCount,
    formatNumber(waitTimeTotals.average, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  ]);
}

function calculateDueTotals(dueByDate: DueByDatePoint[]): DueTotals {
  return {
    totalDue: sumBy(dueByDate, point => point.totalDue),
    open: sumBy(dueByDate, point => point.open),
    completed: sumBy(dueByDate, point => point.completed),
  };
}

function buildTasksDueRows(dueByDate: DueByDatePoint[]): TableRows {
  return dueByDate.map(point => [
    { text: point.date },
    { text: formatNumber(point.totalDue) },
    { text: formatNumber(point.open) },
    { text: formatNumber(point.completed) },
  ]);
}

function buildTasksDueTotalsRow(dueTotals: DueTotals): TableRow {
  return buildTotalRow([dueTotals.totalDue, dueTotals.open, dueTotals.completed]);
}

function calculatePriorityTotals(priorityByDueDate: PrioritySeriesPoint[]): PriorityTotals {
  return {
    urgent: sumBy(priorityByDueDate, point => point.urgent),
    high: sumBy(priorityByDueDate, point => point.high),
    medium: sumBy(priorityByDueDate, point => point.medium),
    low: sumBy(priorityByDueDate, point => point.low),
  };
}

function buildTasksDuePriorityRows(priorityByDueDate: PrioritySeriesPoint[]): TableRows {
  return priorityByDueDate.map(point => [
    { text: point.date },
    { text: formatNumber(point.urgent + point.high + point.medium + point.low) },
    { text: formatNumber(point.urgent) },
    { text: formatNumber(point.high) },
    { text: formatNumber(point.medium) },
    { text: formatNumber(point.low) },
  ]);
}

function buildTasksDuePriorityTotalsRow(priorityTotals: PriorityTotals): TableRow {
  return buildTotalRow([
    priorityTotals.urgent + priorityTotals.high + priorityTotals.medium + priorityTotals.low,
    priorityTotals.urgent,
    priorityTotals.high,
    priorityTotals.medium,
    priorityTotals.low,
  ]);
}

function buildPriorityTableRows(summary: { urgent: number; high: number; medium: number; low: number }): TableRows {
  return buildPriorityRows(summary).map(row => [{ text: row.label }, { text: row.value }]);
}

function buildCriticalTasks(criticalTasks: CriticalTask[], locationLookup: Record<string, string>): CriticalTaskView[] {
  return criticalTasks.map(task => ({
    ...task,
    location: lookup(task.location, locationLookup),
  }));
}

function buildCriticalTasksHead(sort: OutstandingSort): TableHeadCell[] {
  const current = sort.criticalTasks;
  return [
    buildSortHeadCell({ label: 'Case ID', sortKey: 'caseId', activeSort: current }),
    buildSortHeadCell({ label: 'Case type', sortKey: 'caseType', activeSort: current }),
    buildSortHeadCell({ label: 'Location', sortKey: 'location', activeSort: current }),
    buildSortHeadCell({ label: 'Task name', sortKey: 'taskName', activeSort: current }),
    buildSortHeadCell({ label: 'Created date', sortKey: 'createdDate', activeSort: current }),
    buildSortHeadCell({ label: 'Due date', sortKey: 'dueDate', activeSort: current }),
    buildSortHeadCell({ label: 'Priority', sortKey: 'priority', activeSort: current }),
    buildSortHeadCell({ label: 'Agent name', sortKey: 'agentName', activeSort: current }),
  ];
}

function calculateOutstandingTotals(rows: OutstandingTotals[]): OutstandingTotals {
  return rows.reduce(
    (acc, row) => ({
      open: acc.open + row.open,
      urgent: acc.urgent + row.urgent,
      high: acc.high + row.high,
      medium: acc.medium + row.medium,
      low: acc.low + row.low,
    }),
    { open: 0, urgent: 0, high: 0, medium: 0, low: 0 }
  );
}

function buildOutstandingTotalsRow(totals: OutstandingTotals, labelColumns: number): TableRow {
  return buildTotalsRowWithLabelColumns('Total', labelColumns, [
    totals.open,
    totals.urgent,
    totals.high,
    totals.medium,
    totals.low,
  ]);
}

function buildOutstandingRegionRows(rows: OutstandingByRegionRow[], regionLookup: Record<string, string>): TableRows {
  return rows
    .map(row => [
      { text: lookup(row.region, regionLookup) },
      { text: formatNumber(row.open) },
      { text: formatNumber(row.urgent) },
      { text: formatNumber(row.high) },
      { text: formatNumber(row.medium) },
      { text: formatNumber(row.low) },
    ])
    .sort((a, b) => a[0].text.localeCompare(b[0].text));
}

function buildOutstandingLocationRows(
  rows: OutstandingByLocationRow[],
  includeRegion: boolean,
  locationLookup: Record<string, string>,
  regionLookup: Record<string, string>
): TableRows {
  return rows
    .map(row => {
      const cells = [{ text: lookup(row.location, locationLookup) }];
      if (includeRegion) {
        cells.push({ text: lookup(row.region, regionLookup) });
      }
      return cells.concat([
        { text: formatNumber(row.open) },
        { text: formatNumber(row.urgent) },
        { text: formatNumber(row.high) },
        { text: formatNumber(row.medium) },
        { text: formatNumber(row.low) },
      ]);
    })
    .sort((a, b) => {
      const primary = a[0].text.localeCompare(b[0].text);
      if (primary !== 0) {
        return primary;
      }
      if (includeRegion) {
        return a[1].text.localeCompare(b[1].text);
      }
      return 0;
    });
}

export function buildOutstandingViewModel(params: {
  filters: AnalyticsFilters;
  filterOptions: FilterOptions;
  sort: OutstandingSort;
  criticalTasksPage: number;
  allTasks: { service: string; roleCategory: string; region: string; location: string; taskName: string }[];
  summary: {
    open: number;
    assigned: number;
    unassigned: number;
    assignedPct: number;
    unassignedPct: number;
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  charts: {
    openTasks: string;
    waitTime: string;
    tasksDue: string;
    tasksDueByPriority: string;
    priorityDonut: string;
    assignmentDonut: string;
  };
  openByNameInitial: OpenByNameInitial;
  openByCreated: AssignmentSeriesPoint[];
  waitTime: WaitTimePoint[];
  dueByDate: DueByDatePoint[];
  priorityByDueDate: PrioritySeriesPoint[];
  criticalTasks: CriticalTask[];
  outstandingByLocation: OutstandingByLocationRow[];
  outstandingByRegion: OutstandingByRegionRow[];
  regionDescriptions: Record<string, string>;
  locationDescriptions: Record<string, string>;
}): OutstandingViewModel {
  const {
    filters,
    filterOptions,
    sort,
    criticalTasksPage,
    allTasks,
    summary,
    charts,
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
  } = params;

  const filterViewModel = buildFilterOptionsViewModel(filterOptions, allTasks);
  const { pagedTasks, pagination } = paginateCriticalTasks({
    tasks: criticalTasks,
    filters,
    sort: sort.criticalTasks,
    page: criticalTasksPage,
  });
  const openTasksTotals = calculateOpenTasksTotals(openByCreated);
  const waitTimeTotals = calculateWaitTimeTotals(waitTime);
  const dueTotals = calculateDueTotals(dueByDate);
  const priorityTotals = calculatePriorityTotals(priorityByDueDate);
  const outstandingTotals = calculateOutstandingTotals(outstandingByLocation);

  return {
    filters,
    ...filterViewModel,
    criticalTasksSort: sort.criticalTasks,
    criticalTasksHead: buildCriticalTasksHead(sort),
    criticalTasks: buildCriticalTasks(pagedTasks, locationDescriptions),
    criticalTasksPagination: pagination,
    summary,
    charts,
    openByNameInitial,
    openByNameRows: buildOpenByNameRows(openByNameInitial.breakdown),
    openByNameTotalsRow: buildOpenByNameTotalsRow(openByNameInitial.totals),
    openTasksRows: buildOpenTasksRows(openByCreated),
    openTasksTotalsRow: buildOpenTasksTotalsRow(openTasksTotals),
    waitTimeRows: buildWaitTimeRows(waitTime),
    waitTimeTotalsRow: buildWaitTimeTotalsRow(waitTimeTotals),
    tasksDueRows: buildTasksDueRows(dueByDate),
    tasksDueTotalsRow: buildTasksDueTotalsRow(dueTotals),
    tasksDuePriorityRows: buildTasksDuePriorityRows(priorityByDueDate),
    tasksDuePriorityTotalsRow: buildTasksDuePriorityTotalsRow(priorityTotals),
    priorityTableRows: buildPriorityTableRows(summary),
    outstandingByRegionRows: buildOutstandingRegionRows(outstandingByRegion, regionDescriptions),
    outstandingByRegionTotalsRow: buildOutstandingTotalsRow(outstandingTotals, 1),
    outstandingByLocationRows: buildOutstandingLocationRows(
      outstandingByLocation,
      false,
      locationDescriptions,
      regionDescriptions
    ),
    outstandingByLocationTotalsRow: buildOutstandingTotalsRow(outstandingTotals, 1),
    outstandingByRegionLocationRows: buildOutstandingLocationRows(
      outstandingByLocation,
      true,
      locationDescriptions,
      regionDescriptions
    ),
    outstandingByRegionLocationTotalsRow: buildOutstandingTotalsRow(outstandingTotals, 2),
  };
}
