const nodeCacheMock = jest.fn();
const configGetMock = jest.fn().mockImplementation((key: string) => {
  if (key === 'analytics.publishedSnapshotCacheTtlSeconds') {
    return 12;
  }
  throw new Error(`Unexpected config key: ${key}`);
});

type CacheEntry = {
  value: unknown;
  expiresAt?: number;
};

function createMockNodeCache(stdTTL: number) {
  const store = new Map<string, CacheEntry>();

  return {
    get: jest.fn((key: string) => {
      const entry = store.get(key);
      if (!entry) {
        return undefined;
      }

      if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }

      return entry.value;
    }),
    set: jest.fn((key: string, value: unknown) => {
      store.set(key, { value, expiresAt: Date.now() + stdTTL * 1000 });
      return true;
    }),
    del: jest.fn((key: string) => {
      const existed = store.delete(key);
      return existed ? 1 : 0;
    }),
  };
}

jest.mock('node-cache', () =>
  nodeCacheMock.mockImplementation(({ stdTTL }: { stdTTL: number }) => createMockNodeCache(stdTTL))
);
jest.mock('config', () => ({
  get: configGetMock,
}));

describe('publishedSnapshotCache', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-14T19:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const loadCacheModule = () => require('../../../../../main/modules/analytics/shared/cache/publishedSnapshotCache');

  test('initialises a dedicated NodeCache with the configured TTL', () => {
    const { PUBLISHED_SNAPSHOT_CACHE_TTL_SECONDS } = loadCacheModule();

    expect(PUBLISHED_SNAPSHOT_CACHE_TTL_SECONDS).toBe(12);
    expect(configGetMock).toHaveBeenCalledWith('analytics.publishedSnapshotCacheTtlSeconds');
    expect(nodeCacheMock).toHaveBeenCalledWith({ stdTTL: 12 });
  });

  test('returns a cached published snapshot before the TTL expires', () => {
    const { getCurrentPublishedSnapshotFromCache, setCurrentPublishedSnapshotInCache } = loadCacheModule();

    const snapshot = { snapshotId: 21, publishedAt: new Date('2026-03-14T18:55:00.000Z') };

    expect(getCurrentPublishedSnapshotFromCache()).toBeUndefined();

    setCurrentPublishedSnapshotInCache(snapshot);

    expect(getCurrentPublishedSnapshotFromCache()).toEqual(snapshot);

    jest.advanceTimersByTime(9_999);

    expect(getCurrentPublishedSnapshotFromCache()).toEqual(snapshot);
  });

  test('returns undefined after the configured TTL expires', () => {
    const { getCurrentPublishedSnapshotFromCache, setCurrentPublishedSnapshotInCache } = loadCacheModule();

    setCurrentPublishedSnapshotInCache({ snapshotId: 22, publishedAt: new Date('2026-03-14T18:56:00.000Z') });

    jest.advanceTimersByTime(12_001);

    expect(getCurrentPublishedSnapshotFromCache()).toBeUndefined();
  });

  test('clears the cached published snapshot explicitly', () => {
    const {
      clearCurrentPublishedSnapshotCache,
      getCurrentPublishedSnapshotFromCache,
      setCurrentPublishedSnapshotInCache,
    } = loadCacheModule();

    setCurrentPublishedSnapshotInCache({ snapshotId: 23, publishedAt: new Date('2026-03-14T18:57:00.000Z') });

    clearCurrentPublishedSnapshotCache();

    expect(getCurrentPublishedSnapshotFromCache()).toBeUndefined();
  });
});
