import { completedComplianceSummaryService } from '../../../../../main/modules/analytics/completed/visuals/completedComplianceSummaryService';
import { taskFactsRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskFactsRepository: { fetchCompletedSummaryRows: jest.fn() },
}));

describe('completedComplianceSummaryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns null when there are no rows', async () => {
    (taskFactsRepository.fetchCompletedSummaryRows as jest.Mock).mockResolvedValue([]);

    const result = await completedComplianceSummaryService.fetchCompletedSummary({});

    expect(result).toBeNull();
  });

  test('maps totals from the first row', async () => {
    (taskFactsRepository.fetchCompletedSummaryRows as jest.Mock).mockResolvedValue([{ total: 10, within: 7 }]);

    const result = await completedComplianceSummaryService.fetchCompletedSummary({ service: ['Civil'] });

    expect(taskFactsRepository.fetchCompletedSummaryRows).toHaveBeenCalledWith({ service: ['Civil'] }, undefined);
    expect(result).toEqual({ total: 10, within: 7 });
  });

  test('defaults missing totals to zero', async () => {
    (taskFactsRepository.fetchCompletedSummaryRows as jest.Mock).mockResolvedValue([
      { total: null, within: undefined },
    ]);

    const result = await completedComplianceSummaryService.fetchCompletedSummary({});

    expect(result).toEqual({ total: 0, within: 0 });
  });
});
