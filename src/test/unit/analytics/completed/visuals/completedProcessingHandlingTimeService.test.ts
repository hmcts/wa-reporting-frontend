import { completedProcessingHandlingTimeService } from '../../../../../main/modules/analytics/completed/visuals/completedProcessingHandlingTimeService';
import { taskFactsRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskFactsRepository: { fetchCompletedProcessingHandlingTimeRows: jest.fn() },
}));

describe('completedProcessingHandlingTimeService', () => {
  const snapshotId = 403;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps repository rows into processing/handling points', async () => {
    (taskFactsRepository.fetchCompletedProcessingHandlingTimeRows as jest.Mock).mockResolvedValue([
      {
        date_key: '2024-02-01',
        task_count: '4',
        handling_avg: '1.5',
        handling_stddev: '0.5',
        handling_sum: '6',
        handling_count: '4',
        processing_avg: '2.5',
        processing_stddev: '1.0',
        processing_sum: '10',
        processing_count: '4',
      },
    ]);

    const result = await completedProcessingHandlingTimeService.fetchCompletedProcessingHandlingTime(
      snapshotId,
      {},
      { from: new Date('2024-02-01'), to: new Date('2024-02-10') }
    );

    expect(taskFactsRepository.fetchCompletedProcessingHandlingTimeRows).toHaveBeenCalledWith(
      snapshotId,
      {},
      expect.objectContaining({ from: new Date('2024-02-01'), to: new Date('2024-02-10') })
    );
    expect(result).toEqual([
      {
        date: '2024-02-01',
        tasks: 4,
        handlingAverageDays: 1.5,
        handlingStdDevDays: 0.5,
        handlingSumDays: 6,
        handlingCount: 4,
        processingAverageDays: 2.5,
        processingStdDevDays: 1,
        processingSumDays: 10,
        processingCount: 4,
      },
    ]);
  });
});
