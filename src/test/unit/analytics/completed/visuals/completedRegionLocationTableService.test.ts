import { completedRegionLocationTableService } from '../../../../../main/modules/analytics/completed/visuals/completedRegionLocationTableService';
import { taskFactsRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskFactsRepository: {
    fetchCompletedByLocationRows: jest.fn(),
    fetchCompletedByRegionRows: jest.fn(),
  },
}));

describe('completedRegionLocationTableService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps location rows and calculates averages', async () => {
    (taskFactsRepository.fetchCompletedByLocationRows as jest.Mock).mockResolvedValue([
      {
        location: null,
        region: 'North',
        total: 4,
        within: 2,
        handling_time_days_sum: 12,
        handling_time_days_count: 4,
        processing_time_days_sum: '8',
        processing_time_days_count: 2,
      },
      {
        location: 'Leeds',
        region: null,
        total: 1,
        within: 1,
        handling_time_days_sum: NaN,
        handling_time_days_count: 1,
        processing_time_days_sum: null,
        processing_time_days_count: 0,
      },
      {
        location: 'York',
        region: 'North',
        total: 1,
        within: 0,
        handling_time_days_sum: 5,
        handling_time_days_count: 0,
        processing_time_days_sum: 4,
        processing_time_days_count: 0,
      },
    ]);

    const result = await completedRegionLocationTableService.fetchCompletedByLocation({});

    expect(result).toEqual([
      {
        location: 'Unknown',
        region: 'North',
        tasks: 4,
        withinDue: 2,
        beyondDue: 2,
        handlingTimeDays: 3,
        processingTimeDays: 4,
      },
      {
        location: 'Leeds',
        region: 'Unknown',
        tasks: 1,
        withinDue: 1,
        beyondDue: 0,
        handlingTimeDays: null,
        processingTimeDays: null,
      },
      {
        location: 'York',
        region: 'North',
        tasks: 1,
        withinDue: 0,
        beyondDue: 1,
        handlingTimeDays: null,
        processingTimeDays: null,
      },
    ]);
  });

  test('maps region rows with fallback labels', async () => {
    (taskFactsRepository.fetchCompletedByRegionRows as jest.Mock).mockResolvedValue([
      {
        region: null,
        total: 2,
        within: 1,
        handling_time_days_sum: 4,
        handling_time_days_count: 2,
        processing_time_days_sum: 6,
        processing_time_days_count: 3,
      },
    ]);

    const result = await completedRegionLocationTableService.fetchCompletedByRegion({});

    expect(result).toEqual([
      {
        region: 'Unknown',
        tasks: 2,
        withinDue: 1,
        beyondDue: 1,
        handlingTimeDays: 2,
        processingTimeDays: 2,
      },
    ]);
  });

  test('defaults missing totals to zero for location and region rows', async () => {
    (taskFactsRepository.fetchCompletedByLocationRows as jest.Mock).mockResolvedValue([
      {
        location: 'Leeds',
        region: 'North',
        total: null,
        within: undefined,
        handling_time_days_sum: null,
        handling_time_days_count: null,
        processing_time_days_sum: null,
        processing_time_days_count: null,
      },
    ]);

    (taskFactsRepository.fetchCompletedByRegionRows as jest.Mock).mockResolvedValue([
      {
        region: 'North',
        total: undefined,
        within: null,
        handling_time_days_sum: null,
        handling_time_days_count: null,
        processing_time_days_sum: null,
        processing_time_days_count: null,
      },
    ]);

    const locationResult = await completedRegionLocationTableService.fetchCompletedByLocation({});
    const regionResult = await completedRegionLocationTableService.fetchCompletedByRegion({});

    expect(locationResult).toEqual([
      {
        location: 'Leeds',
        region: 'North',
        tasks: 0,
        withinDue: 0,
        beyondDue: 0,
        handlingTimeDays: null,
        processingTimeDays: null,
      },
    ]);
    expect(regionResult).toEqual([
      {
        region: 'North',
        tasks: 0,
        withinDue: 0,
        beyondDue: 0,
        handlingTimeDays: null,
        processingTimeDays: null,
      },
    ]);
  });
});
