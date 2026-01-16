import { buildChartConfig } from '../../../../../main/modules/analytics/shared/charts/plotly';

describe('buildChartConfig', () => {
  test('stringifies plotly config objects', () => {
    const config = buildChartConfig({ data: [{ x: [1, 2], y: [3, 4] }], layout: { title: 'Chart' } });

    expect(config).toBe('{"data":[{"x":[1,2],"y":[3,4]}],"layout":{"title":"Chart"}}');
  });
});
