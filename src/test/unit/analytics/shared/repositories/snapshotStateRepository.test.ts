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

  test('returns null when snapshot id is invalid', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { published_snapshot_id: 'bad', published_at: '2026-02-17T10:15:00.000Z' },
    ]);

    await expect(snapshotStateRepository.fetchPublishedSnapshot()).resolves.toBeNull();
  });

  test('returns parsed snapshot state when published timestamp is missing', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ published_snapshot_id: '12', published_at: null }]);

    await expect(snapshotStateRepository.fetchPublishedSnapshot()).resolves.toEqual({
      snapshotId: 12,
      publishedAt: undefined,
    });
  });

  test('returns null when fetchPublishedSnapshot query fails', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('relation does not exist'));

    await expect(snapshotStateRepository.fetchPublishedSnapshot()).resolves.toBeNull();
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

  test('fetchSnapshotById returns snapshot metadata when published timestamp is unavailable', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ published_snapshot_id: '77', published_at: null }]);

    await expect(snapshotStateRepository.fetchSnapshotById(77)).resolves.toEqual({
      snapshotId: 77,
      publishedAt: undefined,
    });
  });

  test('fetchSnapshotById returns null when query fails', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('query failed'));

    await expect(snapshotStateRepository.fetchSnapshotById(77)).resolves.toBeNull();
  });
});
