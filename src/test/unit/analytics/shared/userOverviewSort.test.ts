import {
  getDefaultUserOverviewSort,
  parseUserOverviewSort,
} from '../../../../main/modules/analytics/shared/userOverviewSort';

describe('userOverviewSort', () => {
  test('returns defaults when no sort params supplied', () => {
    const sort = parseUserOverviewSort({});
    expect(sort).toEqual(getDefaultUserOverviewSort());
  });

  test('parses valid assigned and completed sort values', () => {
    const sort = parseUserOverviewSort({
      assignedSortBy: 'taskName',
      assignedSortDir: 'asc',
      completedSortBy: 'handlingTimeDays',
      completedSortDir: 'desc',
    });

    expect(sort).toEqual({
      assigned: { by: 'taskName', dir: 'asc' },
      completed: { by: 'handlingTimeDays', dir: 'desc' },
    });
  });

  test('falls back to defaults for invalid sort values', () => {
    const sort = parseUserOverviewSort({
      assignedSortBy: 'unknown',
      assignedSortDir: 'up',
      completedSortBy: '',
      completedSortDir: 'down',
    });

    expect(sort).toEqual(getDefaultUserOverviewSort());
  });
});
