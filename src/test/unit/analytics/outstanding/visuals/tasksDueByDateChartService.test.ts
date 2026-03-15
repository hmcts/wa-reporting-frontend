import { tasksDueByDateChartService } from '../../../../../main/modules/analytics/outstanding/visuals/tasksDueByDateChartService';
import { taskFactsRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskFactsRepository: { fetchTasksDueByDateRows: jest.fn() },
}));

describe('tasksDueByDateChartService', () => {
  const snapshotId = 307;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps rows into due-by-date points', async () => {
    const filters = {};
    (taskFactsRepository.fetchTasksDueByDateRows as jest.Mock).mockResolvedValue([
      { date_key: '2024-02-01', open: 2, completed: 3 },
      { date_key: '2024-02-02', open: undefined, completed: undefined },
    ]);

    const result = await tasksDueByDateChartService.fetchTasksDueByDate(snapshotId, filters);

    expect(taskFactsRepository.fetchTasksDueByDateRows).toHaveBeenCalledWith(snapshotId, filters);
    expect(result).toEqual([
      { date: '2024-02-01', open: 2, completed: 3, totalDue: 5 },
      { date: '2024-02-02', open: 0, completed: 0, totalDue: 0 },
    ]);
  });

  test('propagates repository errors', async () => {
    const filters = { region: ['North'] };
    const error = new Error('db error');
    (taskFactsRepository.fetchTasksDueByDateRows as jest.Mock).mockRejectedValue(error);

    await expect(tasksDueByDateChartService.fetchTasksDueByDate(snapshotId, filters)).rejects.toBe(error);
    expect(taskFactsRepository.fetchTasksDueByDateRows).toHaveBeenCalledWith(snapshotId, filters);
  });
});
