import { tasksDueByPriorityChartService } from '../../../../main/modules/analytics/outstanding/visuals/tasksDueByPriorityChartService';
import { snapshotOpenDueDailyFactsRepository } from '../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../main/modules/analytics/shared/repositories', () => ({
  snapshotOpenDueDailyFactsRepository: {
    fetchTasksDuePriorityRows: jest.fn(),
  },
}));

describe('fetchTasksDueByPriority', () => {
  const snapshotId = 303;

  beforeEach(() => {
    (snapshotOpenDueDailyFactsRepository.fetchTasksDuePriorityRows as jest.Mock).mockReset();
  });

  it('passes filters to the repository and maps buckets into series points', async () => {
    const filters = { service: ['Service A'] };
    (snapshotOpenDueDailyFactsRepository.fetchTasksDuePriorityRows as jest.Mock).mockResolvedValue([
      { date_key: '2025-01-01', urgent: 0, high: 0, medium: 0, low: 2 },
      { date_key: '2025-01-02', urgent: 3, high: 5, medium: 0, low: 0 },
    ]);

    const result = await tasksDueByPriorityChartService.fetchTasksDueByPriority(snapshotId, filters);

    expect(snapshotOpenDueDailyFactsRepository.fetchTasksDuePriorityRows).toHaveBeenCalledWith(snapshotId, filters);
    expect(result).toEqual([
      { date: '2025-01-01', urgent: 0, high: 0, medium: 0, low: 2 },
      { date: '2025-01-02', urgent: 3, high: 5, medium: 0, low: 0 },
    ]);
  });

  it('returns zero totals when counts are zero', async () => {
    (snapshotOpenDueDailyFactsRepository.fetchTasksDuePriorityRows as jest.Mock).mockResolvedValue([
      { date_key: '2025-01-03', urgent: 0, high: 0, medium: 0, low: 0 },
    ]);

    const result = await tasksDueByPriorityChartService.fetchTasksDueByPriority(snapshotId, {});

    expect(result).toEqual([{ date: '2025-01-03', urgent: 0, high: 0, medium: 0, low: 0 }]);
  });

  it('defaults missing totals to zero', async () => {
    (snapshotOpenDueDailyFactsRepository.fetchTasksDuePriorityRows as jest.Mock).mockResolvedValue([
      { date_key: '2025-01-04', urgent: 0, high: null, medium: 0, low: 0 },
    ]);

    const result = await tasksDueByPriorityChartService.fetchTasksDueByPriority(snapshotId, {});

    expect(result).toEqual([{ date: '2025-01-04', urgent: 0, high: 0, medium: 0, low: 0 }]);
  });
});
