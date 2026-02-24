type WarmupTestOptions = {
  cronExpression?: string;
  cronExpressionValid?: boolean;
  warmupEnabled?: boolean;
};

type WarmupTestContext = {
  runAnalyticsCacheWarmup: () => Promise<void>;
  startAnalyticsCacheWarmup: () => void;
  stopAnalyticsCacheWarmup: () => void;
  getCronCallback: () => (() => void) | null;
  scheduleMock: jest.Mock;
  validateCronExpressionMock: jest.Mock;
  logger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };
  fetchPublishedSnapshot: jest.Mock;
  fetchRegions: jest.Mock;
  fetchCourtVenues: jest.Mock;
  fetchCaseWorkerProfiles: jest.Mock;
  fetchFilterOptions: jest.Mock;
  scheduledTask: {
    stop: jest.Mock;
    destroy: jest.Mock;
  };
};

const flushPromises = () => new Promise(resolve => setImmediate(resolve));

function loadCacheWarmupModule(options: WarmupTestOptions = {}): WarmupTestContext {
  const cronExpression = options.cronExpression ?? '*/15 * * * *';
  const cronExpressionValid = options.cronExpressionValid ?? true;
  const warmupEnabled = options.warmupEnabled ?? true;

  let cronCallback: (() => void) | null = null;

  const scheduleMock = jest.fn((expression: string, callback: () => void) => {
    cronCallback = callback;
    return scheduledTask;
  });
  const validateCronExpressionMock = jest.fn().mockReturnValue(cronExpressionValid);
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const scheduledTask = {
    stop: jest.fn(),
    destroy: jest.fn(),
  };

  const fetchPublishedSnapshot = jest.fn().mockResolvedValue({ snapshotId: 7 });
  const fetchRegions = jest.fn().mockResolvedValue([]);
  const fetchCourtVenues = jest.fn().mockResolvedValue([]);
  const fetchCaseWorkerProfiles = jest.fn().mockResolvedValue([]);
  const fetchFilterOptions = jest.fn().mockResolvedValue({
    services: [],
    roleCategories: [],
    regions: [],
    locations: [],
    taskNames: [],
    workTypes: [],
    users: [],
  });

  jest.doMock('config', () => ({
    get: jest.fn((key: string) => {
      if (key === 'analytics.cacheWarmupEnabled') {
        return warmupEnabled;
      }
      if (key === 'analytics.cacheWarmupSchedule') {
        return cronExpression;
      }
      return undefined;
    }),
  }));

  jest.doMock('node-cron', () => ({
    schedule: scheduleMock,
    validate: validateCronExpressionMock,
  }));

  jest.doMock('../../../../../main/modules/logging', () => ({
    Logger: {
      getLogger: jest.fn(() => logger),
    },
  }));

  jest.doMock('../../../../../main/modules/analytics/shared/repositories', () => ({
    snapshotStateRepository: {
      fetchPublishedSnapshot,
    },
  }));

  jest.doMock('../../../../../main/modules/analytics/shared/services', () => ({
    regionService: {
      fetchRegions,
    },
    courtVenueService: {
      fetchCourtVenues,
    },
    caseWorkerProfileService: {
      fetchCaseWorkerProfiles,
    },
    filterService: {
      fetchFilterOptions,
    },
  }));

  let runAnalyticsCacheWarmup!: () => Promise<void>;
  let startAnalyticsCacheWarmup!: () => void;
  let stopAnalyticsCacheWarmup!: () => void;

  jest.isolateModules(() => {
    const cacheWarmupModule = require('../../../../../main/modules/analytics/shared/cache/cacheWarmup');
    runAnalyticsCacheWarmup = cacheWarmupModule.runAnalyticsCacheWarmup;
    startAnalyticsCacheWarmup = cacheWarmupModule.startAnalyticsCacheWarmup;
    stopAnalyticsCacheWarmup = cacheWarmupModule.stopAnalyticsCacheWarmup;
  });

  return {
    runAnalyticsCacheWarmup,
    startAnalyticsCacheWarmup,
    stopAnalyticsCacheWarmup,
    getCronCallback: () => cronCallback,
    scheduleMock,
    validateCronExpressionMock,
    logger,
    fetchPublishedSnapshot,
    fetchRegions,
    fetchCourtVenues,
    fetchCaseWorkerProfiles,
    fetchFilterOptions,
    scheduledTask,
  };
}

