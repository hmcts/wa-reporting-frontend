import { chartColors } from '../../shared/charts/colors';
import { buildDonutChart } from '../../shared/charts/donut';
import { buildChartConfig } from '../../shared/charts/plotly';
import { buildStackedHorizontalBarChart } from '../../shared/charts/stackedHorizontalBar';
import { buildLineTimeSeries, buildStackedBarWithLineTimeSeries } from '../../shared/charts/timeSeries';
import { sortByTotalThenName } from '../../shared/sorting';
import {
  CompletedByName,
  CompletedMetric,
  CompletedPoint,
  CompletedProcessingHandlingPoint,
  CompletedResponse,
  HandlingTimeStats,
} from '../../shared/types';
import { buildRollingAverage } from '../../shared/utils';

export function buildComplianceChart(
  summary: Pick<CompletedResponse['summary'], 'withinDueYes' | 'withinDueNo'>
): string {
  return buildDonutChart({
    values: [summary.withinDueYes, summary.withinDueNo],
    labels: ['Within due date', 'Beyond due date'],
    colors: [chartColors.blue, chartColors.grey],
  });
}

export function buildTimelineChart(timeline: CompletedPoint[]): string {
  const timelineRollingAverage = buildRollingAverage(
    timeline.map(point => point.completed),
    7
  );

  const dates = timeline.map(point => point.date);
  return buildStackedBarWithLineTimeSeries(
    dates,
    [
      { name: 'Within due', values: timeline.map(point => point.withinDue), color: chartColors.blue },
      { name: 'Beyond due', values: timeline.map(point => point.beyondDue), color: chartColors.grey },
    ],
    {
      name: 'Total - 7-day average',
      values: timelineRollingAverage,
      color: chartColors.signalRed,
      mode: 'lines',
      width: 3,
    },
    {
      axisTitles: { x: 'Completed date', y: 'Tasks' },
      layoutOverrides: {
        dragmode: 'pan',
        xaxis: { fixedrange: false },
      },
    }
  );
}

export function buildCompletedByNameChart(rows: CompletedByName[]): string {
  const sorted = sortByTotalThenName(
    rows,
    row => row.tasks,
    row => row.taskName
  );
  const categories = sorted.map(row => row.taskName);
  const config = buildStackedHorizontalBarChart({
    categories,
    series: [
      { name: 'Within due date', values: sorted.map(row => row.withinDue), color: chartColors.blue },
      { name: 'Outside due date', values: sorted.map(row => row.beyondDue), color: chartColors.grey },
    ],
    layoutOverrides: { legend: { orientation: 'h' } },
  });

  return buildChartConfig(config);
}

export function buildHandlingChart(stats: HandlingTimeStats): string {
  return buildChartConfig({
    data: [
      {
        x: ['Average'],
        y: [stats.averageDays],
        type: 'bar',
        marker: { color: chartColors.blueDark },
        error_y: {
          type: 'data',
          symmetric: false,
          array: [Math.max(0, stats.upperRange - stats.averageDays)],
          arrayminus: [Math.max(0, stats.averageDays - stats.lowerRange)],
        },
      },
    ],
    layout: { margin: { t: 20 }, yaxis: { title: { text: 'Days' } } },
  });
}

export function buildProcessingHandlingTimeChart(
  points: CompletedProcessingHandlingPoint[],
  metric: CompletedMetric
): string {
  const dates = points.map(point => point.date);
  const averages = points.map(point =>
    metric === 'handlingTime' ? point.handlingAverageDays : point.processingAverageDays
  );
  const stddevs = points.map(point =>
    metric === 'handlingTime' ? point.handlingStdDevDays : point.processingStdDevDays
  );
  const upper = averages.map((value, index) => value + stddevs[index]);
  const lower = averages.map((value, index) => Math.max(0, value - stddevs[index]));

  return buildLineTimeSeries(
    dates,
    [
      { name: 'Average (days)', values: averages, color: chartColors.blueDark, width: 3 },
      { name: 'Upper range (+1 std)', values: upper, color: chartColors.blue, width: 2 },
      { name: 'Lower range (-1 std)', values: lower, color: chartColors.grey, width: 2 },
    ],
    {
      axisTitles: { x: 'Completed date', y: 'Days' },
      layoutOverrides: {
        xaxis: { automargin: true },
        margin: { t: 20, b: 60 },
        yaxis: { automargin: true, fixedrange: true, rangemode: 'tozero' },
      },
    }
  );
}
