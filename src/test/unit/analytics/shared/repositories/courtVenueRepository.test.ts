import { lrdPrisma } from '../../../../../main/modules/analytics/shared/data/prisma';
import { courtVenueRepository } from '../../../../../main/modules/analytics/shared/repositories/courtVenueRepository';

jest.mock('../../../../../main/modules/analytics/shared/data/prisma', () => ({
  lrdPrisma: { $queryRaw: jest.fn() },
}));

describe('courtVenueRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns all court venues', async () => {
    (lrdPrisma.$queryRaw as jest.Mock).mockResolvedValue([{ epimms_id: '1', site_name: 'Leeds', region_id: 'North' }]);

    const result = await courtVenueRepository.getAll();

    expect(result).toHaveLength(1);
    expect(lrdPrisma.$queryRaw).toHaveBeenCalled();
  });

  test('returns court venue by id or null', async () => {
    (lrdPrisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ epimms_id: '2', site_name: 'London', region_id: 'South' }])
      .mockResolvedValueOnce([]);

    const found = await courtVenueRepository.getById('2');
    const missing = await courtVenueRepository.getById('missing');

    expect(found?.epimms_id).toBe('2');
    expect(missing).toBeNull();
  });
});
