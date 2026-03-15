import { tmPrisma } from '../../../../../main/modules/analytics/shared/data/prisma';
import {
  parsePublishedAt,
  parseSnapshotId,
} from '../../../../../main/modules/analytics/shared/repositories/snapshotMetadataHelpers';
import { snapshotBatchesRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotBatchesRepository';
import { snapshotStateRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotStateRepository';

jest.mock('../../../../../main/modules/analytics/shared/data/prisma', () => ({
  tmPrisma: { $queryRaw: jest.fn() },
}));

describe('snapshot metadata repositories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('parses snapshot ids and timestamps', () => {
    expect(parseSnapshotId('12')).toBe(12);
    expect(parseSnapshotId(13n)).toBe(13);
    expect(parseSnapshotId(null)).toBeNull();
    expect(parsePublishedAt('2026-02-17T10:15:00.000Z')).toEqual(new Date('2026-02-17T10:15:00.000Z'));
    expect(parsePublishedAt(null)).toBeUndefined();
  });

  test('rejects invalid snapshot metadata values', () => {
    expect(() => parseSnapshotId('bad')).toThrow('Invalid published snapshot id');
    expect(() => parsePublishedAt('not-a-date')).toThrow('Invalid published_at timestamp');
  });

  test('fetchPublishedSnapshot returns null when no snapshot is published', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await expect(snapshotStateRepository.fetchPublishedSnapshot()).resolves.toBeNull();
  });

  test('fetchPublishedSnapshot returns parsed state values when published metadata exists', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { published_snapshot_id: '12', published_at: '2026-02-17T10:15:00.000Z' },
    ]);

    await expect(snapshotStateRepository.fetchPublishedSnapshot()).resolves.toEqual({
      snapshotId: 12,
      publishedAt: new Date('2026-02-17T10:15:00.000Z'),
    });
  });

  test('fetchPublishedSnapshot returns null when metadata is invalid or the query fails', async () => {
    (tmPrisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ published_snapshot_id: 'bad', published_at: '2026-02-17T10:15:00.000Z' }])
      .mockResolvedValueOnce([{ published_snapshot_id: '12', published_at: 'not-a-date' }])
      .mockRejectedValueOnce(new Error('relation does not exist'));

    await expect(snapshotStateRepository.fetchPublishedSnapshot()).resolves.toBeNull();
    await expect(snapshotStateRepository.fetchPublishedSnapshot()).resolves.toBeNull();
    await expect(snapshotStateRepository.fetchPublishedSnapshot()).resolves.toBeNull();
  });

  test('fetchPublishedSnapshot returns undefined publishedAt when the timestamp is missing', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ published_snapshot_id: '12', published_at: null }]);

    await expect(snapshotStateRepository.fetchPublishedSnapshot()).resolves.toEqual({
      snapshotId: 12,
      publishedAt: undefined,
    });
  });

  test('fetchSucceededSnapshotById returns null when the snapshot does not exist', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await expect(snapshotBatchesRepository.fetchSucceededSnapshotById(77)).resolves.toBeNull();
  });

  test('fetchSucceededSnapshotById returns the parsed snapshot id for succeeded snapshots', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ snapshot_id: '77' }]);

    await expect(snapshotBatchesRepository.fetchSucceededSnapshotById(77)).resolves.toEqual({
      snapshotId: 77,
    });
  });

  test('fetchSucceededSnapshotById returns null when metadata is invalid or the query fails', async () => {
    (tmPrisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ snapshot_id: 'bad' }])
      .mockRejectedValueOnce(new Error('query failed'));

    await expect(snapshotBatchesRepository.fetchSucceededSnapshotById(77)).resolves.toBeNull();
    await expect(snapshotBatchesRepository.fetchSucceededSnapshotById(77)).resolves.toBeNull();
  });
});
