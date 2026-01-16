import * as charts from '../../../../../main/modules/analytics/shared/charts';

describe('charts index', () => {
  test('re-exports chart helpers', () => {
    expect(charts.buildChartConfig).toBeDefined();
    expect(charts.buildDonutChart).toBeDefined();
    expect(charts.buildStackedHorizontalBarChart).toBeDefined();
    expect(charts.chartColors).toBeDefined();
  });
});
