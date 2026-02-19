import { buildChartConfig } from './plotly';

type DonutChartParams = {
  values: number[];
  labels: string[];
  colors: string[];
  layoutOverrides?: Record<string, unknown>;
  hole?: number;
  textinfo?: string;
  textposition?: string;
  insidetextorientation?: string;
};

export function buildDonutChart({
  values,
  labels,
  colors,
  layoutOverrides = {},
  hole = 0.4,
  textinfo = 'percent',
  textposition = 'inside',
  insidetextorientation = 'horizontal',
}: DonutChartParams): string {
  return buildChartConfig({
    data: [
      {
        values,
        labels,
        type: 'pie',
        sort: false,
        hole,
        textposition,
        textinfo,
        insidetextorientation,
        marker: { colors },
      },
    ],
    layout: {
      margin: { t: 0, b: 0, l: 0, r: 0 },
      height: 240,
      showlegend: true,
      legend: { traceorder: 'normal' },
      ...layoutOverrides,
    },
  });
}
