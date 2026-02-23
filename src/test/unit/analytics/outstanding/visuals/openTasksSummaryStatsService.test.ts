import { openTasksSummaryStatsService } from '../../../../../main/modules/analytics/outstanding/visuals/openTasksSummaryStatsService';
import { taskThinRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskThinRepository: { fetchOpenTasksSummaryRows: jest.fn() },
}));

describe('openTasksSummaryStatsService', () => {
  const snapshotId = 310;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns null when no summary rows are available', async () => {
    (taskThinRepository.fetchOpenTasksSummaryRows as jest.Mock).mockResolvedValue([]);

    const result = await openTasksSummaryStatsService.fetchOpenTasksSummary(snapshotId, {});

    expect(result).toBeNull();
  });

  test('maps summary totals and calculates percentages', async () => {
    (taskThinRepository.fetchOpenTasksSummaryRows as jest.Mock).mockResolvedValue([
      { assigned: '3', unassigned: 1, urgent: 2, high: 1, medium: null, low: undefined },
    ]);

    const result = await openTasksSummaryStatsService.fetchOpenTasksSummary(snapshotId, { region: ['North'] });

    expect(taskThinRepository.fetchOpenTasksSummaryRows).toHaveBeenCalledWith(snapshotId, {
      region: ['North'],
    });
    expect(result).toEqual({
      open: 4,
      assigned: 3,
      unassigned: 1,
      assignedPct: 75,
      unassignedPct: 25,
      urgent: 2,
      high: 1,
      medium: 0,
      low: 0,
    });
  });

  test('defaults percentages when open totals are zero', async () => {
    (taskThinRepository.fetchOpenTasksSummaryRows as jest.Mock).mockResolvedValue([
      { assigned: 0, unassigned: 0, urgent: 0, high: 0, medium: 0, low: 0 },
    ]);

    const result = await openTasksSummaryStatsService.fetchOpenTasksSummary(snapshotId, {});

    expect(result).toEqual({
      open: 0,
      assigned: 0,
      unassigned: 0,
      assignedPct: 0,
      unassignedPct: 100,
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    });
  });
});
