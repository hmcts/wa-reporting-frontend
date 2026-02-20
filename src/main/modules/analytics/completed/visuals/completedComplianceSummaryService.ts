import { taskFactsRepository } from '../../shared/repositories';
import { AnalyticsFilters } from '../../shared/types';
import { toNumber } from '../../shared/utils';
import type { AnalyticsQueryOptions } from '../../shared/repositories/filters';

type CompletedSummary = {
  total: number;
  within: number;
};

class CompletedComplianceSummaryService {
  async fetchCompletedSummary(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date },
    queryOptions?: AnalyticsQueryOptions
  ): Promise<CompletedSummary | null> {
    const rows = await taskFactsRepository.fetchCompletedSummaryRows(snapshotId, filters, range, queryOptions);
    if (rows.length === 0) {
      return null;
    }
    const total = toNumber(rows[0].total);
    const within = toNumber(rows[0].within);
    return { total, within };
  }
}

export const completedComplianceSummaryService = new CompletedComplianceSummaryService();
