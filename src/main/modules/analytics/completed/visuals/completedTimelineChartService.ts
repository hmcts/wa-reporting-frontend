import { taskFactsRepository } from '../../shared/repositories';
import { AnalyticsFilters, CompletedPoint } from '../../shared/types';
import { toNumber } from '../../shared/utils';

class CompletedTimelineChartService {
  async fetchCompletedTimeline(
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedPoint[]> {
    const rows = await taskFactsRepository.fetchCompletedTimelineRows(filters, range);

    return rows.map(row => {
      const completed = toNumber(row.total);
      const withinDue = toNumber(row.within);
      return {
        date: row.date_key,
        completed,
        withinDue,
        beyondDue: completed - withinDue,
      };
    });
  }
}

export const completedTimelineChartService = new CompletedTimelineChartService();
