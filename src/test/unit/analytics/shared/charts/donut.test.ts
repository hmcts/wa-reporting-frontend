import { buildDonutChart } from '../../../../../main/modules/analytics/shared/charts/donut';
import { buildChartConfig } from '../../../../../main/modules/analytics/shared/charts/plotly';

jest.mock('../../../../../main/modules/analytics/shared/charts/plotly', () => ({
  buildChartConfig: jest.fn(),
}));

describe('buildDonutChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses defaults and merges overrides', () => {
    (buildChartConfig as jest.Mock).mockReturnValue('chart');

    const result = buildDonutChart({
      values: [1, 2],
      labels: ['A', 'B'],
      colors: ['#111', '#222'],
      layoutOverrides: { height: 300 },
    });

    expect(result).toBe('chart');
    expect(buildChartConfig).toHaveBeenCalledWith({
      data: [
        {
          values: [1, 2],
          labels: ['A', 'B'],
          type: 'pie',
          sort: false,
          hole: 0.4,
          textposition: 'inside',
          textinfo: 'percent',
          insidetextorientation: 'horizontal',
          marker: { colors: ['#111', '#222'] },
        },
      ],
      layout: {
        margin: { t: 0, b: 0, l: 0, r: 0 },
        height: 300,
        showlegend: true,
        legend: { traceorder: 'normal' },
      },
    });
  });

  test('supports explicit chart overrides', () => {
    (buildChartConfig as jest.Mock).mockReturnValue('chart');

    buildDonutChart({
      values: [1],
      labels: ['A'],
      colors: ['#111'],
      hole: 0.6,
      textinfo: 'label',
      textposition: 'outside',
      insidetextorientation: 'radial',
    });

    const chartArgs = (buildChartConfig as jest.Mock).mock.calls[0][0] as {
      data: { hole: number; textinfo: string; textposition: string; insidetextorientation: string }[];
    };

    expect(chartArgs.data[0]).toMatchObject({
      hole: 0.6,
      textinfo: 'label',
      textposition: 'outside',
      insidetextorientation: 'radial',
    });
  });
});
