import { truncateLabel } from './utils';

type StackedBarSeries = {
  name: string;
  values: number[];
  color: string;
};

type StackedHorizontalBarParams = {
  categories: string[];
  series: StackedBarSeries[];
  height?: number;
  visibleCount?: number;
  xTitle?: string;
  hoverTemplate?: string;
  layoutOverrides?: Record<string, unknown>;
};

export function buildStackedHorizontalBarChart({
  categories,
  series,
  height = 650,
  visibleCount = 20,
  xTitle = 'Tasks',
  hoverTemplate = '<b>%{customdata}</b><br>%{x} tasks<extra></extra>',
  layoutOverrides = {},
}: StackedHorizontalBarParams): Record<string, unknown> {
  const yTickText = categories.map(name => truncateLabel(name));
  const yRange = categories.length === 0 ? undefined : [visibleCount - 0.5, -0.5];

  return {
    data: series.map(item => ({
      x: item.values,
      y: categories,
      type: 'bar',
      orientation: 'h',
      name: item.name,
      marker: { color: item.color },
      customdata: categories,
      hovertemplate: hoverTemplate,
    })),
    layout: {
      dragmode: 'pan',
      barmode: 'stack',
      margin: { t: 20, l: 260, r: 40, b: 40 },
      xaxis: { title: xTitle, fixedrange: true },
      yaxis: {
        automargin: true,
        categoryorder: 'array',
        categoryarray: categories,
        autorange: false,
        range: yRange,
        tickmode: 'array',
        tickvals: categories,
        ticktext: yTickText,
        fixedrange: false,
      },
      height,
      ...layoutOverrides,
    },
  };
}
