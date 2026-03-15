import { taskFactsRepository } from '../../shared/repositories';
import { CompletedRegionLocationAggregateRow } from '../../shared/repositories/types';
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
  private mapByLocationRow(row: CompletedRegionLocationAggregateRow): CompletedByLocationRow {
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
  }

  private mapByRegionRow(row: CompletedRegionLocationAggregateRow): CompletedByRegionRow {
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
  }

  async fetchCompletedRegionLocation(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<{ byLocation: CompletedByLocationRow[]; byRegion: CompletedByRegionRow[] }> {
    const rows = await taskFactsRepository.fetchCompletedRegionLocationRows(snapshotId, filters, range);

    return rows.reduce<{ byLocation: CompletedByLocationRow[]; byRegion: CompletedByRegionRow[] }>(
      (result, row) => {
        if (row.grouping_type === 'location') {
          result.byLocation.push(this.mapByLocationRow(row));
        } else {
          result.byRegion.push(this.mapByRegionRow(row));
        }
        return result;
      },
      { byLocation: [], byRegion: [] }
    );
  }
}

export const completedRegionLocationTableService = new CompletedRegionLocationTableService();
