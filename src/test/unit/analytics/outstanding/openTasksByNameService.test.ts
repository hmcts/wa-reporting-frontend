import { openTasksByNameChartService } from '../../../../main/modules/analytics/outstanding/visuals/openTasksByNameChartService';
import { taskThinRepository } from '../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../main/modules/analytics/shared/repositories', () => ({
  taskThinRepository: { fetchOpenTasksByNameRows: jest.fn() },
}));

describe('fetchOpenTasksByName', () => {
  const snapshotId = 301;

  beforeEach(() => {
    (taskThinRepository.fetchOpenTasksByNameRows as jest.Mock).mockResolvedValue([]);
  });

  test('applies filters to the query', async () => {
    const filters = {
      service: ['Service A'],
      roleCategory: ['Ops'],
      region: ['North'],
      location: ['Leeds'],
      taskName: ['Review'],
      user: ['user-1'],
    };

    await openTasksByNameChartService.fetchOpenTasksByName(snapshotId, filters);

    expect(taskThinRepository.fetchOpenTasksByNameRows).toHaveBeenCalledWith(snapshotId, filters);
  });

  test('builds breakdown totals and ordering', async () => {
    (taskThinRepository.fetchOpenTasksByNameRows as jest.Mock).mockResolvedValue([
      { task_name: 'Task B', urgent: 2, high: 0, medium: 0, low: 1 },
      { task_name: 'Task A', urgent: 0, high: 1, medium: 0, low: 3 },
      { task_name: null, urgent: 0, high: 0, medium: 0, low: 2 },
    ]);

    const result = await openTasksByNameChartService.fetchOpenTasksByName(snapshotId, {});

    expect(result.breakdown.map(row => row.name)).toEqual(['Task B', 'Task A', 'Unknown task']);
    expect(result.breakdown[0].urgent).toBe(2);
    expect(result.breakdown[0].low).toBe(1);
    expect(result.breakdown[1].high).toBe(1);
    expect(result.breakdown[1].low).toBe(3);
    expect(result.totals.urgent).toBe(2);
    expect(result.totals.high).toBe(1);
    expect(result.totals.low).toBe(6);
  });

  test('uses name order when totals are tied', async () => {
    (taskThinRepository.fetchOpenTasksByNameRows as jest.Mock).mockResolvedValue([
      { task_name: 'Task B', urgent: 0, high: 1, medium: 0, low: 0 },
      { task_name: 'Task A', urgent: 0, high: 1, medium: 0, low: 0 },
    ]);

    const result = await openTasksByNameChartService.fetchOpenTasksByName(snapshotId, {});

    expect(result.breakdown.map(row => row.name)).toEqual(['Task A', 'Task B']);
  });

  test('orders by total when urgent counts are tied', async () => {
    (taskThinRepository.fetchOpenTasksByNameRows as jest.Mock).mockResolvedValue([
      { task_name: 'Task B', urgent: 0, high: 4, medium: 0, low: 0 },
      { task_name: 'Task A', urgent: 0, high: 2, medium: 0, low: 0 },
    ]);

    const result = await openTasksByNameChartService.fetchOpenTasksByName(snapshotId, {});

    expect(result.breakdown.map(row => row.name)).toEqual(['Task B', 'Task A']);
  });

  test('defaults missing counts to zero', async () => {
    (taskThinRepository.fetchOpenTasksByNameRows as jest.Mock).mockResolvedValue([
      { task_name: 'Task A', urgent: null, high: null, medium: null, low: null },
    ]);

    const result = await openTasksByNameChartService.fetchOpenTasksByName(snapshotId, {});

    expect(result.breakdown).toEqual([{ name: 'Task A', urgent: 0, high: 0, medium: 0, low: 0 }]);
  });
});
