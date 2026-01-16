import { chartColors } from '../../shared/charts/colors';
import { buildDonutChart } from '../../shared/charts/donut';
import { buildStackedBarWithLineTimeSeries } from '../../shared/charts/timeSeries';
import { UserOverviewResponse } from '../../shared/types';
import { CompletedByDatePoint } from '../service';

export function buildUserPriorityChart(summary: UserOverviewResponse['prioritySummary']): string {
  return buildDonutChart({
    values: [summary.urgent, summary.high, summary.medium, summary.low],
    labels: ['Urgent', 'High', 'Medium', 'Low'],
    colors: [chartColors.urgent, chartColors.high, chartColors.medium, chartColors.low],
  });
}

export function buildUserCompletedByDateChart(points: CompletedByDatePoint[]): string {
  const dates = points.map(point => point.date);
  return buildStackedBarWithLineTimeSeries(
    dates,
    [
      { name: 'Within due date', values: points.map(point => point.withinDue), color: chartColors.green },
      { name: 'Outside due date', values: points.map(point => point.beyondDue), color: chartColors.urgent },
    ],
    {
      name: 'Average handling time (days)',
      values: points.map(point =>
        point.handlingTimeCount === 0 ? 0 : point.handlingTimeSum / point.handlingTimeCount
      ),
      color: chartColors.high,
      mode: 'lines',
      width: 2,
      axis: 'y2',
    },
    {
      layoutOverrides: {
        yaxis: { title: 'Tasks', automargin: true, fixedrange: true, rangemode: 'tozero' },
        yaxis2: {
          title: 'Average handling time (days)',
          automargin: true,
          fixedrange: true,
          overlaying: 'y',
          side: 'right',
          rangemode: 'tozero',
        },
      },
    }
  );
}

export function buildUserCompletedComplianceChart(
  summary: Pick<UserOverviewResponse['completedSummary'], 'withinDueYes' | 'withinDueNo'>
): string {
  return buildDonutChart({
    values: [summary.withinDueYes, summary.withinDueNo],
    labels: ['Within due date', 'Beyond due date'],
    colors: [chartColors.green, chartColors.urgent],
  });
}
