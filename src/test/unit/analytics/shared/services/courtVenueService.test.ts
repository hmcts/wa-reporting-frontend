import { CacheKeys, getCache, setCache } from '../../../../../main/modules/analytics/shared/cache/cache';
import { courtVenueRepository } from '../../../../../main/modules/analytics/shared/repositories';
import { courtVenueService } from '../../../../../main/modules/analytics/shared/services/courtVenueService';

jest.mock('../../../../../main/modules/analytics/shared/cache/cache', () => ({
  CacheKeys: { courtVenues: 'court-venues', courtVenueDescriptions: 'court-venue-descriptions' },
  getCache: jest.fn(),
  setCache: jest.fn(),
}));

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  courtVenueRepository: { getAll: jest.fn() },
}));

describe('courtVenueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns cached venues when available', async () => {
    (getCache as jest.Mock).mockReturnValue([{ epimms_id: '1', site_name: 'Leeds', region_id: 'North' }]);

    const result = await courtVenueService.fetchCourtVenues();

    expect(result).toHaveLength(1);
    expect(courtVenueRepository.getAll).not.toHaveBeenCalled();
  });

  test('fetches venues and stores in cache', async () => {
    (getCache as jest.Mock).mockReturnValue(undefined);
    (courtVenueRepository.getAll as jest.Mock).mockResolvedValue([
      { epimms_id: '2', site_name: 'London', region_id: 'South' },
    ]);

    const result = await courtVenueService.fetchCourtVenues();

    expect(result).toHaveLength(1);
    expect(setCache).toHaveBeenCalledWith(CacheKeys.courtVenues, [
      { epimms_id: '2', site_name: 'London', region_id: 'South' },
    ]);
    expect(setCache).toHaveBeenCalledWith(CacheKeys.courtVenueDescriptions, { '2': 'London' });
  });

  test('returns cached description map when available', async () => {
    (getCache as jest.Mock).mockImplementation((key: string) =>
      key === CacheKeys.courtVenueDescriptions ? { '1': 'Leeds' } : undefined
    );

    const result = await courtVenueService.fetchCourtVenueDescriptions();

    expect(result).toEqual({ '1': 'Leeds' });
    expect(courtVenueRepository.getAll).not.toHaveBeenCalled();
  });

  test('builds description map when not cached', async () => {
    (getCache as jest.Mock)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ '2': 'London', '3': 'Leeds' });
    (courtVenueRepository.getAll as jest.Mock).mockResolvedValue([
      { epimms_id: '2', site_name: 'London', region_id: 'South' },
      { epimms_id: '3', site_name: 'Leeds', region_id: 'North' },
    ]);

    const result = await courtVenueService.fetchCourtVenueDescriptions();

    expect(result).toEqual({ '2': 'London', '3': 'Leeds' });
    expect(setCache).toHaveBeenCalledWith(CacheKeys.courtVenues, [
      { epimms_id: '2', site_name: 'London', region_id: 'South' },
      { epimms_id: '3', site_name: 'Leeds', region_id: 'North' },
    ]);
  });

  test('returns description for provided venue id', async () => {
    (getCache as jest.Mock).mockReturnValue({ '1': 'Leeds' });

    const result = await courtVenueService.fetchCourtVenueDescription('1');

    expect(result).toBe('Leeds');
  });

  test('returns empty descriptions when cache stays empty', async () => {
    (getCache as jest.Mock).mockReturnValue(undefined);
    (courtVenueRepository.getAll as jest.Mock).mockResolvedValue([]);

    const result = await courtVenueService.fetchCourtVenueDescriptions();

    expect(result).toEqual({});
  });
});
