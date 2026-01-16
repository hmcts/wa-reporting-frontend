import { crdPrisma } from '../../../../../main/modules/analytics/shared/data/prisma';
import { caseWorkerProfileRepository } from '../../../../../main/modules/analytics/shared/repositories/caseWorkerProfileRepository';

jest.mock('../../../../../main/modules/analytics/shared/data/prisma', () => ({
  crdPrisma: { $queryRaw: jest.fn() },
}));

describe('caseWorkerProfileRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns all profiles', async () => {
    (crdPrisma.$queryRaw as jest.Mock).mockResolvedValue([
      { case_worker_id: 'id-1', first_name: 'Sam', last_name: 'Lee', email_id: 'sam@example.com', region_id: 1 },
    ]);

    const result = await caseWorkerProfileRepository.getAll();

    expect(result).toHaveLength(1);
    expect(crdPrisma.$queryRaw).toHaveBeenCalled();
  });

  test('returns profile by id or null', async () => {
    (crdPrisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([
        { case_worker_id: 'id-2', first_name: 'Alex', last_name: 'P', email_id: 'alex@example.com', region_id: 2 },
      ])
      .mockResolvedValueOnce([]);

    const found = await caseWorkerProfileRepository.getById('id-2');
    const missing = await caseWorkerProfileRepository.getById('missing');

    expect(found?.case_worker_id).toBe('id-2');
    expect(missing).toBeNull();
  });
});
