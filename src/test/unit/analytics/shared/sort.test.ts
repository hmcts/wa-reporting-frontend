import { parseDirection, parseSortBy } from '../../../../main/modules/analytics/shared/sort';

describe('sort helpers', () => {
  test('parseDirection returns asc/desc and rejects invalid values', () => {
    expect(parseDirection('asc')).toBe('asc');
    expect(parseDirection('desc')).toBe('desc');
    expect(parseDirection(' asc ')).toBe('asc');
    expect(parseDirection('')).toBeUndefined();
    expect(parseDirection('up')).toBeUndefined();
    expect(parseDirection(1)).toBeUndefined();
  });

  test('parseSortBy validates allowed keys and trims values', () => {
    const allowed = new Set(['createdDate', 'taskName'] as const);

    expect(parseSortBy('taskName', allowed)).toBe('taskName');
    expect(parseSortBy(' taskName ', allowed)).toBe('taskName');
    expect(parseSortBy('', allowed)).toBeUndefined();
    expect(parseSortBy('missing', allowed)).toBeUndefined();
    expect(parseSortBy(undefined, allowed)).toBeUndefined();
  });

  test('parseSortBy rejects empty values even if empty key is allowed', () => {
    const allowed = new Set(['', 'taskName']) as Set<string>;

    expect(parseSortBy('', allowed)).toBeUndefined();
    expect(parseSortBy('   ', allowed)).toBeUndefined();
  });

  test('parseSortBy does not call allowed.has for empty trimmed input', () => {
    const has = jest.fn(() => true);
    const allowed = {
      has,
    } as unknown as Set<string>;

    expect(parseSortBy('   ', allowed)).toBeUndefined();
    expect(has).not.toHaveBeenCalled();
  });
});
