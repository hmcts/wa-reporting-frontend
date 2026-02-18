import { taskFactsRepository } from '../../shared/repositories';
import { sortByTotalThenName } from '../../shared/sorting';
import { AnalyticsFilters, CompletedByName } from '../../shared/types';
import { normaliseLabel, toNumber } from '../../shared/utils';

class CompletedByNameChartService {
  async fetchCompletedByName(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedByName[]> {
    const rows = await taskFactsRepository.fetchCompletedByNameRows(snapshotId, filters, range);

    const mapped = rows.map(row => {
      const tasks = toNumber(row.total);
      const withinDue = toNumber(row.within);
      return {
        taskName: normaliseLabel(row.task_name, 'Unknown task'),
        tasks,
        withinDue,
        beyondDue: tasks - withinDue,
      };
    });

    return sortByTotalThenName(
      mapped,
      row => row.tasks,
      row => row.taskName
    );
  }
}

export const completedByNameChartService = new CompletedByNameChartService();