describe('analytics cache warm-up', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('warms reference caches and skips filter warm-up when no published snapshot exists', async () => {
    const context = loadCacheWarmupModule();
    context.fetchPublishedSnapshot.mockResolvedValue(null);

    await context.runAnalyticsCacheWarmup();

    expect(context.fetchRegions).toHaveBeenCalledTimes(1);
    expect(context.fetchCourtVenues).toHaveBeenCalledTimes(1);
    expect(context.fetchCaseWorkerProfiles).toHaveBeenCalledTimes(1);
    expect(context.fetchFilterOptions).not.toHaveBeenCalled();
    expect(context.logger.info).toHaveBeenCalledWith('analytics cache warm-up completed without published snapshot');
  });

  test('warms both filter cache variants when a snapshot is published', async () => {
    const context = loadCacheWarmupModule();
    context.fetchPublishedSnapshot.mockResolvedValue({ snapshotId: 99 });

    await context.runAnalyticsCacheWarmup();

    expect(context.fetchFilterOptions).toHaveBeenNthCalledWith(1, 99);
    expect(context.fetchFilterOptions).toHaveBeenNthCalledWith(2, 99, { excludeRoleCategories: ['Judicial'] });
    expect(context.logger.info).toHaveBeenCalledWith('analytics cache warm-up completed', {
      snapshotId: 99,
      warmedFilterVariants: 2,
    });
  });

  test('logs warm-up errors without throwing', async () => {
    const context = loadCacheWarmupModule();
    const failure = new Error('reference-db-failed');
    context.fetchRegions.mockRejectedValue(failure);

    await expect(context.runAnalyticsCacheWarmup()).resolves.toBeUndefined();

    expect(context.logger.error).toHaveBeenCalledWith('analytics cache warm-up failed', failure);
  });

  test('starts scheduler once and triggers startup warm-up immediately', async () => {
    const context = loadCacheWarmupModule();

    context.startAnalyticsCacheWarmup();
    context.startAnalyticsCacheWarmup();
    await flushPromises();

    expect(context.validateCronExpressionMock).toHaveBeenCalledWith('*/15 * * * *');
    expect(context.scheduleMock).toHaveBeenCalledTimes(1);
    expect(context.scheduleMock).toHaveBeenCalledWith('*/15 * * * *', expect.any(Function));
    expect(context.fetchRegions).toHaveBeenCalledTimes(1);
  });

  test('skips overlapping runs while a previous warm-up is still in flight', async () => {
    const context = loadCacheWarmupModule();
    let resolveRegionsFetch: ((value?: void | PromiseLike<void>) => void) | undefined;
    context.fetchRegions.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveRegionsFetch = resolve;
        })
    );

    context.startAnalyticsCacheWarmup();
    const cronCallback = context.getCronCallback();
    expect(cronCallback).not.toBeNull();

    cronCallback?.();

    expect(context.logger.warn).toHaveBeenCalledWith(
      'analytics cache warm-up skipped because previous run is still in progress',
      { source: 'cron' }
    );

    resolveRegionsFetch?.();
    await flushPromises();
  });

  test('stops and destroys scheduled cron task', async () => {
    const context = loadCacheWarmupModule();

    context.startAnalyticsCacheWarmup();
    await flushPromises();
    context.stopAnalyticsCacheWarmup();
    context.stopAnalyticsCacheWarmup();

    expect(context.scheduledTask.stop).toHaveBeenCalledTimes(1);
    expect(context.scheduledTask.destroy).toHaveBeenCalledTimes(1);
  });

  test('does not start scheduler when disabled', () => {
    const context = loadCacheWarmupModule({ warmupEnabled: false });

    context.startAnalyticsCacheWarmup();

    expect(context.scheduleMock).not.toHaveBeenCalled();
    expect(context.logger.info).toHaveBeenCalledWith('analytics cache warm-up scheduler disabled by configuration');
  });

  test('does not start scheduler with invalid cron expression', () => {
    const context = loadCacheWarmupModule({ cronExpression: 'not-a-cron', cronExpressionValid: false });

    context.startAnalyticsCacheWarmup();

    expect(context.scheduleMock).not.toHaveBeenCalled();
    expect(context.logger.error).toHaveBeenCalledWith(
      'analytics cache warm-up scheduler not started because cron expression is invalid',
      { cronExpression: 'not-a-cron' }
    );
  });
});
