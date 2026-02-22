import { Response } from 'express';
import { Task } from '../../../../main/modules/analytics/shared/types';

import {
  buildDescriptionMap,
  buildRollingAverage,
  calculatePercent,
  formatDateKey,
  groupByDateKey,
  isWithinDue,
  logDbError,
  lookup,
  normaliseLabel,
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
    expect(toNumber(true)).toBe(1);
    expect(toNumber(undefined, 5)).toBe(5);
  });

  it('converts values to numbers or null', () => {
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull(undefined)).toBeNull();
    expect(toNumberOrNull(9)).toBe(9);
    expect(toNumberOrNull(Number.NEGATIVE_INFINITY)).toBeNull();
    expect(toNumberOrNull(BigInt(5))).toBe(5);
    expect(toNumberOrNull('7')).toBe(7);
    expect(toNumberOrNull('invalid')).toBeNull();
  });

  it('builds lookup maps and resolves values', () => {
    const descriptionMap = buildDescriptionMap(
      [
        { id: '1', label: 'First' },
        { id: '2', label: 'Second' },
      ],
      row => row.id,
      row => row.label
    );

    expect(descriptionMap).toEqual({ '1': 'First', '2': 'Second' });
    expect(lookup('1', descriptionMap)).toBe('First');
    expect(lookup('missing', descriptionMap)).toBe('missing');
  });

  it('formats date keys', () => {
    expect(formatDateKey(new Date('2024-06-01T12:10:00.000Z'))).toBe('2024-06-01');
  });

  it('calculates percentages and handles zero totals', () => {
    expect(calculatePercent(2, 8)).toBe(25);
    expect(calculatePercent(2, 0)).toBe(0);
  });

  it('checks due-date outcomes from explicit flags and dates', () => {
    const baseTask: Task = {
      caseId: 'case-1',
      taskId: 'task-1',
      service: 'Service',
      roleCategory: 'Role',
      priority: 'Medium',
      status: 'assigned',
      assigneeId: 'user-1',
      assigneeName: 'A',
      totalAssignments: 1,
      taskName: 'Task',
      createdDate: '2024-01-01',
      assignedDate: '2024-01-01',
      dueDate: '2024-01-02',
      completedDate: '2024-01-02',
      region: 'Region',
      location: 'Location',
      withinSla: undefined,
      handlingTimeDays: 1,
      processingTimeDays: 1,
    };

    expect(isWithinDue({ ...baseTask, withinSla: true })).toBe(true);
    expect(isWithinDue({ ...baseTask, withinSla: false })).toBe(false);
    expect(isWithinDue({ ...baseTask, completedDate: undefined })).toBe(false);
    expect(isWithinDue({ ...baseTask, completedDate: 'invalid' })).toBe(false);
    expect(isWithinDue({ ...baseTask, completedDate: '2024-01-03' })).toBe(false);
    expect(isWithinDue({ ...baseTask, completedDate: '2024-01-02' })).toBe(true);
  });

  it('normalises labels with fallback values', () => {
    expect(normaliseLabel('Value')).toBe('Value');
    expect(normaliseLabel('  Value  ')).toBe('Value');
    expect(normaliseLabel('', 'Fallback')).toBe('Fallback');
    expect(normaliseLabel('   ', 'Fallback')).toBe('Fallback');
    expect(normaliseLabel(undefined, 'Fallback')).toBe('Fallback');
  });

  it('groups by date keys and ignores updates that return false', () => {
    const result = groupByDateKey(
      [
        { date: '2024-01-02', delta: 2 },
        { date: '2024-01-01', delta: 1 },
        { date: '2024-01-02', delta: -2 },
        { date: '2024-01-03', delta: 5 },
      ],
      row => row.date,
      dateKey => ({ date: dateKey, total: 0 }),
      (target, row) => {
        target.total += row.delta;
        return target.total >= 0;
      }
    );

    expect(result).toEqual([
      { date: '2024-01-01', total: 1 },
      { date: '2024-01-02', total: 0 },
      { date: '2024-01-03', total: 5 },
    ]);
  });

  it('does not persist rows when update explicitly returns false', () => {
    const result = groupByDateKey(
      [{ date: '2024-01-01', value: 1 }],
      row => row.date,
      dateKey => ({ date: dateKey, value: 0 }),
      () => false
    );

    expect(result).toEqual([]);
  });
});
