import { buildChartConfig } from './plotly';

type BarSeries = {
  name: string;
  values: number[];
  color: string;
};

type LineSeries = {
  name?: string;
  values: number[];
  color: string;
  mode?: 'lines' | 'lines+markers';
  width?: number;
  axis?: 'y' | 'y2';
};

type TimeSeriesLayoutOverrides = {
  layoutOverrides?: Record<string, unknown>;
  legendOrientation?: 'h' | 'v';
};

export function buildStackedBarTimeSeries(
  dates: string[],
  series: BarSeries[],
  { layoutOverrides = {}, legendOrientation = 'h' }: TimeSeriesLayoutOverrides = {}
): string {
  return buildChartConfig({
    data: series.map(item => ({
      x: dates,
      y: item.values,
      type: 'bar',
      name: item.name,
      marker: { color: item.color },
    })),
    layout: {
      barmode: 'stack',
      margin: { t: 20 },
      legend: { orientation: legendOrientation },
      yaxis: { automargin: true, fixedrange: true, rangemode: 'tozero' },
      ...layoutOverrides,
    },
  });
}

export function buildStackedBarWithLineTimeSeries(
  dates: string[],
  bars: BarSeries[],
  line: LineSeries,
  { layoutOverrides = {}, legendOrientation = 'h' }: TimeSeriesLayoutOverrides = {}
): string {
  return buildChartConfig({
    data: [
      ...bars.map(item => ({
        x: dates,
        y: item.values,
        type: 'bar',
        name: item.name,
        marker: { color: item.color },
      })),
      {
        x: dates,
        y: line.values,
        type: 'scatter',
        mode: line.mode ?? 'lines',
        name: line.name,
        line: { color: line.color, width: line.width },
        yaxis: line.axis,
      },
    ],
    layout: {
      barmode: 'stack',
      margin: { t: 20 },
      legend: { orientation: legendOrientation },
      yaxis: { automargin: true, fixedrange: true, rangemode: 'tozero' },
      ...layoutOverrides,
    },
  });
}

export function buildLineTimeSeries(
  dates: string[],
  series: LineSeries[],
  { layoutOverrides = {} }: Pick<TimeSeriesLayoutOverrides, 'layoutOverrides'> = {}
): string {
  return buildChartConfig({
    data: series.map(item => ({
      x: dates,
      y: item.values,
      type: 'scatter',
      mode: item.mode ?? 'lines+markers',
      name: item.name,
      line: { color: item.color, width: item.width },
    })),
    layout: {
      margin: { t: 20 },
      ...layoutOverrides,
    },
  });
}
