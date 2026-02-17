import { OpenTasksByNameRow, taskThinRepository } from '../../shared/repositories';
import { sortPriorityBreakdowns } from '../../shared/sorting';
import { AnalyticsFilters, PriorityBreakdown } from '../../shared/types';
import { normaliseLabel, toNumber } from '../../shared/utils';

function combineTotals(rows: PriorityBreakdown[]): PriorityBreakdown {
  return rows.reduce(
    (acc, row) => ({
      name: 'Total',
      urgent: acc.urgent + row.urgent,
      high: acc.high + row.high,
      medium: acc.medium + row.medium,
      low: acc.low + row.low,
    }),
    { name: 'Total', urgent: 0, high: 0, medium: 0, low: 0 }
  );
}

export interface OpenTasksByNameResult {
  breakdown: PriorityBreakdown[];
  totals: PriorityBreakdown;
}

class OpenTasksByNameChartService {
  async fetchOpenTasksByName(snapshotId: number, filters: AnalyticsFilters): Promise<OpenTasksByNameResult> {
    const rows: OpenTasksByNameRow[] = await taskThinRepository.fetchOpenTasksByNameRows(snapshotId, filters);
    const breakdown = sortPriorityBreakdowns(
      rows.map(row => ({
        name: normaliseLabel(row.task_name, 'Unknown task'),
        urgent: toNumber(row.urgent),
        high: toNumber(row.high),
        medium: toNumber(row.medium),
        low: toNumber(row.low),
      }))
    );
    const totals = combineTotals(breakdown);

    return { breakdown, totals };
  }
}

export const openTasksByNameChartService = new OpenTasksByNameChartService();
