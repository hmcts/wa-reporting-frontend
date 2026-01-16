import { buildStackedHorizontalBarChart } from '../../../../../main/modules/analytics/shared/charts/stackedHorizontalBar';

describe('buildStackedHorizontalBarChart', () => {
  test('builds chart layout with truncated labels', () => {
    const longLabel = 'A'.repeat(60);
    const chart = buildStackedHorizontalBarChart({
      categories: [longLabel, 'Short'],
      series: [{ name: 'Urgent', values: [1, 2], color: '#111' }],
    }) as {
      layout: { yaxis: { ticktext: string[]; range?: number[] } };
      data: { x: number[]; y: string[] }[];
    };

    expect(chart.data[0].y).toEqual([longLabel, 'Short']);
    expect(chart.layout.yaxis.ticktext[0]).toBe(`${'A'.repeat(47)}...`);
    expect(chart.layout.yaxis.range).toEqual([19.5, -0.5]);
  });

  test('omits range when no categories are present', () => {
    const chart = buildStackedHorizontalBarChart({
      categories: [],
      series: [],
    }) as { layout: { yaxis: { range?: number[] } } };

    expect(chart.layout.yaxis.range).toBeUndefined();
  });
});
