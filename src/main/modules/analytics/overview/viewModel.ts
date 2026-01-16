import { buildFilterOptionsViewModel } from '../shared/filters';
import { buildDateParts, formatNumber, formatPercent } from '../shared/formatting';
import { FilterOptions } from '../shared/services';
import { AnalyticsFilters, OverviewResponse } from '../shared/types';
import { FilterOptionsViewModel } from '../shared/viewModels/filterOptions';
import { buildTotalsRow } from '../shared/viewModels/totalsRow';

type TaskEventsRow = {
  service: string;
  completed: number;
  cancelled: number;
  created: number;
};

type AnalyticsTask = { service: string; roleCategory: string; region: string; location: string; taskName: string };
type DateParts = { day: string; month: string; year: string };
type TableRow = { text: string }[];
type TableRows = TableRow[];

type OverviewViewModel = FilterOptionsViewModel & {
  filters: AnalyticsFilters;
  rows: OverviewResponse['serviceRows'];
  totals: OverviewResponse['totals'];
  tableRows: TableRows;
  totalsRow: TableRow;
  taskEventsRows: TableRows;
  taskEventsTotalsRow: TableRow;
  eventsFrom: DateParts;
  eventsTo: DateParts;
};

function buildOverviewTableRows(rows: OverviewResponse['serviceRows']): TableRows {
  return rows.map(row => [
    { text: row.service },
    { text: formatNumber(row.open) },
    { text: formatNumber(row.assigned) },
    {
      text: formatPercent(row.assignedPct, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    },
    { text: formatNumber(row.urgent) },
    { text: formatNumber(row.high) },
    { text: formatNumber(row.medium) },
    { text: formatNumber(row.low) },
  ]);
}

function buildOverviewTotalsRow(totals: OverviewResponse['totals']): TableRow {
  return buildTotalsRow(totals.service, [
    totals.open,
    totals.assigned,
    formatPercent(totals.assignedPct, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    totals.urgent,
    totals.high,
    totals.medium,
    totals.low,
  ]);
}

function buildTaskEventsRows(rows: TaskEventsRow[]): TableRows {
  return rows.map(row => [
    { text: row.service },
    { text: formatNumber(row.created) },
    { text: formatNumber(row.completed) },
    { text: formatNumber(row.cancelled) },
  ]);
}

function buildTaskEventsTotalsRow(totals: TaskEventsRow): TableRow {
  return buildTotalsRow(totals.service, [totals.created, totals.completed, totals.cancelled]);
}

export function buildOverviewViewModel(params: {
  filters: AnalyticsFilters;
  overview: OverviewResponse;
  filterOptions: FilterOptions;
  allTasks: AnalyticsTask[];
  taskEventsRows: TaskEventsRow[];
  taskEventsTotals: TaskEventsRow;
  eventsRange: { from: Date; to: Date };
}): OverviewViewModel {
  const { filters, overview, filterOptions, allTasks, taskEventsRows, taskEventsTotals, eventsRange } = params;
  const filterViewModel = buildFilterOptionsViewModel(filterOptions, allTasks);
  const sortedRows = [...overview.serviceRows].sort((a, b) => a.service.localeCompare(b.service));

  return {
    filters,
    ...filterViewModel,
    rows: sortedRows,
    totals: overview.totals,
    tableRows: buildOverviewTableRows(sortedRows),
    totalsRow: buildOverviewTotalsRow(overview.totals),
    taskEventsRows: buildTaskEventsRows(taskEventsRows),
    taskEventsTotalsRow: buildTaskEventsTotalsRow(taskEventsTotals),
    eventsFrom: buildDateParts(eventsRange.from),
    eventsTo: buildDateParts(eventsRange.to),
  };
}
