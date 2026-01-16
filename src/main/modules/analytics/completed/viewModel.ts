import { buildFilterOptionsViewModel } from '../shared/filters';
import { buildDateParts, formatNumber, formatPercent } from '../shared/formatting';
import { FilterOptions } from '../shared/services';
import {
  AnalyticsFilters,
  CompletedByLocationRow,
  CompletedByRegionRow,
  CompletedMetric,
  CompletedProcessingHandlingPoint,
  CompletedResponse,
  Task,
} from '../shared/types';
import { buildRollingAverage, lookup } from '../shared/utils';
import { getUserOptions } from '../shared/viewModels/filterOptions';
import { buildTotalRow, buildTotalsRowWithLabelColumns, sumBy } from '../shared/viewModels/totalsRow';

import {
  buildCompletedByNameChart,
  buildComplianceChart,
  buildHandlingChart,
  buildProcessingHandlingTimeChart,
  buildTimelineChart,
} from './visuals/charts';

export type TaskAuditEntry = {
  caseId: string;
  taskName: string;
  agentName: string;
  completedDate: string;
  totalAssignments: number;
  location: string;
  status: string;
};

type CompletedViewModel = ReturnType<typeof buildFilterOptionsViewModel> & {
  filters: AnalyticsFilters;
  completedFrom: { day: string; month: string; year: string };
  completedTo: { day: string; month: string; year: string };
  summary: CompletedResponse['summary'];
  charts: {
    complianceToday: string;
    complianceRange: string;
    timeline: string;
    completedByName: string;
    handling: string;
    processingHandlingTime: string;
  };
  completedByNameRows: { text: string }[][];
  completedByNameTotalsRow: { text: string }[];
  timelineRows: { text: string }[][];
  timelineTotalsRow: { text: string }[];
  complianceTodayRows: { key: { text: string }; value: { text: string } }[];
  complianceRangeRows: { key: { text: string }; value: { text: string } }[];
  handlingRows: { key: { text: string }; value: { text: string } }[];
  processingHandlingRows: { text: string }[][];
  processingHandlingMetric: CompletedMetric;
  processingHandlingOverallLabel: string;
  processingHandlingOverallAverage: string;
  userOptions: { value: string; text: string }[];
  completedByRegionRows: { text: string }[][];
  completedByRegionTotalsRow: { text: string }[];
  completedByLocationRows: { text: string }[][];
  completedByLocationTotalsRow: { text: string }[];
  completedByRegionLocationRows: { text: string }[][];
  completedByRegionLocationTotalsRow: { text: string }[];
  taskAuditRows: TaskAuditEntry[];
  taskAuditCaseId: string;
  taskAuditEmptyState: string;
};

type HandlingStats = CompletedResponse['handlingTimeStats'];

