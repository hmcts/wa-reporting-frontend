import { buildPositiveAxisScale } from '../../../../../main/modules/analytics/shared/charts/positiveAxisScale';

describe('buildPositiveAxisScale', () => {
  test.each([
    [3001, [0, 3500], 500],
    [3200, [0, 3500], 500],
    [4450, [0, 5000], 1000],
    [53, [0, 60], 10],
    [26, [0, 30], 5],
    [2.4, [0, 2.5], 0.5],
    [2.5, [0, 3], 0.5],
  ])('rounds a maximum of %s up to a labelled upper tick', (maximum, range, dtick) => {
    expect(buildPositiveAxisScale(maximum)).toEqual({ range, dtick });
  });

  test.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY])(
    'uses the minimum scale for a non-positive or non-finite maximum of %s',
    maximum => {
      expect(buildPositiveAxisScale(maximum)).toEqual({ range: [0, 1], dtick: 0.2 });
    }
  );

  test('falls back to default options when supplied options are not finite', () => {
    expect(buildPositiveAxisScale(3, { paddingRatio: Number.NaN, minUpperBound: Number.NaN })).toEqual({
      range: [0, 3.5],
      dtick: 0.5,
    });
  });

  test('respects an explicit minimum upper bound', () => {
    expect(buildPositiveAxisScale(5, { paddingRatio: 0, minUpperBound: 7 })).toEqual({
      range: [0, 7],
      dtick: 1,
    });
  });

  test('supports optional padding before rounding the upper bound', () => {
    expect(buildPositiveAxisScale(2.4, { paddingRatio: 0.05 })).toEqual({
      range: [0, 3],
      dtick: 0.5,
    });
  });

  test('normalises negative options', () => {
    expect(buildPositiveAxisScale(0, { paddingRatio: -1, minUpperBound: 0 })).toEqual({
      range: [0, 1],
      dtick: 0.2,
    });
  });

  test.each([
    [6 * Math.sqrt(2), 2],
    [6 * Math.sqrt(10), 5],
    [6 * Math.sqrt(50), 10],
  ])('uses the upper nice interval at an exact multiplier boundary', (maximum, dtick) => {
    expect(buildPositiveAxisScale(maximum).dtick).toBe(dtick);
  });
});
