import {
  getDefaultOutstandingSort,
  parseOutstandingSort,
} from '../../../../main/modules/analytics/shared/outstandingSort';

describe('outstandingSort', () => {
  test('returns defaults when no sort params supplied', () => {
    const sort = parseOutstandingSort({});
    expect(sort).toEqual(getDefaultOutstandingSort());
  });

  test('parses valid critical tasks sort values', () => {
    const sort = parseOutstandingSort({
      criticalTasksSortBy: 'priority',
      criticalTasksSortDir: 'desc',
    });

    expect(sort).toEqual({
      criticalTasks: { by: 'priority', dir: 'desc' },
    });
  });

  test('falls back to defaults for invalid sort values', () => {
    const sort = parseOutstandingSort({
      criticalTasksSortBy: 'unknown',
      criticalTasksSortDir: 'up',
    });

    expect(sort).toEqual(getDefaultOutstandingSort());
  });
});
