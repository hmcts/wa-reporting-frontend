import {
  fetchFilterOptionsWithFallback,
  normaliseDateRange,
  resolveDateRangeWithDefaults,
  settledArrayWithFallback,
  settledValueWithFallback,
} from '../../../../main/modules/analytics/shared/pageUtils';
import { filterService } from '../../../../main/modules/analytics/shared/services';
import { logDbError } from '../../../../main/modules/analytics/shared/utils';

jest.mock('../../../../main/modules/analytics/shared/services', () => ({
  filterService: { fetchFilterOptions: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/shared/utils', () => ({
  logDbError: jest.fn(),
  settledValue: jest.requireActual('../../../../main/modules/analytics/shared/utils').settledValue,
}));

describe('pageUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetchFilterOptionsWithFallback returns data when service succeeds', async () => {
    (filterService.fetchFilterOptions as jest.Mock).mockResolvedValue({
      services: ['A'],
      roleCategories: [],
      regions: [],
      locations: [],
      taskNames: [],
      workTypes: [],
      users: [],
    });

    const result = await fetchFilterOptionsWithFallback('Failed');

    expect(result.services).toEqual(['A']);
    expect(logDbError).not.toHaveBeenCalled();
  });

  test('fetchFilterOptionsWithFallback logs errors and returns defaults', async () => {
    (filterService.fetchFilterOptions as jest.Mock).mockRejectedValue(new Error('db'));

    const result = await fetchFilterOptionsWithFallback('Failed');

    expect(result).toEqual({
      services: [],
      roleCategories: [],
      regions: [],
      locations: [],
      taskNames: [],
      workTypes: [],
      users: [],
    });
    expect(logDbError).toHaveBeenCalledWith('Failed', expect.any(Error));
  });

  test('normaliseDateRange swaps dates when needed', () => {
    const range = normaliseDateRange({ from: new Date('2024-05-10'), to: new Date('2024-05-01') });

    expect(range).toEqual({ from: new Date('2024-05-01'), to: new Date('2024-05-10') });
  });

  test('normaliseDateRange returns undefined when empty', () => {
    expect(normaliseDateRange()).toBeUndefined();
  });

  test('resolveDateRangeWithDefaults returns a 30-day window by default', () => {
    const { from, to } = resolveDateRangeWithDefaults({});

    const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000);
    expect(diffDays).toBe(30);
  });

  test('resolveDateRangeWithDefaults swaps inverted ranges', () => {
    const { from, to } = resolveDateRangeWithDefaults({
      from: new Date('2024-05-10'),
      to: new Date('2024-05-01'),
    });

    expect(from).toEqual(new Date('2024-05-01'));
    expect(to).toEqual(new Date('2024-05-10'));
  });

  test('settledValueWithFallback uses fallback when rejected', () => {
    const result = settledValueWithFallback({ status: 'rejected', reason: 'boom' }, 'Failed', 42);

    expect(result).toBe(42);
    expect(logDbError).toHaveBeenCalledWith('Failed', 'boom');
  });

  test('settledValueWithFallback returns value when present', () => {
    const result = settledValueWithFallback({ status: 'fulfilled', value: 7 }, 'Failed', 42);

    expect(result).toBe(7);
  });

  test('settledArrayWithFallback uses fallback for empty arrays', () => {
    const result = settledArrayWithFallback({ status: 'fulfilled', value: [] }, 'Failed', [1, 2]);

    expect(result).toEqual([1, 2]);
  });

  test('settledArrayWithFallback returns non-empty arrays', () => {
    const result = settledArrayWithFallback({ status: 'fulfilled', value: [3] }, 'Failed', [1, 2]);

    expect(result).toEqual([3]);
  });
});
