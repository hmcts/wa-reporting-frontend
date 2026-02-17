import { taskFactsRepository } from '../../shared/repositories';
import { AnalyticsFilters, CompletedProcessingHandlingPoint } from '../../shared/types';
import { toNumber } from '../../shared/utils';

class CompletedProcessingHandlingTimeService {
  async fetchCompletedProcessingHandlingTime(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedProcessingHandlingPoint[]> {
    const rows = await taskFactsRepository.fetchCompletedProcessingHandlingTimeRows(snapshotId, filters, range);

    return rows.map(row => ({
      date: row.date_key,
      tasks: toNumber(row.task_count),
      handlingAverageDays: toNumber(row.handling_avg),
      handlingStdDevDays: toNumber(row.handling_stddev),
      handlingSumDays: toNumber(row.handling_sum),
      handlingCount: toNumber(row.handling_count),
      processingAverageDays: toNumber(row.processing_avg),
      processingStdDevDays: toNumber(row.processing_stddev),
      processingSumDays: toNumber(row.processing_sum),
      processingCount: toNumber(row.processing_count),
    }));
  }
}

export const completedProcessingHandlingTimeService = new CompletedProcessingHandlingTimeService();
