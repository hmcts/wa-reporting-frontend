import { taskThinRepository } from '../../shared/repositories';
import { AnalyticsFilters, DueByDatePoint } from '../../shared/types';
import { toNumber } from '../../shared/utils';

class TasksDueByDateChartService {
  async fetchTasksDueByDate(filters: AnalyticsFilters): Promise<DueByDatePoint[]> {
    const rows = await taskThinRepository.fetchTasksDueByDateRows(filters);

    return rows.map(row => {
      const open = toNumber(row.open);
      const completed = toNumber(row.completed);
      return {
        date: row.date_key,
        open,
        completed,
        totalDue: open + completed,
      };
    });
  }
}

export const tasksDueByDateChartService = new TasksDueByDateChartService();
