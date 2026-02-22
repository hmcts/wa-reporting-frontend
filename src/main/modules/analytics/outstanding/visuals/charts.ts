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
  TaskPriority,
  WaitTimePoint,
} from '../../shared/types';

export function buildOpenByNameChartConfig(openByName: PriorityBreakdown[]): Record<string, unknown> {
  const sorted = sortPriorityBreakdowns(openByName);
  const categories = sorted.map(row => row.name);
  return buildStackedHorizontalBarChart({
    categories,
    series: [
      { name: TaskPriority.Urgent, values: sorted.map(row => row.urgent), color: chartColors.purple },
      { name: TaskPriority.High, values: sorted.map(row => row.high), color: chartColors.blueDark },
      { name: TaskPriority.Medium, values: sorted.map(row => row.medium), color: chartColors.blueLight },
      { name: TaskPriority.Low, values: sorted.map(row => row.low), color: chartColors.greyLight },
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
        color: chartColors.blueDark,
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
      { name: 'Open', values: dueByDate.map(point => point.open), color: chartColors.blue },
      { name: 'Completed', values: dueByDate.map(point => point.completed), color: chartColors.grey },
    ],
    { legendOrientation: 'h' }
  );
}

export function buildTasksDuePriorityChart(priorityByDueDate: PrioritySeriesPoint[]): string {
  const dates = priorityByDueDate.map(point => point.date);
  return buildStackedBarTimeSeries(
    dates,
    [
      { name: TaskPriority.Urgent, values: priorityByDueDate.map(point => point.urgent), color: chartColors.purple },
      { name: TaskPriority.High, values: priorityByDueDate.map(point => point.high), color: chartColors.blueDark },
      { name: TaskPriority.Medium, values: priorityByDueDate.map(point => point.medium), color: chartColors.blueLight },
      { name: TaskPriority.Low, values: priorityByDueDate.map(point => point.low), color: chartColors.greyLight },
    ],
    { legendOrientation: 'h' }
  );
}

export function buildPriorityDonutChart(summary: PrioritySummary): string {
  return buildDonutChart({
    values: [summary.urgent, summary.high, summary.medium, summary.low],
    labels: [TaskPriority.Urgent, TaskPriority.High, TaskPriority.Medium, TaskPriority.Low],
    colors: [chartColors.purple, chartColors.blueDark, chartColors.blueLight, chartColors.greyLight],
  });
}

export function buildAssignmentDonutChart(summary: { assigned: number; unassigned: number }): string {
  return buildDonutChart({
    values: [summary.assigned, summary.unassigned],
    labels: ['Assigned', 'Unassigned'],
    colors: [assignmentColors.assigned, assignmentColors.unassigned],
  });
}
