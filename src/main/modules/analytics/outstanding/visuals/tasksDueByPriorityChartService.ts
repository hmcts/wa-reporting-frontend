import { TasksDuePriorityRow, taskFactsRepository } from '../../shared/repositories';
import { AnalyticsFilters, PrioritySeriesPoint } from '../../shared/types';
import { toNumber } from '../../shared/utils';

class TasksDueByPriorityChartService {
  async fetchTasksDueByPriority(filters: AnalyticsFilters): Promise<PrioritySeriesPoint[]> {
    const rows: TasksDuePriorityRow[] = await taskFactsRepository.fetchTasksDuePriorityRows(filters);
    return rows.map(row => ({
      date: row.date_key,
      urgent: toNumber(row.urgent),
      high: toNumber(row.high),
      medium: toNumber(row.medium),
      low: toNumber(row.low),
    }));
  }
}

export const tasksDueByPriorityChartService = new TasksDueByPriorityChartService();
