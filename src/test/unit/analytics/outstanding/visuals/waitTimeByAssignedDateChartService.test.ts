import { waitTimeByAssignedDateChartService } from '../../../../../main/modules/analytics/outstanding/visuals/waitTimeByAssignedDateChartService';
import { taskThinRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskThinRepository: { fetchWaitTimeByAssignedDateRows: jest.fn() },
}));

describe('waitTimeByAssignedDateChartService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps rows into wait time points', async () => {
    (taskThinRepository.fetchWaitTimeByAssignedDateRows as jest.Mock).mockResolvedValue([
      { date_key: '2024-03-01', avg_wait_time_days: 2, assigned_task_count: 4 },
      { date_key: '2024-03-02', avg_wait_time_days: null, assigned_task_count: null },
    ]);

    const result = await waitTimeByAssignedDateChartService.fetchWaitTimeByAssignedDate({});

    expect(result).toEqual([
      { date: '2024-03-01', averageWaitDays: 2, assignedCount: 4, totalWaitDays: 8 },
      { date: '2024-03-02', averageWaitDays: 0, assignedCount: 0, totalWaitDays: 0 },
    ]);
  });
});
