import { taskFactsRepository } from '../../shared/repositories';
import { AnalyticsFilters, CompletedByLocationRow, CompletedByRegionRow } from '../../shared/types';
import { normaliseLabel, toNumber, toNumberOrNull } from '../../shared/utils';

function averageFromTotals(sum: unknown, count: unknown): number | null {
  const totalCount = toNumber(count, 0);
  if (totalCount <= 0) {
    return null;
  }
  const numericSum = toNumberOrNull(sum);
  if (numericSum === null) {
    return null;
  }
  return numericSum / totalCount;
}

class CompletedRegionLocationTableService {
  async fetchCompletedByLocation(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedByLocationRow[]> {
    const rows = await taskFactsRepository.fetchCompletedByLocationRows(snapshotId, filters, range);
    return rows.map(row => {
      const tasks = toNumber(row.total);
      const withinDue = toNumber(row.within);
      const handlingAverage = averageFromTotals(row.handling_time_days_sum, row.handling_time_days_count);
      const processingAverage = averageFromTotals(row.processing_time_days_sum, row.processing_time_days_count);
      return {
        location: normaliseLabel(row.location),
        region: normaliseLabel(row.region),
        tasks,
        withinDue,
        beyondDue: tasks - withinDue,
        handlingTimeDays: handlingAverage,
        processingTimeDays: processingAverage,
      };
    });
  }

  async fetchCompletedByRegion(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedByRegionRow[]> {
    const rows = await taskFactsRepository.fetchCompletedByRegionRows(snapshotId, filters, range);
    return rows.map(row => {
      const tasks = toNumber(row.total);
      const withinDue = toNumber(row.within);
      const handlingAverage = averageFromTotals(row.handling_time_days_sum, row.handling_time_days_count);
      const processingAverage = averageFromTotals(row.processing_time_days_sum, row.processing_time_days_count);
      return {
        region: normaliseLabel(row.region),
        tasks,
        withinDue,
        beyondDue: tasks - withinDue,
        handlingTimeDays: handlingAverage,
        processingTimeDays: processingAverage,
      };
    });
  }
}

export const completedRegionLocationTableService = new CompletedRegionLocationTableService();
