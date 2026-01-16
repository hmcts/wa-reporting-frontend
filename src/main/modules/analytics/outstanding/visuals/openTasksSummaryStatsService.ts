import { taskThinRepository } from '../../shared/repositories';
import { emptyOutstandingSummary } from '../../shared/series';
import { AnalyticsFilters, OutstandingResponse } from '../../shared/types';
import { calculatePercent, toNumber } from '../../shared/utils';

type Summary = OutstandingResponse['summary'];

function finaliseSummary(summary: Summary): Summary {
  const open = summary.assigned + summary.unassigned;
  const assignedPct = calculatePercent(summary.assigned, open);
  const unassignedPct = 100 - assignedPct;
  return {
    ...summary,
    open,
    assignedPct,
    unassignedPct,
  };
}

class OpenTasksSummaryStatsService {
  async fetchOpenTasksSummary(filters: AnalyticsFilters): Promise<Summary | null> {
    const rows = await taskThinRepository.fetchOpenTasksSummaryRows(filters);

    if (rows.length === 0) {
      return null;
    }

    const summary = emptyOutstandingSummary();
    const totals = rows[0];
    summary.assigned += toNumber(totals.assigned);
    summary.unassigned += toNumber(totals.unassigned);
    summary.urgent += toNumber(totals.urgent);
    summary.high += toNumber(totals.high);
    summary.medium += toNumber(totals.medium);
    summary.low += toNumber(totals.low);

    return finaliseSummary(summary);
  }
}

export const openTasksSummaryStatsService = new OpenTasksSummaryStatsService();
