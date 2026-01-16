import { taskFactsRepository } from '../../shared/repositories';
import { emptyTaskEventsByServiceRow } from '../../shared/series';
import { AnalyticsFilters, TaskEventsByServiceResponse } from '../../shared/types';
import { toNumber } from '../../shared/utils';

class TaskEventsByServiceChartService {
  async fetchTaskEventsByService(
    filters: AnalyticsFilters,
    range: { from: Date; to: Date }
  ): Promise<TaskEventsByServiceResponse> {
    const rows = await taskFactsRepository.fetchTaskEventsByServiceRows(filters, range);

    const mappedRows = rows.map(row => ({
      service: row.service,
      completed: toNumber(row.completed),
      cancelled: toNumber(row.cancelled),
      created: toNumber(row.created),
    }));

    const totals = mappedRows.reduce((acc, row) => {
      acc.completed += row.completed;
      acc.cancelled += row.cancelled;
      acc.created += row.created;
      return acc;
    }, emptyTaskEventsByServiceRow('Total'));

    return { rows: mappedRows, totals };
  }
}

export const taskEventsByServiceChartService = new TaskEventsByServiceChartService();
