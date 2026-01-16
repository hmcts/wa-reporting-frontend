import { assignmentColors, chartColors } from '../../shared/charts/colors';
import { buildDonutChart } from '../../shared/charts/donut';
import { buildStackedHorizontalBarChart } from '../../shared/charts/stackedHorizontalBar';
import { buildLineTimeSeries, buildStackedBarTimeSeries } from '../../shared/charts/timeSeries';
import { sortPriorityBreakdowns } from '../../shared/sorting';
import {
  AssignmentSeriesPoint,
  DueByDatePoint,
  PriorityBreakdown,
  PrioritySeriesPoint,
  PrioritySummary,
  WaitTimePoint,
} from '../../shared/types';

export function buildOpenByNameChartConfig(openByName: PriorityBreakdown[]): Record<string, unknown> {
  const sorted = sortPriorityBreakdowns(openByName);
  const categories = sorted.map(row => row.name);
  return buildStackedHorizontalBarChart({
    categories,
    series: [
      { name: 'Urgent', values: sorted.map(row => row.urgent), color: chartColors.urgent },
      { name: 'High', values: sorted.map(row => row.high), color: chartColors.high },
      { name: 'Medium', values: sorted.map(row => row.medium), color: chartColors.medium },
      { name: 'Low', values: sorted.map(row => row.low), color: chartColors.low },
    ],
  });
}

export function buildOpenTasksChart(openByCreated: AssignmentSeriesPoint[]): string {
  const dates = openByCreated.map(point => point.date);
  return buildStackedBarTimeSeries(dates, [
    { name: 'Assigned', values: openByCreated.map(point => point.assigned), color: assignmentColors.assigned },
    { name: 'Unassigned', values: openByCreated.map(point => point.unassigned), color: assignmentColors.unassigned },
  ]);
}

export function buildWaitTimeChart(waitTime: WaitTimePoint[]): string {
  const dates = waitTime.map(point => point.date);
  return buildLineTimeSeries(
    dates,
    [
      {
        name: 'Average wait (days)',
        values: waitTime.map(point => point.averageWaitDays),
        color: chartColors.high,
        mode: 'lines+markers',
      },
    ],
    { layoutOverrides: { yaxis: { automargin: true, fixedrange: true } } }
  );
}

export function buildTasksDueChart(dueByDate: DueByDatePoint[]): string {
  const dates = dueByDate.map(point => point.date);
  return buildStackedBarTimeSeries(
    dates,
    [
      { name: 'Open', values: dueByDate.map(point => point.open), color: chartColors.low },
      { name: 'Completed', values: dueByDate.map(point => point.completed), color: chartColors.notProvided },
    ],
    { legendOrientation: 'h' }
  );
}

export function buildTasksDuePriorityChart(priorityByDueDate: PrioritySeriesPoint[]): string {
  const dates = priorityByDueDate.map(point => point.date);
  return buildStackedBarTimeSeries(
    dates,
    [
      { name: 'Urgent', values: priorityByDueDate.map(point => point.urgent), color: chartColors.urgent },
      { name: 'High', values: priorityByDueDate.map(point => point.high), color: chartColors.high },
      { name: 'Medium', values: priorityByDueDate.map(point => point.medium), color: chartColors.medium },
      { name: 'Low', values: priorityByDueDate.map(point => point.low), color: chartColors.low },
    ],
    { legendOrientation: 'h' }
  );
}

export function buildPriorityDonutChart(summary: PrioritySummary): string {
  return buildDonutChart({
    values: [summary.urgent, summary.high, summary.medium, summary.low],
    labels: ['Urgent', 'High', 'Medium', 'Low'],
    colors: [chartColors.urgent, chartColors.high, chartColors.medium, chartColors.low],
  });
}

export function buildAssignmentDonutChart(summary: { assigned: number; unassigned: number }): string {
  return buildDonutChart({
    values: [summary.assigned, summary.unassigned],
    labels: ['Assigned', 'Unassigned'],
    colors: [assignmentColors.assigned, assignmentColors.unassigned],
  });
}
