import { Response } from 'express';

import { Task } from './types';

export function logDbError(message: string, error: unknown): void {
  // eslint-disable-next-line no-console
  console.error(message, error);
}

export function respondDbError(res: Response, message: string, error: unknown): void {
  logDbError(message, error);
  res.status(500).json({ message });
}

export function settledValue<T>(result: PromiseSettledResult<T>, onError?: (reason: unknown) => void): T | null {
  if (result.status === 'fulfilled') {
    return result.value;
  }
  onError?.(result.reason);
  return null;
}

export function buildRollingAverage(values: number[], windowSize: number): number[] {
  if (windowSize <= 0) {
    return values.map(() => 0);
  }
  return values.map((_, index, arr) => {
    const start = Math.max(0, index - (windowSize - 1));
    const window = arr.slice(start, index + 1);
    const sum = window.reduce((acc, value) => acc + value, 0);
    const average = sum / window.length;
    return Math.round(average);
  });
}

export function buildDescriptionMap<T>(
  rows: T[],
  getId: (row: T) => string,
  getDescription: (row: T) => string
): Record<string, string> {
  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[getId(row)] = getDescription(row);
    return acc;
  }, {});
}

export function lookup(value: string, mapping: Record<string, string>): string {
  return mapping[value] ?? value;
}

export function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculatePercent(part: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return (part / total) * 100;
}

export function isWithinDue(task: Task): boolean {
  if (task.withinSla === true) {
    return true;
  }
  if (task.withinSla === false) {
    return false;
  }
  if (!task.completedDate || !task.dueDate) {
    return false;
  }
  const completed = new Date(task.completedDate);
  const due = new Date(task.dueDate);
  if (Number.isNaN(completed.getTime()) || Number.isNaN(due.getTime())) {
    return false;
  }
  return completed <= due;
}

export function normaliseLabel(value: string | null | undefined, fallback = 'Unknown'): string {
  if (!value) {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function groupByDateKey<T extends { date: string }, R>(
  rows: R[],
  getDateKey: (row: R) => string,
  buildEmpty: (dateKey: string) => T,
  update: (target: T, row: R) => boolean | void
): T[] {
  const map = new Map<string, T>();
  rows.forEach(row => {
    const dateKey = getDateKey(row);
    const point = map.get(dateKey) ?? buildEmpty(dateKey);
    const updated = update(point, row);
    if (updated !== false) {
      map.set(dateKey, point);
    }
  });
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}
