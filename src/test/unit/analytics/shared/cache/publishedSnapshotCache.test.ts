const publishedSnapshotGetMock = jest.fn();
const publishedSnapshotSetMock = jest.fn();
const publishedSnapshotConfigGetMock = jest.fn().mockReturnValue(15);
const publishedSnapshotNodeCacheMock = jest.fn().mockImplementation(() => ({
  get: publishedSnapshotGetMock,
  set: publishedSnapshotSetMock,
}));

jest.mock('config', () => ({
  get: publishedSnapshotConfigGetMock,
}));

jest.mock('node-cache', () => publishedSnapshotNodeCacheMock);

describe('publishedSnapshotCache', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const loadCacheModule = () => require('../../../../../main/modules/analytics/shared/cache/publishedSnapshotCache');

  test('initialises cache with configured TTL', () => {
    const { CacheKeys } = loadCacheModule();

    expect(publishedSnapshotConfigGetMock).toHaveBeenCalledWith('analytics.publishedSnapshotCacheTtlSeconds');
    expect(publishedSnapshotNodeCacheMock).toHaveBeenCalledWith({ stdTTL: 15 });
    expect(CacheKeys.currentPublishedSnapshot).toBe('current-published-snapshot');
  });

  test('getCache and setCache proxy to NodeCache', () => {
    const { getCache, setCache } = loadCacheModule();
    const snapshot = { snapshotId: 21, publishedAt: new Date('2026-03-14T18:55:00.000Z') };
    publishedSnapshotGetMock.mockReturnValue(snapshot);

    expect(getCache('key')).toEqual(snapshot);

    setCache('key', snapshot);
    expect(publishedSnapshotSetMock).toHaveBeenCalledWith('key', snapshot);
  });
});
