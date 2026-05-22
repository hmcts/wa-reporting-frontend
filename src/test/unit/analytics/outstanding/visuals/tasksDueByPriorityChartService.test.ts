import { tasksDueByPriorityChartService } from '../../../../../main/modules/analytics/outstanding/visuals/tasksDueByPriorityChartService';
import { snapshotOpenDueDailyFactsRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  snapshotOpenDueDailyFactsRepository: { fetchTasksDuePriorityRows: jest.fn() },
}));

describe('tasksDueByPriorityChartService', () => {
  const snapshotId = 308;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps rows into due-by-priority points with numeric fallbacks', async () => {
    (snapshotOpenDueDailyFactsRepository.fetchTasksDuePriorityRows as jest.Mock).mockResolvedValue([
      { date_key: '2024-02-01', urgent: 2, high: '3', medium: null, low: undefined },
      { date_key: '2024-02-02', urgent: undefined, high: undefined, medium: undefined, low: undefined },
    ]);

    const result = await tasksDueByPriorityChartService.fetchTasksDueByPriority(snapshotId, { region: ['North'] });

    expect(snapshotOpenDueDailyFactsRepository.fetchTasksDuePriorityRows).toHaveBeenCalledWith(snapshotId, {
      region: ['North'],
    });
    expect(result).toEqual([
      { date: '2024-02-01', urgent: 2, high: 3, medium: 0, low: 0 },
      { date: '2024-02-02', urgent: 0, high: 0, medium: 0, low: 0 },
    ]);
  });

  test('propagates repository errors', async () => {
    const filters = { region: ['North'] };
    const error = new Error('db error');
    (snapshotOpenDueDailyFactsRepository.fetchTasksDuePriorityRows as jest.Mock).mockRejectedValue(error);

    await expect(tasksDueByPriorityChartService.fetchTasksDueByPriority(snapshotId, filters)).rejects.toBe(error);
    expect(snapshotOpenDueDailyFactsRepository.fetchTasksDuePriorityRows).toHaveBeenCalledWith(snapshotId, filters);
  });
});
