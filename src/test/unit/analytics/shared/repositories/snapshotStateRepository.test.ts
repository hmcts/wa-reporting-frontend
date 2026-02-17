import { tmPrisma } from '../../../../../main/modules/analytics/shared/data/prisma';
import { snapshotStateRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotStateRepository';

jest.mock('../../../../../main/modules/analytics/shared/data/prisma', () => ({
  tmPrisma: { $queryRaw: jest.fn() },
}));

describe('snapshotStateRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns null when no snapshot is published', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await expect(snapshotStateRepository.fetchPublishedSnapshot()).resolves.toBeNull();
  });

  test('returns parsed snapshot state when published values exist', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { published_snapshot_id: '12', published_at: '2026-02-17T10:15:00.000Z' },
    ]);

    await expect(snapshotStateRepository.fetchPublishedSnapshot()).resolves.toEqual({
      snapshotId: 12,
      publishedAt: new Date('2026-02-17T10:15:00.000Z'),
    });
  });

  test('throws when snapshot id is invalid', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { published_snapshot_id: 'bad', published_at: '2026-02-17T10:15:00.000Z' },
    ]);

    await expect(snapshotStateRepository.fetchPublishedSnapshot()).rejects.toThrow('Invalid published snapshot id');
  });

  test('fetchSnapshotById returns null when snapshot does not exist', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await expect(snapshotStateRepository.fetchSnapshotById(77)).resolves.toBeNull();
  });

  test('fetchSnapshotById returns parsed values for succeeded snapshot', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { published_snapshot_id: '77', published_at: '2026-02-17T11:00:00.000Z' },
    ]);

    await expect(snapshotStateRepository.fetchSnapshotById(77)).resolves.toEqual({
      snapshotId: 77,
      publishedAt: new Date('2026-02-17T11:00:00.000Z'),
    });
  });
});
