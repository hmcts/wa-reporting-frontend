import { taskThinRepository } from '../../shared/repositories';
import { AnalyticsFilters, WaitTimePoint } from '../../shared/types';
import { toNumber } from '../../shared/utils';

class WaitTimeByAssignedDateChartService {
  async fetchWaitTimeByAssignedDate(filters: AnalyticsFilters): Promise<WaitTimePoint[]> {
    const rows = await taskThinRepository.fetchWaitTimeByAssignedDateRows(filters);

    return rows.map(row => {
      const assignedCount = toNumber(row.assigned_task_count);
      const average = toNumber(row.avg_wait_time_days);
      return {
        date: row.date_key,
        averageWaitDays: average,
        assignedCount,
        totalWaitDays: average * assignedCount,
      };
    });
  }
}

export const waitTimeByAssignedDateChartService = new WaitTimeByAssignedDateChartService();
