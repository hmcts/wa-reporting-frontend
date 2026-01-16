import { PriorityBreakdown } from './types';

export function sortPriorityBreakdowns(rows: PriorityBreakdown[]): PriorityBreakdown[] {
  return [...rows].sort((a, b) => {
    if (b.urgent !== a.urgent) {
      return b.urgent - a.urgent;
    }
    const totalA = a.urgent + a.high + a.medium + a.low;
    const totalB = b.urgent + b.high + b.medium + b.low;
    if (totalB !== totalA) {
      return totalB - totalA;
    }
    return a.name.localeCompare(b.name);
  });
}

export function sortByTotalThenName<T>(rows: T[], total: (row: T) => number, name: (row: T) => string): T[] {
  return [...rows].sort((a, b) => {
    const totalDiff = total(b) - total(a);
    if (totalDiff !== 0) {
      return totalDiff;
    }
    return name(a).localeCompare(name(b));
  });
}
