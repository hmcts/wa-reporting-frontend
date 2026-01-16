const getMock = jest.fn();
const setMock = jest.fn();
const nodeCacheMock = jest.fn().mockImplementation(() => ({
  get: getMock,
  set: setMock,
}));

jest.mock('config', () => ({
  get: jest.fn().mockReturnValue(60),
}));

jest.mock('node-cache', () => nodeCacheMock);

describe('analytics cache', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const loadCacheModule = () => require('../../../../../main/modules/analytics/shared/cache/cache');

  test('initialises cache with configured TTL', () => {
    const { CacheKeys } = loadCacheModule();

    expect(nodeCacheMock).toHaveBeenCalledWith({ stdTTL: 60 });
    expect(CacheKeys.filterOptions).toBe('filter-options');
    expect(CacheKeys.caseWorkerProfileNames).toBe('case-worker-profile-names');
  });

  test('getCache and setCache proxy to NodeCache', () => {
    const { getCache, setCache } = loadCacheModule();
    getMock.mockReturnValue('cached');

    expect(getCache('key')).toBe('cached');

    setCache('key', { value: 1 });
    expect(setMock).toHaveBeenCalledWith('key', { value: 1 });
  });
});
