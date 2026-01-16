import { emptyOverviewFilterOptions } from './filters';
import { type FilterOptions, filterService } from './services';
import { logDbError, settledValue } from './utils';

export async function fetchFilterOptionsWithFallback(errorMessage: string): Promise<FilterOptions> {
  let filterOptions = emptyOverviewFilterOptions();
  try {
    filterOptions = await filterService.fetchFilterOptions();
  } catch (error) {
    logDbError(errorMessage, error);
  }
  return filterOptions;
}

export function normaliseDateRange(range?: { from?: Date; to?: Date }): { from?: Date; to?: Date } | undefined {
  if (!range?.from && !range?.to) {
    return undefined;
  }
  let { from, to } = range;
  if (from && to && from > to) {
    [from, to] = [to, from];
  }
  return { from, to };
}

export function resolveDateRangeWithDefaults(options: { from?: Date; to?: Date; daysBack?: number }): {
  from: Date;
  to: Date;
} {
  const now = new Date();
  const defaultTo = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setDate(defaultFrom.getDate() - (options.daysBack ?? 30));
  let from = options.from ?? defaultFrom;
  let to = options.to ?? defaultTo;
  if (from > to) {
    [from, to] = [to, from];
  }
  return { from, to };
}

export function settledValueWithError<T>(result: PromiseSettledResult<T>, errorMessage: string): T | null {
  return settledValue(result, reason => logDbError(errorMessage, reason));
}

export function settledValueWithFallback<T>(
  result: PromiseSettledResult<T | null>,
  errorMessage: string,
  fallback: T
): T {
  const value = settledValueWithError(result, errorMessage);
  return value ?? fallback;
}

export function settledArrayWithFallback<T>(
  result: PromiseSettledResult<T[]>,
  errorMessage: string,
  fallback: T[]
): T[] {
  const value = settledValueWithError(result, errorMessage);
  return value && value.length > 0 ? value : fallback;
}
