import { truncateLabel } from '../../../../../main/modules/analytics/shared/charts/utils';

describe('truncateLabel', () => {
  test('returns label unchanged when under limit', () => {
    expect(truncateLabel('Short', 10)).toBe('Short');
  });

  test('truncates and appends ellipsis when over limit', () => {
    const result = truncateLabel('This is a long label', 10);
    expect(result).toBe('This is...');
  });
});
