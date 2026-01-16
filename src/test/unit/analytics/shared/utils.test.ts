import { Response } from 'express';

import {
  buildRollingAverage,
  logDbError,
  respondDbError,
  settledValue,
  toNumber,
  toNumberOrNull,
} from '../../../../main/modules/analytics/shared/utils';

describe('analytics controller utils', () => {
  const message = 'Failed to fetch data';
  const error = new Error('boom');
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('logs database errors', () => {
    logDbError(message, error);
    expect(consoleSpy).toHaveBeenCalledWith(message, error);
  });

  it('responds with a 500 and logs database errors', () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const res = { status, json } as unknown as Response;

    respondDbError(res, message, error);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ message });
    expect(consoleSpy).toHaveBeenCalledWith(message, error);
  });

  it('returns fulfilled settled values and reports rejected ones', () => {
    const onError = jest.fn();
    const fulfilled = settledValue({ status: 'fulfilled', value: 42 }, onError);
    const rejected = settledValue({ status: 'rejected', reason: 'boom' }, onError);

    expect(fulfilled).toBe(42);
    expect(rejected).toBeNull();
    expect(onError).toHaveBeenCalledWith('boom');
  });

  it('builds rolling averages with a window size', () => {
    expect(buildRollingAverage([2, 4, 6, 8], 2)).toEqual([2, 3, 5, 7]);
    expect(buildRollingAverage([2, 4], 0)).toEqual([0, 0]);
  });

  it('returns an empty array when no values are provided', () => {
    expect(buildRollingAverage([], 3)).toEqual([]);
  });

  it('converts values to numbers with fallbacks', () => {
    expect(toNumber(10)).toBe(10);
    expect(toNumber(Infinity, 4)).toBe(4);
    expect(toNumber(BigInt(12))).toBe(12);
    expect(toNumber('3')).toBe(3);
    expect(toNumber('invalid', 7)).toBe(7);
  });

  it('converts values to numbers or null', () => {
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull(undefined)).toBeNull();
    expect(toNumberOrNull(BigInt(5))).toBe(5);
    expect(toNumberOrNull('invalid')).toBeNull();
  });
});
