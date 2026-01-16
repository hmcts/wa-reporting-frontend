import { formatNumber } from '../formatting';

type PrioritySummary = {
  urgent: number;
  high: number;
  medium: number;
  low: number;
};

export type PriorityRow = { label: string; value: string };

export function buildPriorityRows(summary: PrioritySummary): PriorityRow[] {
  return [
    { label: 'Urgent', value: formatNumber(summary.urgent) },
    { label: 'High', value: formatNumber(summary.high) },
    { label: 'Medium', value: formatNumber(summary.medium) },
    { label: 'Low', value: formatNumber(summary.low) },
  ];
}
