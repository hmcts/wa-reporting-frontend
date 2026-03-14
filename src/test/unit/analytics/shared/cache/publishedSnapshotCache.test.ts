const getMock = jest.fn();
const setMock = jest.fn();
const configGetMock = jest.fn().mockReturnValue(15);
const nodeCacheMock = jest.fn().mockImplementation(() => ({
  get: getMock,
  set: setMock,
}));

jest.mock('config', () => ({
  get: configGetMock,
}));

jest.mock('node-cache', () => nodeCacheMock);

describe('publishedSnapshotCache', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const loadCacheModule = () => require('../../../../../main/modules/analytics/shared/cache/publishedSnapshotCache');

  test('initialises cache with configured TTL', () => {
    const { CacheKeys } = loadCacheModule();

    expect(configGetMock).toHaveBeenCalledWith('analytics.publishedSnapshotCacheTtlSeconds');
    expect(nodeCacheMock).toHaveBeenCalledWith({ stdTTL: 15 });
    expect(CacheKeys.currentPublishedSnapshot).toBe('current-published-snapshot');
  });

  test('getCache and setCache proxy to NodeCache', () => {
    const { getCache, setCache } = loadCacheModule();
    const snapshot = { snapshotId: 21, publishedAt: new Date('2026-03-14T18:55:00.000Z') };
    getMock.mockReturnValue(snapshot);

    expect(getCache('key')).toEqual(snapshot);

    setCache('key', snapshot);
    expect(setMock).toHaveBeenCalledWith('key', snapshot);
  });
});
