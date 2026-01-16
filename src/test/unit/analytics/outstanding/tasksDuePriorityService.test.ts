import { tasksDueByPriorityChartService } from '../../../../main/modules/analytics/outstanding/visuals/tasksDueByPriorityChartService';
import { taskFactsRepository } from '../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../main/modules/analytics/shared/repositories', () => ({
  taskFactsRepository: {
    fetchTasksDuePriorityRows: jest.fn(),
  },
}));

describe('fetchTasksDueByPriority', () => {
  beforeEach(() => {
    (taskFactsRepository.fetchTasksDuePriorityRows as jest.Mock).mockReset();
  });

  it('passes filters to the repository and maps buckets into series points', async () => {
    const filters = { service: ['Service A'] };
    (taskFactsRepository.fetchTasksDuePriorityRows as jest.Mock).mockResolvedValue([
      { date_key: '2025-01-01', urgent: 0, high: 0, medium: 0, low: 2 },
      { date_key: '2025-01-02', urgent: 3, high: 5, medium: 0, low: 0 },
    ]);

    const result = await tasksDueByPriorityChartService.fetchTasksDueByPriority(filters);

    expect(taskFactsRepository.fetchTasksDuePriorityRows).toHaveBeenCalledWith(filters);
    expect(result).toEqual([
      { date: '2025-01-01', urgent: 0, high: 0, medium: 0, low: 2 },
      { date: '2025-01-02', urgent: 3, high: 5, medium: 0, low: 0 },
    ]);
  });

  it('returns zero totals when counts are zero', async () => {
    (taskFactsRepository.fetchTasksDuePriorityRows as jest.Mock).mockResolvedValue([
      { date_key: '2025-01-03', urgent: 0, high: 0, medium: 0, low: 0 },
    ]);

    const result = await tasksDueByPriorityChartService.fetchTasksDueByPriority({});

    expect(result).toEqual([{ date: '2025-01-03', urgent: 0, high: 0, medium: 0, low: 0 }]);
  });

  it('defaults missing totals to zero', async () => {
    (taskFactsRepository.fetchTasksDuePriorityRows as jest.Mock).mockResolvedValue([
      { date_key: '2025-01-04', urgent: 0, high: null, medium: 0, low: 0 },
    ]);

    const result = await tasksDueByPriorityChartService.fetchTasksDueByPriority({});

    expect(result).toEqual([{ date: '2025-01-04', urgent: 0, high: 0, medium: 0, low: 0 }]);
  });
});
