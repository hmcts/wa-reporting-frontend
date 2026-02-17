import { openTasksByRegionLocationTableService } from '../../../../../main/modules/analytics/outstanding/visuals/openTasksByRegionLocationTableService';
import { taskThinRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskThinRepository: { fetchOpenTasksByRegionLocationRows: jest.fn() },
}));

describe('openTasksByRegionLocationTableService', () => {
  const snapshotId = 305;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('normalises values and aggregates region totals', async () => {
    (taskThinRepository.fetchOpenTasksByRegionLocationRows as jest.Mock).mockResolvedValue([
      {
        region: 'North',
        location: 'Leeds',
        open_tasks: 3,
        urgent: 1,
        high: 1,
        medium: 1,
        low: 0,
      },
      {
        region: 'South',
        location: 'Leeds',
        open_tasks: 1,
        urgent: 0,
        high: 1,
        medium: 0,
        low: 0,
      },
      {
        region: null,
        location: '  ',
        open_tasks: 2,
        urgent: 0,
        high: 1,
        medium: 0,
        low: 1,
      },
    ]);

    const result = await openTasksByRegionLocationTableService.fetchOpenTasksByRegionLocation(snapshotId, {});

    expect(result.locationRows).toEqual([
      { location: 'Leeds', region: 'North', open: 3, urgent: 1, high: 1, medium: 1, low: 0 },
      { location: 'Leeds', region: 'South', open: 1, urgent: 0, high: 1, medium: 0, low: 0 },
      { location: 'Unknown', region: 'Unknown', open: 2, urgent: 0, high: 1, medium: 0, low: 1 },
    ]);
    expect(result.regionRows).toEqual([
      { region: 'North', open: 3, urgent: 1, high: 1, medium: 1, low: 0 },
      { region: 'South', open: 1, urgent: 0, high: 1, medium: 0, low: 0 },
      { region: 'Unknown', open: 2, urgent: 0, high: 1, medium: 0, low: 1 },
    ]);
  });

  test('defaults nullish numeric fields to zero', async () => {
    (taskThinRepository.fetchOpenTasksByRegionLocationRows as jest.Mock).mockResolvedValue([
      {
        region: 'North',
        location: 'Leeds',
        open_tasks: null,
        urgent: undefined,
        high: null,
        medium: undefined,
        low: null,
      },
    ]);

    const result = await openTasksByRegionLocationTableService.fetchOpenTasksByRegionLocation(snapshotId, {});

    expect(result.locationRows).toEqual([
      { location: 'Leeds', region: 'North', open: 0, urgent: 0, high: 0, medium: 0, low: 0 },
    ]);
    expect(result.regionRows).toEqual([{ region: 'North', open: 0, urgent: 0, high: 0, medium: 0, low: 0 }]);
  });

  test('sorts location rows by location then region', async () => {
    (taskThinRepository.fetchOpenTasksByRegionLocationRows as jest.Mock).mockResolvedValue([
      {
        region: 'South',
        location: 'Leeds',
        open_tasks: 1,
        urgent: 0,
        high: 1,
        medium: 0,
        low: 0,
      },
      {
        region: 'North',
        location: 'Leeds',
        open_tasks: 2,
        urgent: 1,
        high: 0,
        medium: 1,
        low: 0,
      },
      {
        region: 'North',
        location: 'Bradford',
        open_tasks: 3,
        urgent: 0,
        high: 1,
        medium: 1,
        low: 1,
      },
    ]);

    const result = await openTasksByRegionLocationTableService.fetchOpenTasksByRegionLocation(snapshotId, {});

    expect(result.locationRows.map(row => `${row.location}:${row.region}`)).toEqual([
      'Bradford:North',
      'Leeds:North',
      'Leeds:South',
    ]);
  });

  test('sorts region totals alphabetically regardless of insertion order', async () => {
    (taskThinRepository.fetchOpenTasksByRegionLocationRows as jest.Mock).mockResolvedValue([
      {
        region: 'South',
        location: 'Leeds',
        open_tasks: 2,
        urgent: 0,
        high: 1,
        medium: 1,
        low: 0,
      },
      {
        region: 'North',
        location: 'York',
        open_tasks: 1,
        urgent: 1,
        high: 0,
        medium: 0,
        low: 0,
      },
    ]);

    const result = await openTasksByRegionLocationTableService.fetchOpenTasksByRegionLocation(snapshotId, {});

    expect(result.regionRows.map(row => row.region)).toEqual(['North', 'South']);
  });
});
