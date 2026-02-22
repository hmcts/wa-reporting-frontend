import { openTasksByNameChartService } from '../../../../../main/modules/analytics/outstanding/visuals/openTasksByNameChartService';
import { taskThinRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskThinRepository: { fetchOpenTasksByNameRows: jest.fn() },
}));

describe('openTasksByNameChartService', () => {
  const snapshotId = 309;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('normalises labels, sorts by priority and produces totals', async () => {
    (taskThinRepository.fetchOpenTasksByNameRows as jest.Mock).mockResolvedValue([
      { task_name: null, urgent: 1, high: null, medium: 0, low: undefined },
      { task_name: 'Beta', urgent: 0, high: 2, medium: 1, low: 0 },
      { task_name: 'Alpha', urgent: 1, high: 0, medium: 0, low: 0 },
    ]);

    const result = await openTasksByNameChartService.fetchOpenTasksByName(snapshotId, { service: ['Service A'] });

    expect(taskThinRepository.fetchOpenTasksByNameRows).toHaveBeenCalledWith(snapshotId, {
      service: ['Service A'],
    });
    expect(result.breakdown).toEqual([
      { name: 'Alpha', urgent: 1, high: 0, medium: 0, low: 0 },
      { name: 'Unknown task', urgent: 1, high: 0, medium: 0, low: 0 },
      { name: 'Beta', urgent: 0, high: 2, medium: 1, low: 0 },
    ]);
    expect(result.totals).toEqual({
      name: 'Total',
      urgent: 2,
      high: 2,
      medium: 1,
      low: 0,
    });
  });
});
