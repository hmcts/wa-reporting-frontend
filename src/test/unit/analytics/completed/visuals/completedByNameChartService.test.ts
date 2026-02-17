import { completedByNameChartService } from '../../../../../main/modules/analytics/completed/visuals/completedByNameChartService';
import { taskFactsRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskFactsRepository: { fetchCompletedByNameRows: jest.fn() },
}));

describe('completedByNameChartService', () => {
  const snapshotId = 401;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps rows into completed-by-name values and sorts by task count', async () => {
    (taskFactsRepository.fetchCompletedByNameRows as jest.Mock).mockResolvedValue([
      { task_name: 'Task B', total: 2, within: 1 },
      { task_name: null, total: 2, within: 2 },
      { task_name: 'Task A', total: 3, within: 2 },
    ]);

    const result = await completedByNameChartService.fetchCompletedByName(snapshotId, {});

    expect(taskFactsRepository.fetchCompletedByNameRows).toHaveBeenCalledWith(snapshotId, {}, undefined);
    expect(result).toEqual([
      { taskName: 'Task A', tasks: 3, withinDue: 2, beyondDue: 1 },
      { taskName: 'Task B', tasks: 2, withinDue: 1, beyondDue: 1 },
      { taskName: 'Unknown task', tasks: 2, withinDue: 2, beyondDue: 0 },
    ]);
  });

  test('sorts by name when task totals are equal', async () => {
    (taskFactsRepository.fetchCompletedByNameRows as jest.Mock).mockResolvedValue([
      { task_name: 'Beta', total: 1, within: 1 },
      { task_name: 'Alpha', total: 1, within: 0 },
    ]);

    const result = await completedByNameChartService.fetchCompletedByName(snapshotId, {});

    expect(result.map(row => row.taskName)).toEqual(['Alpha', 'Beta']);
  });

  test('defaults missing totals to zero', async () => {
    (taskFactsRepository.fetchCompletedByNameRows as jest.Mock).mockResolvedValue([
      { task_name: 'Task C', total: null, within: null },
    ]);

    const result = await completedByNameChartService.fetchCompletedByName(snapshotId, {});

    expect(result).toEqual([{ taskName: 'Task C', tasks: 0, withinDue: 0, beyondDue: 0 }]);
  });
});
