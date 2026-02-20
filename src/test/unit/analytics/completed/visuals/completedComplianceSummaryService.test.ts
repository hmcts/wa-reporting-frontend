import { completedComplianceSummaryService } from '../../../../../main/modules/analytics/completed/visuals/completedComplianceSummaryService';
import { taskFactsRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskFactsRepository: { fetchCompletedSummaryRows: jest.fn() },
}));

describe('completedComplianceSummaryService', () => {
  const snapshotId = 402;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns null when there are no rows', async () => {
    (taskFactsRepository.fetchCompletedSummaryRows as jest.Mock).mockResolvedValue([]);

    const result = await completedComplianceSummaryService.fetchCompletedSummary(snapshotId, {});

    expect(result).toBeNull();
  });

  test('maps totals from the first row', async () => {
    (taskFactsRepository.fetchCompletedSummaryRows as jest.Mock).mockResolvedValue([{ total: 10, within: 7 }]);

    const result = await completedComplianceSummaryService.fetchCompletedSummary(snapshotId, { service: ['Civil'] });

    expect(taskFactsRepository.fetchCompletedSummaryRows).toHaveBeenCalledWith(
      snapshotId,
      { service: ['Civil'] },
      undefined,
      undefined
    );
    expect(result).toEqual({ total: 10, within: 7 });
  });

  test('defaults missing totals to zero', async () => {
    (taskFactsRepository.fetchCompletedSummaryRows as jest.Mock).mockResolvedValue([
      { total: null, within: undefined },
    ]);

    const result = await completedComplianceSummaryService.fetchCompletedSummary(snapshotId, {});

    expect(result).toEqual({ total: 0, within: 0 });
  });

  test('forwards query options when provided', async () => {
    (taskFactsRepository.fetchCompletedSummaryRows as jest.Mock).mockResolvedValue([{ total: 3, within: 2 }]);

    await completedComplianceSummaryService.fetchCompletedSummary(
      snapshotId,
      { roleCategory: ['Operations'] },
      { from: new Date('2024-08-01'), to: new Date('2024-08-31') },
      { excludeRoleCategories: ['Judicial'] }
    );

    expect(taskFactsRepository.fetchCompletedSummaryRows).toHaveBeenCalledWith(
      snapshotId,
      { roleCategory: ['Operations'] },
      { from: new Date('2024-08-01'), to: new Date('2024-08-31') },
      { excludeRoleCategories: ['Judicial'] }
    );
  });
});
