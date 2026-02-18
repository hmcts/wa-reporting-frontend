import { taskEventsByServiceChartService } from '../../../../../main/modules/analytics/overview/visuals/taskEventsByServiceChartService';
import { taskFactsRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskFactsRepository: { fetchTaskEventsByServiceRows: jest.fn() },
}));

describe('taskEventsByServiceChartService', () => {
  const snapshotId = 202;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps rows and builds totals', async () => {
    (taskFactsRepository.fetchTaskEventsByServiceRows as jest.Mock).mockResolvedValue([
      { service: 'Service A', completed: 3, cancelled: 2, created: 4 },
      { service: 'Service B', completed: 1, cancelled: 0, created: 2 },
      { service: 'Service C', completed: null, cancelled: undefined, created: undefined },
    ]);

    const result = await taskEventsByServiceChartService.fetchTaskEventsByService(
      snapshotId,
      {},
      {
        from: new Date('2024-01-01'),
        to: new Date('2024-01-31'),
      }
    );

    expect(result.rows).toEqual([
      { service: 'Service A', completed: 3, cancelled: 2, created: 4 },
      { service: 'Service B', completed: 1, cancelled: 0, created: 2 },
      { service: 'Service C', completed: 0, cancelled: 0, created: 0 },
    ]);
    expect(result.totals).toEqual({ service: 'Total', completed: 4, cancelled: 2, created: 6 });
  });

  test('returns zero totals when no rows are returned', async () => {
    (taskFactsRepository.fetchTaskEventsByServiceRows as jest.Mock).mockResolvedValue([]);

    const result = await taskEventsByServiceChartService.fetchTaskEventsByService(
      snapshotId,
      {},
      {
        from: new Date('2024-02-01'),
        to: new Date('2024-02-02'),
      }
    );

    expect(result).toEqual({ rows: [], totals: { service: 'Total', completed: 0, cancelled: 0, created: 0 } });
  });
});
