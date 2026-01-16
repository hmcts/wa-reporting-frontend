import { CacheKeys, getCache, setCache } from '../../../../../main/modules/analytics/shared/cache/cache';
import { regionRepository } from '../../../../../main/modules/analytics/shared/repositories';
import { regionService } from '../../../../../main/modules/analytics/shared/services/regionService';

jest.mock('../../../../../main/modules/analytics/shared/cache/cache', () => ({
  CacheKeys: { regions: 'regions', regionDescriptions: 'region-descriptions' },
  getCache: jest.fn(),
  setCache: jest.fn(),
}));

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  regionRepository: { getAll: jest.fn() },
}));

describe('regionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns cached regions when available', async () => {
    (getCache as jest.Mock).mockReturnValue([{ region_id: '1', description: 'North' }]);

    const result = await regionService.fetchRegions();

    expect(result).toEqual([{ region_id: '1', description: 'North' }]);
    expect(regionRepository.getAll).not.toHaveBeenCalled();
  });

  test('fetches regions and stores in cache', async () => {
    (getCache as jest.Mock).mockReturnValue(undefined);
    (regionRepository.getAll as jest.Mock).mockResolvedValue([{ region_id: '2', description: 'South' }]);

    const result = await regionService.fetchRegions();

    expect(result).toEqual([{ region_id: '2', description: 'South' }]);
    expect(setCache).toHaveBeenCalledWith(CacheKeys.regions, [{ region_id: '2', description: 'South' }]);
    expect(setCache).toHaveBeenCalledWith(CacheKeys.regionDescriptions, { '2': 'South' });
  });

  test('returns cached description map when available', async () => {
    (getCache as jest.Mock).mockImplementation((key: string) =>
      key === CacheKeys.regionDescriptions ? { '1': 'North' } : undefined
    );

    const result = await regionService.fetchRegionDescriptions();

    expect(result).toEqual({ '1': 'North' });
    expect(regionRepository.getAll).not.toHaveBeenCalled();
  });

  test('builds description map when not cached', async () => {
    (getCache as jest.Mock)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ '2': 'South', '3': 'East' });
    (regionRepository.getAll as jest.Mock).mockResolvedValue([
      { region_id: '2', description: 'South' },
      { region_id: '3', description: 'East' },
    ]);

    const result = await regionService.fetchRegionDescriptions();

    expect(result).toEqual({ '2': 'South', '3': 'East' });
    expect(setCache).toHaveBeenCalledWith(CacheKeys.regions, [
      { region_id: '2', description: 'South' },
      { region_id: '3', description: 'East' },
    ]);
  });

  test('returns description for provided region id', async () => {
    (getCache as jest.Mock).mockReturnValue({ '1': 'North' });

    const result = await regionService.fetchRegionDescription('1');

    expect(result).toBe('North');
  });

  test('returns empty descriptions when cache stays empty', async () => {
    (getCache as jest.Mock).mockReturnValue(undefined);
    (regionRepository.getAll as jest.Mock).mockResolvedValue([]);

    const result = await regionService.fetchRegionDescriptions();

    expect(result).toEqual({});
  });
});
