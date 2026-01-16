import { tmPrisma } from '../../../../../main/modules/analytics/shared/data/prisma';
import { taskFactsRepository } from '../../../../../main/modules/analytics/shared/repositories/taskFactsRepository';

jest.mock('../../../../../main/modules/analytics/shared/data/prisma', () => ({
  tmPrisma: { $queryRaw: jest.fn() },
}));

describe('taskFactsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);
  });

  test('executes repository queries with date ranges', async () => {
    const range = { from: new Date('2024-01-01'), to: new Date('2024-01-31') };

    await taskFactsRepository.fetchServiceOverviewRows({});
    await taskFactsRepository.fetchTaskEventsByServiceRows({}, range);
    await taskFactsRepository.fetchOverviewFilterOptionsRows();
    await taskFactsRepository.fetchOpenTasksCreatedByAssignmentRows({});
    await taskFactsRepository.fetchTasksDuePriorityRows({});
    await taskFactsRepository.fetchCompletedSummaryRows({}, range);
    await taskFactsRepository.fetchCompletedTimelineRows({}, range);
    await taskFactsRepository.fetchCompletedProcessingHandlingTimeRows({}, range);
    await taskFactsRepository.fetchCompletedByNameRows({}, range);
    await taskFactsRepository.fetchCompletedByLocationRows({}, range);
    await taskFactsRepository.fetchCompletedByRegionRows({}, range);

    expect(tmPrisma.$queryRaw).toHaveBeenCalled();
  });

  test('handles optional ranges when none are provided', async () => {
    await taskFactsRepository.fetchCompletedSummaryRows({}, undefined);
    await taskFactsRepository.fetchCompletedTimelineRows({}, undefined);
    await taskFactsRepository.fetchCompletedProcessingHandlingTimeRows({}, undefined);
    await taskFactsRepository.fetchCompletedByNameRows({}, undefined);
    await taskFactsRepository.fetchCompletedByLocationRows({}, undefined);
    await taskFactsRepository.fetchCompletedByRegionRows({}, undefined);

    expect(tmPrisma.$queryRaw).toHaveBeenCalledTimes(6);
  });
});
