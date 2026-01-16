import { tasksDueByDateChartService } from '../../../../../main/modules/analytics/outstanding/visuals/tasksDueByDateChartService';
import { taskThinRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskThinRepository: { fetchTasksDueByDateRows: jest.fn() },
}));

describe('tasksDueByDateChartService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps rows into due-by-date points', async () => {
    (taskThinRepository.fetchTasksDueByDateRows as jest.Mock).mockResolvedValue([
      { date_key: '2024-02-01', open: 2, completed: 3 },
      { date_key: '2024-02-02', open: undefined, completed: undefined },
    ]);

    const result = await tasksDueByDateChartService.fetchTasksDueByDate({});

    expect(result).toEqual([
      { date: '2024-02-01', open: 2, completed: 3, totalDue: 5 },
      { date: '2024-02-02', open: 0, completed: 0, totalDue: 0 },
    ]);
  });
});
