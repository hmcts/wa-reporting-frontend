import type { PlotlyAutoFitAxisRule } from '../../../../assets/js/analytics/types';
import { buildChartConfig } from './plotly';
import { buildPositiveAxisScale } from './positiveAxisScale';

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

type AxisTitles = {
  x?: string;
  y?: string;
};

type TimeSeriesLayoutOverrides = {
  layoutOverrides?: Record<string, unknown>;
  legendOrientation?: 'h' | 'v';
  axisTitles?: AxisTitles;
};

const defaultAutoFitAxisOptions = {
  paddingRatio: 0,
  minUpperBound: 1,
} satisfies Pick<PlotlyAutoFitAxisRule, 'paddingRatio' | 'minUpperBound'>;

const defaultDateXAxis = {
  type: 'date',
  tickformat: '%-d %b %Y',
  hoverformat: '%-d %b %Y',
  automargin: true,
};

const defaultTimeSeriesMargin = { t: 40 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function withNormalisedAxisTitle(axis: Record<string, unknown>): Record<string, unknown> {
  const title = axis.title;
  if (typeof title === 'string') {
    return { ...axis, title: { text: title } };
  }
  return axis;
}

function buildTimeSeriesAxes(
  layoutOverrides: Record<string, unknown>,
  axisTitles: AxisTitles | undefined,
  defaultYaxis: Record<string, unknown>
): {
  restLayout: Record<string, unknown>;
  xaxis: Record<string, unknown>;
  yaxis: Record<string, unknown>;
} {
  const { xaxis: rawXaxisOverrides, yaxis: rawYaxisOverrides, ...restLayout } = layoutOverrides;
  const xaxisOverrides = withNormalisedAxisTitle(isRecord(rawXaxisOverrides) ? rawXaxisOverrides : {});
  const yaxisOverrides = withNormalisedAxisTitle(rawYaxisOverrides as Record<string, unknown>);

  return {
    restLayout,
    xaxis: {
      ...defaultDateXAxis,
      ...(axisTitles?.x ? { title: { text: axisTitles.x } } : {}),
      ...xaxisOverrides,
    },
    yaxis: {
      ...defaultYaxis,
      ...(axisTitles?.y ? { title: { text: axisTitles.y } } : {}),
      ...yaxisOverrides,
    },
  };
}

function buildAutoFitAxisRule(
  axis: PlotlyAutoFitAxisRule['axis'],
  strategy: PlotlyAutoFitAxisRule['strategy']
): PlotlyAutoFitAxisRule {
  return {
    axis,
    strategy,
    ...defaultAutoFitAxisOptions,
  };
}

function getSeriesMaximum(series: { values: number[] }[]): number {
  let maximum = 0;
  series.forEach(item => {
    item.values.forEach(value => {
      if (Number.isFinite(value)) {
        maximum = Math.max(maximum, value);
      }
    });
  });
  return maximum;
}

function getStackedSeriesMaximum(series: BarSeries[]): number {
  const pointCount = series.reduce((maximum, item) => Math.max(maximum, item.values.length), 0);
  let maximum = 0;

  for (let index = 0; index < pointCount; index += 1) {
    const total = series.reduce((sum, item) => {
      const value = item.values[index];
      return sum + (Number.isFinite(value) ? Math.max(0, value) : 0);
    }, 0);
    maximum = Math.max(maximum, total);
  }

  return maximum;
}

function withPositiveAxisScale(
  layoutOverrides: Record<string, unknown>,
  axis: 'yaxis' | 'yaxis2',
  maximum: number
): Record<string, unknown> {
  const axisOverrides = isRecord(layoutOverrides[axis]) ? layoutOverrides[axis] : {};
  return {
    ...layoutOverrides,
    [axis]: {
      ...buildPositiveAxisScale(maximum, defaultAutoFitAxisOptions),
      ...axisOverrides,
    },
  };
}

export function buildStackedBarTimeSeries(
  dates: string[],
  series: BarSeries[],
  { layoutOverrides = {}, legendOrientation = 'h', axisTitles }: TimeSeriesLayoutOverrides = {}
): string {
  const scaledLayoutOverrides = withPositiveAxisScale(layoutOverrides, 'yaxis', getStackedSeriesMaximum(series));
  const { restLayout, xaxis, yaxis } = buildTimeSeriesAxes(scaledLayoutOverrides, axisTitles, {
    automargin: true,
    fixedrange: true,
    rangemode: 'tozero',
  });

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
      margin: defaultTimeSeriesMargin,
      legend: { orientation: legendOrientation, traceorder: 'normal' },
      ...restLayout,
      xaxis,
      yaxis,
    },
    behaviors: {
      autoFitYAxesOnXZoom: [buildAutoFitAxisRule('y', 'stacked-bar-sum')],
    },
  });
}

export function buildStackedBarWithLineTimeSeries(
  dates: string[],
  bars: BarSeries[],
  line: LineSeries,
  { layoutOverrides = {}, legendOrientation = 'h', axisTitles }: TimeSeriesLayoutOverrides = {}
): string {
  const barMaximum = getStackedSeriesMaximum(bars);
  const lineMaximum = getSeriesMaximum([line]);
  const primaryAxisMaximum = line.axis === 'y2' ? barMaximum : Math.max(barMaximum, lineMaximum);
  let scaledLayoutOverrides = withPositiveAxisScale(layoutOverrides, 'yaxis', primaryAxisMaximum);
  if (line.axis === 'y2') {
    scaledLayoutOverrides = withPositiveAxisScale(scaledLayoutOverrides, 'yaxis2', lineMaximum);
  }
  const { restLayout, xaxis, yaxis } = buildTimeSeriesAxes(scaledLayoutOverrides, axisTitles, {
    automargin: true,
    fixedrange: true,
    rangemode: 'tozero',
  });
  const autoFitAxisRules =
    line.axis === 'y2'
      ? [buildAutoFitAxisRule('y', 'stacked-bar-sum'), buildAutoFitAxisRule('y2', 'line-extents')]
      : [buildAutoFitAxisRule('y', 'stacked-bar-and-line-max')];

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
      margin: defaultTimeSeriesMargin,
      legend: { orientation: legendOrientation, traceorder: 'normal' },
      ...restLayout,
      xaxis,
      yaxis,
    },
    behaviors: {
      autoFitYAxesOnXZoom: autoFitAxisRules,
    },
  });
}

export function buildLineTimeSeries(
  dates: string[],
  series: LineSeries[],
  { layoutOverrides = {}, axisTitles }: Pick<TimeSeriesLayoutOverrides, 'layoutOverrides' | 'axisTitles'> = {}
): string {
  const scaledLayoutOverrides = withPositiveAxisScale(layoutOverrides, 'yaxis', getSeriesMaximum(series));
  const { restLayout, xaxis, yaxis } = buildTimeSeriesAxes(scaledLayoutOverrides, axisTitles, {});

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
      margin: defaultTimeSeriesMargin,
      ...restLayout,
      xaxis,
      yaxis,
    },
    behaviors: {
      autoFitYAxesOnXZoom: [buildAutoFitAxisRule('y', 'line-extents')],
    },
  });
}
