import { completedTimelineChartService } from '../../../../../main/modules/analytics/completed/visuals/completedTimelineChartService';
import { taskFactsRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskFactsRepository: { fetchCompletedTimelineRows: jest.fn() },
}));

describe('completedTimelineChartService', () => {
  const snapshotId = 405;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps timeline rows into completed points', async () => {
    (taskFactsRepository.fetchCompletedTimelineRows as jest.Mock).mockResolvedValue([
      { date_key: '2024-01-01', total: 4, within: 3 },
      { date_key: '2024-01-02', total: null, within: undefined },
    ]);

    const result = await completedTimelineChartService.fetchCompletedTimeline(snapshotId, {});

    expect(result).toEqual([
      { date: '2024-01-01', completed: 4, withinDue: 3, beyondDue: 1 },
      { date: '2024-01-02', completed: 0, withinDue: 0, beyondDue: 0 },
    ]);
  });
});
