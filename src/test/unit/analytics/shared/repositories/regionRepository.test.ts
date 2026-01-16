import { lrdPrisma } from '../../../../../main/modules/analytics/shared/data/prisma';
import { regionRepository } from '../../../../../main/modules/analytics/shared/repositories/regionRepository';

jest.mock('../../../../../main/modules/analytics/shared/data/prisma', () => ({
  lrdPrisma: { $queryRaw: jest.fn() },
}));

describe('regionRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns regions', async () => {
    (lrdPrisma.$queryRaw as jest.Mock).mockResolvedValue([{ region_id: '1', description: 'North' }]);

    const result = await regionRepository.getAll();

    expect(result).toEqual([{ region_id: '1', description: 'North' }]);
  });

  test('returns region by id or null', async () => {
    (lrdPrisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ region_id: '1', description: 'North' }])
      .mockResolvedValueOnce([]);

    const found = await regionRepository.getById('1');
    const missing = await regionRepository.getById('2');

    expect(found?.region_id).toBe('1');
    expect(missing).toBeNull();
  });
});