function buildProcessingHandlingRows(
  rows: CompletedProcessingHandlingPoint[],
  metric: CompletedMetric
): { text: string }[][] {
  return rows.map(row => {
    const average = metric === 'handlingTime' ? row.handlingAverageDays : row.processingAverageDays;
    const stddev = metric === 'handlingTime' ? row.handlingStdDevDays : row.processingStdDevDays;
    const upperRange = average + stddev;
    const lowerRange = Math.max(0, average - stddev);
    return [
      { text: row.date },
      { text: formatNumber(row.tasks) },
      { text: formatNumber(average, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
      { text: formatNumber(upperRange, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
      { text: formatNumber(lowerRange, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    ];
  });
}

function buildProcessingHandlingOverallAverage(
  rows: CompletedProcessingHandlingPoint[],
  metric: CompletedMetric
): number {
  const totals = rows.reduce(
    (acc, row) => {
      if (metric === 'handlingTime') {
        acc.sum += row.handlingSumDays;
        acc.count += row.handlingCount;
      } else {
        acc.sum += row.processingSumDays;
        acc.count += row.processingCount;
      }
      return acc;
    },
    { sum: 0, count: 0 }
  );

  if (totals.count === 0) {
    return 0;
  }
  return totals.sum / totals.count;
}

function buildCompletedByNameRows(rows: CompletedResponse['completedByName']): { text: string }[][] {
  return rows.map(row => [
    { text: row.taskName },
    { text: formatNumber(row.tasks) },
    { text: formatNumber(row.withinDue) },
    {
      text: formatPercent((row.withinDue / row.tasks) * 100, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    },
    { text: formatNumber(row.beyondDue) },
  ]);
}

function buildCompletedByNameTotalsRow(rows: CompletedResponse['completedByName']): { text: string }[] {
  const totalTasks = sumBy(rows, row => row.tasks);
  const totalWithin = sumBy(rows, row => row.withinDue);
  const totalBeyond = sumBy(rows, row => row.beyondDue);
  const totalPct = formatPercent((totalWithin / totalTasks) * 100, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return buildTotalRow([totalTasks, totalWithin, totalPct, totalBeyond]);
}

function buildComplianceRows(summary: Pick<CompletedResponse['summary'], 'withinDueYes' | 'withinDueNo'>): {
  key: { text: string };
  value: { text: string };
}[] {
  return [
    { key: { text: 'Within due date' }, value: { text: formatNumber(summary.withinDueYes) } },
    { key: { text: 'Beyond due date' }, value: { text: formatNumber(summary.withinDueNo) } },
  ];
}

function buildTimelineRows(timeline: CompletedResponse['timeline']): { text: string }[][] {
  const rollingAverage = buildRollingAverage(
    timeline.map(point => point.completed),
    7
  );
  return timeline.map((point, index) => [
    { text: point.date },
    { text: formatNumber(point.completed) },
    { text: formatNumber(point.withinDue) },
    {
      text: formatPercent((point.withinDue / point.completed) * 100, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    },
    { text: formatNumber(point.beyondDue) },
    {
      text: formatNumber(rollingAverage[index] ?? 0),
    },
  ]);
}

function buildTimelineTotalsRow(timeline: CompletedResponse['timeline']): { text: string }[] {
  const totalCompleted = sumBy(timeline, row => row.completed);
  const totalWithin = sumBy(timeline, row => row.withinDue);
  const totalBeyond = sumBy(timeline, row => row.beyondDue);
  const totalPct = formatPercent((totalWithin / totalCompleted) * 100, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const rollingAverage = buildRollingAverage(
    timeline.map(point => point.completed),
    7
  );
  const lastRollingAverage = rollingAverage.length === 0 ? 0 : rollingAverage[rollingAverage.length - 1];

  return buildTotalRow([totalCompleted, totalWithin, totalPct, totalBeyond, lastRollingAverage]);
}

function buildHandlingRows(stats: HandlingStats): { key: { text: string }; value: { text: string } }[] {
  return [
    {
      key: { text: 'Average days' },
      value: { text: formatNumber(stats.averageDays, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) },
    },
    {
      key: { text: 'Lower range' },
      value: { text: formatNumber(stats.lowerRange, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) },
    },
    {
      key: { text: 'Upper range' },
      value: { text: formatNumber(stats.upperRange, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) },
    },
  ];
}

function buildCompletedRegionRows(
  rows: CompletedByRegionRow[],
  regionLookup: Record<string, string>
): { text: string }[][] {
  return rows
    .map(row => [
      { text: lookup(row.region ?? 'Unknown', regionLookup) },
      { text: formatNumber(row.tasks) },
      { text: formatNumber(row.withinDue) },
      { text: formatNumber(row.beyondDue) },
      {
        text:
          typeof row.handlingTimeDays === 'number'
            ? formatNumber(row.handlingTimeDays, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
            : '-',
      },
      {
        text:
          typeof row.processingTimeDays === 'number'
            ? formatNumber(row.processingTimeDays, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
            : '-',
      },
    ])
    .sort((a, b) => a[0].text.localeCompare(b[0].text));
}

function buildCompletedLocationRows(
  rows: CompletedByLocationRow[],
  includeRegion: boolean,
  locationLookup: Record<string, string>,
  regionLookup: Record<string, string>
): { text: string }[][] {
  return rows
    .map(row => {
      const regionText = lookup(row.region ?? 'Unknown', regionLookup);
      const locationText = lookup(row.location ?? 'Unknown', locationLookup);
      const cells = includeRegion ? [{ text: regionText }, { text: locationText }] : [{ text: locationText }];
      return cells.concat([
        { text: formatNumber(row.tasks) },
        { text: formatNumber(row.withinDue) },
        { text: formatNumber(row.beyondDue) },
        {
          text:
            typeof row.handlingTimeDays === 'number'
              ? formatNumber(row.handlingTimeDays, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
              : '-',
        },
        {
          text:
            typeof row.processingTimeDays === 'number'
              ? formatNumber(row.processingTimeDays, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
              : '-',
        },
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

function buildCompletedRegionLocationTotals(
  rows: CompletedByLocationRow[] | CompletedByRegionRow[],
  labelColumns: number
): { text: string }[] {
  let tasks = 0;
  let within = 0;
  let beyond = 0;
  rows.forEach(row => {
    tasks += row.tasks;
    within += row.withinDue;
    beyond += row.beyondDue;
  });
  return buildTotalsRowWithLabelColumns('Total', labelColumns, [tasks, within, beyond], 2);
}

export function buildCompletedViewModel(params: {
  filters: AnalyticsFilters;
  completed: CompletedResponse;
  allTasks: Task[];
  filterOptions: FilterOptions;
  completedByLocation: CompletedByLocationRow[];
  completedByRegion: CompletedByRegionRow[];
  regionDescriptions: Record<string, string>;
  locationDescriptions: Record<string, string>;
  taskAuditRows: TaskAuditEntry[];
  taskAuditCaseId: string;
  selectedMetric: CompletedMetric;
}): CompletedViewModel {
  const {
    filters,
    completed,
    allTasks,
    filterOptions,
    completedByLocation,
    completedByRegion,
    regionDescriptions,
    locationDescriptions,
    taskAuditRows,
    taskAuditCaseId,
    selectedMetric,
  } = params;

  const complianceTodayChart = buildComplianceChart({
    withinDueYes: completed.summary.withinDueTodayYes,
    withinDueNo: completed.summary.withinDueTodayNo,
  });
  const complianceRangeChart = buildComplianceChart({
    withinDueYes: completed.summary.withinDueYes,
    withinDueNo: completed.summary.withinDueNo,
  });
  const timelineChart = buildTimelineChart(completed.timeline);
  const completedByNameChart = buildCompletedByNameChart(completed.completedByName);
  const handlingStats = completed.handlingTimeStats;
  const handlingChart = buildHandlingChart(handlingStats);
  const processingHandlingChart = buildProcessingHandlingTimeChart(completed.processingHandlingTime, selectedMetric);
  const filterViewModel = buildFilterOptionsViewModel(filterOptions, allTasks);

  return {
    filters,
    ...filterViewModel,
    completedFrom: buildDateParts(filters.completedFrom),
    completedTo: buildDateParts(filters.completedTo),
    summary: completed.summary,
    charts: {
      complianceToday: complianceTodayChart,
      complianceRange: complianceRangeChart,
      timeline: timelineChart,
      completedByName: completedByNameChart,
      handling: handlingChart,
      processingHandlingTime: processingHandlingChart,
    },
    completedByNameRows: buildCompletedByNameRows(completed.completedByName),
    completedByNameTotalsRow: buildCompletedByNameTotalsRow(completed.completedByName),
    complianceTodayRows: buildComplianceRows({
      withinDueYes: completed.summary.withinDueTodayYes,
      withinDueNo: completed.summary.withinDueTodayNo,
    }),
    complianceRangeRows: buildComplianceRows({
      withinDueYes: completed.summary.withinDueYes,
      withinDueNo: completed.summary.withinDueNo,
    }),
    timelineRows: buildTimelineRows(completed.timeline),
    timelineTotalsRow: buildTimelineTotalsRow(completed.timeline),
    handlingRows: buildHandlingRows(handlingStats),
    processingHandlingRows: buildProcessingHandlingRows(completed.processingHandlingTime, selectedMetric),
    processingHandlingMetric: selectedMetric,
    processingHandlingOverallLabel:
      selectedMetric === 'handlingTime'
        ? 'Overall average of handling time (days)'
        : 'Overall average of processing time (days)',
    processingHandlingOverallAverage: formatNumber(
      buildProcessingHandlingOverallAverage(completed.processingHandlingTime, selectedMetric),
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    ),
    userOptions: getUserOptions(allTasks),
    completedByRegionRows: buildCompletedRegionRows(completedByRegion, regionDescriptions),
    completedByRegionTotalsRow: buildCompletedRegionLocationTotals(completedByRegion, 1),
    completedByLocationRows: buildCompletedLocationRows(
      completedByLocation,
      false,
      locationDescriptions,
      regionDescriptions
    ),
    completedByLocationTotalsRow: buildCompletedRegionLocationTotals(completedByLocation, 1),
    completedByRegionLocationRows: buildCompletedLocationRows(
      completedByLocation,
      true,
      locationDescriptions,
      regionDescriptions
    ),
    completedByRegionLocationTotalsRow: buildCompletedRegionLocationTotals(completedByLocation, 2),
    taskAuditRows,
    taskAuditCaseId,
    taskAuditEmptyState: taskAuditCaseId
      ? 'No completed tasks match this case ID.'
      : 'Enter a case ID to see task audit results.',
  };
}

export const __testing = {
  buildCompletedRegionRows,
  buildCompletedLocationRows,
};
