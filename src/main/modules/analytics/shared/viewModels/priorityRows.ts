import { formatNumber } from '../formatting';
import { TaskPriority } from '../types';

type PrioritySummary = {
  urgent: number;
  high: number;
  medium: number;
  low: number;
};

export type PriorityRow = { label: string; value: string };

export function buildPriorityRows(summary: PrioritySummary): PriorityRow[] {
  return [
    { label: TaskPriority.Urgent, value: formatNumber(summary.urgent) },
    { label: TaskPriority.High, value: formatNumber(summary.high) },
    { label: TaskPriority.Medium, value: formatNumber(summary.medium) },
    { label: TaskPriority.Low, value: formatNumber(summary.low) },
  ];
}
