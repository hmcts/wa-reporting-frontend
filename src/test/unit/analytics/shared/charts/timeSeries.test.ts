import {
  buildLineTimeSeries,
  buildStackedBarTimeSeries,
  buildStackedBarWithLineTimeSeries,
} from '../../../../../main/modules/analytics/shared/charts/timeSeries';

describe('time series chart builders', () => {
  test('builds stacked bar charts with layout overrides', () => {
    const chart = buildStackedBarTimeSeries(['2024-01-01'], [{ name: 'Open', values: [3], color: '#0b0c0c' }], {
      layoutOverrides: { yaxis: { range: [0, 10] } },
      legendOrientation: 'v',
    });
    const parsed = JSON.parse(chart);

    expect(parsed.data[0].type).toBe('bar');
    expect(parsed.data[0]).toMatchObject({
      x: ['2024-01-01'],
      y: [3],
      name: 'Open',
      marker: { color: '#0b0c0c' },
    });
    expect(parsed.layout.barmode).toBe('stack');
    expect(parsed.layout.margin).toEqual({ t: 40 });
    expect(parsed.layout.legend.orientation).toBe('v');
    expect(parsed.layout.legend.traceorder).toBe('normal');
    expect(parsed.layout.yaxis.range).toEqual([0, 10]);
    expect(parsed.layout.yaxis.dtick).toBe(0.5);
    expect(parsed.layout.yaxis).toMatchObject({ automargin: true, fixedrange: true, rangemode: 'tozero' });
    expect(parsed.behaviors.autoFitYAxesOnXZoom).toEqual([
      { axis: 'y', strategy: 'stacked-bar-sum', paddingRatio: 0, minUpperBound: 1 },
    ]);
  });

  test('applies shared axis titles to stacked bar charts', () => {
    const chart = buildStackedBarTimeSeries(['2024-01-01'], [{ name: 'Open', values: [3], color: '#0b0c0c' }], {
      axisTitles: { x: 'Due date', y: 'Tasks' },
    });
    const parsed = JSON.parse(chart);

    expect(parsed.layout.xaxis.title.text).toBe('Due date');
    expect(parsed.layout.xaxis).toMatchObject({
      type: 'date',
      tickformat: '%-d %b %Y',
      hoverformat: '%-d %b %Y',
      automargin: true,
    });
    expect(parsed.layout.yaxis.title.text).toBe('Tasks');
    expect(parsed.layout.yaxis.range).toEqual([0, 3.5]);
    expect(parsed.layout.yaxis.dtick).toBe(0.5);
  });

  test('builds stacked bar with line series', () => {
    const chart = buildStackedBarWithLineTimeSeries(
      ['2024-01-01', '2024-01-02'],
      [{ name: 'Open', values: [2, 3], color: '#0b0c0c' }],
      { name: 'Average', values: [1, 10], color: '#1d70b8', mode: 'lines', width: 2, axis: 'y2' }
    );
    const parsed = JSON.parse(chart);

    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[1].type).toBe('scatter');
    expect(parsed.data[1].mode).toBe('lines');
    expect(parsed.data[1].yaxis).toBe('y2');
    expect(parsed.layout.yaxis.range).toEqual([0, 3.5]);
    expect(parsed.layout.yaxis.dtick).toBe(0.5);
    expect(parsed.layout.yaxis2.range).toEqual([0, 12]);
    expect(parsed.layout.yaxis2.dtick).toBe(2);
    expect(parsed.data[0]).toMatchObject({
      x: ['2024-01-01', '2024-01-02'],
      y: [2, 3],
      type: 'bar',
      name: 'Open',
      marker: { color: '#0b0c0c' },
    });
    expect(parsed.data[1]).toMatchObject({
      x: ['2024-01-01', '2024-01-02'],
      y: [1, 10],
      name: 'Average',
      line: { color: '#1d70b8', width: 2 },
    });
    expect(parsed.layout).toMatchObject({
      barmode: 'stack',
      margin: { t: 40 },
      legend: { orientation: 'h', traceorder: 'normal' },
    });
    expect(parsed.layout.yaxis).toMatchObject({ automargin: true, fixedrange: true, rangemode: 'tozero' });
    expect(parsed.behaviors.autoFitYAxesOnXZoom).toEqual([
      { axis: 'y', strategy: 'stacked-bar-sum', paddingRatio: 0, minUpperBound: 1 },
      { axis: 'y2', strategy: 'line-extents', paddingRatio: 0, minUpperBound: 1 },
    ]);
  });

  test('uses default line mode when none is supplied', () => {
    const chart = buildStackedBarWithLineTimeSeries(['2024-01-01'], [{ name: 'Open', values: [2], color: '#0b0c0c' }], {
      values: [7],
      color: '#1d70b8',
    });
    const parsed = JSON.parse(chart);

    expect(parsed.data[1].mode).toBe('lines');
    expect(parsed.layout.yaxis.range).toEqual([0, 8]);
    expect(parsed.layout.yaxis2).toBeUndefined();
    expect(parsed.layout.margin).toEqual({ t: 40 });
    expect(parsed.behaviors.autoFitYAxesOnXZoom).toEqual([
      { axis: 'y', strategy: 'stacked-bar-and-line-max', paddingRatio: 0, minUpperBound: 1 },
    ]);
  });

  test('builds line series with default markers', () => {
    const chart = buildLineTimeSeries(['2024-01-01'], [{ name: 'Completed', values: [5], color: '#00703c' }], {
      layoutOverrides: { margin: { t: 10 } },
    });
    const parsed = JSON.parse(chart);

    expect(parsed.data[0].type).toBe('scatter');
    expect(parsed.data[0].mode).toBe('lines+markers');
    expect(parsed.data[0].line).toEqual({ color: '#00703c' });
    expect(parsed.layout.margin.t).toBe(10);
    expect(parsed.layout.yaxis.range).toEqual([0, 6]);
    expect(parsed.layout.yaxis.dtick).toBe(1);
    expect(parsed.behaviors.autoFitYAxesOnXZoom).toEqual([
      { axis: 'y', strategy: 'line-extents', paddingRatio: 0, minUpperBound: 1 },
    ]);
  });

  test('builds line series with explicit line mode', () => {
    const chart = buildLineTimeSeries(
      ['2024-01-01'],
      [{ name: 'Assigned', values: [2], color: '#1d70b8', mode: 'lines' }]
    );
    const parsed = JSON.parse(chart);

    expect(parsed.data[0].mode).toBe('lines');
  });

  test('applies shared axis titles to line charts while preserving overrides', () => {
    const chart = buildLineTimeSeries(['2024-01-01'], [{ name: 'Average', values: [2], color: '#1d70b8' }], {
      axisTitles: { x: 'Assigned date', y: 'Days' },
      layoutOverrides: { yaxis: { fixedrange: true } },
    });
    const parsed = JSON.parse(chart);

    expect(parsed.layout.xaxis.title.text).toBe('Assigned date');
    expect(parsed.layout.yaxis.title.text).toBe('Days');
    expect(parsed.layout.yaxis.fixedrange).toBe(true);
  });

  test('uses a minimum labelled scale when series values are not finite', () => {
    const stacked = JSON.parse(
      buildStackedBarTimeSeries(['2024-01-01'], [{ name: 'Open', values: [Number.NaN], color: '#0b0c0c' }])
    );
    const line = JSON.parse(
      buildLineTimeSeries(['2024-01-01'], [{ name: 'Average', values: [Number.POSITIVE_INFINITY], color: '#1d70b8' }])
    );

    expect(stacked.layout.yaxis).toMatchObject({ range: [0, 1], dtick: 0.2 });
    expect(line.layout.yaxis).toMatchObject({ range: [0, 1], dtick: 0.2 });
  });

  test('uses the immediate labelled interval above decimal maxima on both axes', () => {
    const parsed = JSON.parse(
      buildStackedBarWithLineTimeSeries(['2024-01-01'], [{ name: 'Completed', values: [2.4], color: '#1d70b8' }], {
        name: 'Average handling time',
        values: [2.4],
        color: '#ca3535',
        axis: 'y2',
      })
    );

    expect(parsed.layout.yaxis).toMatchObject({ range: [0, 2.5], dtick: 0.5 });
    expect(parsed.layout.yaxis2).toMatchObject({ range: [0, 2.5], dtick: 0.5 });
  });

  test('normalises string axis title overrides into title objects', () => {
    const chart = buildLineTimeSeries(['2024-01-01'], [{ name: 'Average', values: [2], color: '#1d70b8' }], {
      layoutOverrides: { yaxis: { title: 'Days' } },
    });
    const parsed = JSON.parse(chart);

    expect(parsed.layout.yaxis.title.text).toBe('Days');
  });
});
