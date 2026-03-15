import { openTasksSummaryStatsService } from '../../../../main/modules/analytics/outstanding/visuals/openTasksSummaryStatsService';
import { snapshotOpenDueDailyFactsRepository } from '../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../main/modules/analytics/shared/repositories', () => ({
  snapshotOpenDueDailyFactsRepository: {
    fetchOpenTasksSummaryRows: jest.fn(),
  },
}));

describe('fetchOpenTasksSummary', () => {
  const snapshotId = 302;

  beforeEach(() => {
    (snapshotOpenDueDailyFactsRepository.fetchOpenTasksSummaryRows as jest.Mock).mockReset();
  });

  it('returns null when there are no rows', async () => {
    (snapshotOpenDueDailyFactsRepository.fetchOpenTasksSummaryRows as jest.Mock).mockResolvedValue([]);

    const result = await openTasksSummaryStatsService.fetchOpenTasksSummary(snapshotId, {});

    expect(result).toBeNull();
  });

  it('maps totals and calculates percentages', async () => {
    (snapshotOpenDueDailyFactsRepository.fetchOpenTasksSummaryRows as jest.Mock).mockResolvedValue([
      {
        assigned: 20,
        unassigned: 80,
        urgent: 5,
        high: 10,
        medium: 15,
        low: 70,
      },
    ]);

    const result = await openTasksSummaryStatsService.fetchOpenTasksSummary(snapshotId, { region: ['North'] });

    expect(snapshotOpenDueDailyFactsRepository.fetchOpenTasksSummaryRows).toHaveBeenCalledWith(snapshotId, {
      region: ['North'],
    });
    expect(result).toEqual({
      open: 100,
      assigned: 20,
      unassigned: 80,
      assignedPct: 20,
      unassignedPct: 80,
      urgent: 5,
      high: 10,
      medium: 15,
      low: 70,
    });
  });

  it('returns zero percentages when there are no assigned tasks', async () => {
    (snapshotOpenDueDailyFactsRepository.fetchOpenTasksSummaryRows as jest.Mock).mockResolvedValue([
      {
        assigned: 0,
        unassigned: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
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

  it('defaults missing totals to zero', async () => {
    (snapshotOpenDueDailyFactsRepository.fetchOpenTasksSummaryRows as jest.Mock).mockResolvedValue([
      {
        assigned: null,
        unassigned: undefined,
        urgent: null,
        high: undefined,
        medium: null,
        low: undefined,
      },
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
