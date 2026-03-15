import { Server } from 'http';

type RouteTestServer = {
  server: Server;
  close: () => Promise<void>;
};

type RouteAnalyticsMocks = {
  completedByNameRows?: unknown[];
  userOverviewAssignedSummaryRows?: unknown[];
  userOverviewAssignedTaskRows?: unknown[];
  userOverviewCompletedTaskRows?: unknown[];
  userOverviewCompletedSummaryRows?: unknown[];
  userOverviewAssignedTaskCount?: number;
  outstandingCriticalTaskRows?: unknown[];
  outstandingCriticalTaskCount?: number;
};

type RouteTestConfig = {
  authEnabled?: boolean;
  compressionEnabled?: boolean;
  analyticsMocks?: RouteAnalyticsMocks;
};

function setRouteTestConfig({ authEnabled = false, compressionEnabled = false }: RouteTestConfig): void {
  process.env.AUTH_ENABLED = authEnabled ? 'true' : 'false';
  process.env.COMPRESSION_ENABLED = compressionEnabled ? 'true' : 'false';
  process.env.NODE_CONFIG = JSON.stringify({
    auth: { enabled: authEnabled },
    compression: { enabled: compressionEnabled },
    useCSRFProtection: true,
  });

  const globalState = globalThis as unknown as {
    __setRouteTestConfigValues?: (next: Record<string, unknown>) => void;
  };
  globalState.__setRouteTestConfigValues?.({
    'auth.enabled': authEnabled,
    'compression.enabled': compressionEnabled,
  });
}

function mockOidcMiddleware(): void {
  jest.doMock('../../main/modules/oidc', () => {
    const { HTTPError } = require('../../main/HttpError');
    return {
      OidcMiddleware: class {
        enableFor(app: { use: (handler: (req: unknown, res: unknown, next: (err?: Error) => void) => void) => void }) {
          app.use((_req, _res, next) => next(new HTTPError('Forbidden', 403)));
        }
      },
    };
  });
}

function mockAnalyticsRepositories(analyticsMocks: RouteAnalyticsMocks = {}): void {
  const completedByNameRows = analyticsMocks.completedByNameRows ?? [];
  const userOverviewAssignedSummaryRows = analyticsMocks.userOverviewAssignedSummaryRows ?? [];
  const userOverviewAssignedTaskRows = analyticsMocks.userOverviewAssignedTaskRows ?? [];
  const userOverviewCompletedTaskRows = analyticsMocks.userOverviewCompletedTaskRows ?? [];
  const userOverviewCompletedSummaryRows = analyticsMocks.userOverviewCompletedSummaryRows ?? [];
  const userOverviewAssignedTaskCount = analyticsMocks.userOverviewAssignedTaskCount ?? 0;
  const outstandingCriticalTaskRows = analyticsMocks.outstandingCriticalTaskRows ?? [];
  const outstandingCriticalTaskCount = analyticsMocks.outstandingCriticalTaskCount ?? 0;

  jest.doMock('../../main/modules/analytics/shared/repositories', () => ({
    snapshotOpenDueDailyFactsRepository: {
      fetchServiceOverviewRows: jest.fn().mockResolvedValue([]),
      fetchOpenTasksByNameRows: jest.fn().mockResolvedValue([]),
      fetchOpenTasksByRegionLocationRows: jest.fn().mockResolvedValue([]),
      fetchOpenTasksSummaryRows: jest.fn().mockResolvedValue([]),
      fetchTasksDuePriorityRows: jest.fn().mockResolvedValue([]),
      fetchAssignedSummaryRows: jest.fn().mockResolvedValue(userOverviewAssignedSummaryRows),
    },
    snapshotTaskEventDailyFactsRepository: {
      fetchTaskEventsByServiceRows: jest.fn().mockResolvedValue([]),
    },
    snapshotOutstandingCreatedAssignmentDailyFactsRepository: {
      fetchOpenTasksCreatedByAssignmentRows: jest.fn().mockResolvedValue([]),
    },
    snapshotOutstandingDueStatusDailyFactsRepository: {
      fetchTasksDueByDateRows: jest.fn().mockResolvedValue([]),
    },
    snapshotCompletedDashboardFactsRepository: {
      fetchCompletedSummaryRows: jest.fn().mockResolvedValue([]),
      fetchCompletedTimelineRows: jest.fn().mockResolvedValue([]),
      fetchCompletedProcessingHandlingTimeRows: jest.fn().mockResolvedValue([]),
      fetchCompletedByNameRows: jest.fn().mockResolvedValue(completedByNameRows),
      fetchCompletedRegionLocationRows: jest.fn().mockResolvedValue([]),
    },
    snapshotOpenTaskRowsRepository: {
      fetchUserOverviewAssignedTaskRows: jest.fn().mockResolvedValue(userOverviewAssignedTaskRows),
      fetchUserOverviewAssignedTaskCount: jest.fn().mockResolvedValue(userOverviewAssignedTaskCount),
      fetchAssignedSummaryRows: jest.fn().mockResolvedValue(userOverviewAssignedSummaryRows),
      fetchOutstandingCriticalTaskRows: jest.fn().mockResolvedValue(outstandingCriticalTaskRows),
    },
    snapshotCompletedTaskRowsRepository: {
      fetchUserOverviewCompletedTaskRows: jest.fn().mockResolvedValue(userOverviewCompletedTaskRows),
      fetchCompletedTaskAuditRows: jest.fn().mockResolvedValue([]),
    },
    snapshotUserCompletedFactsRepository: {
      fetchUserOverviewCompletedSummaryRows: jest.fn().mockResolvedValue(userOverviewCompletedSummaryRows),
      fetchUserOverviewCompletedByDateRows: jest.fn().mockResolvedValue([]),
      fetchUserOverviewCompletedByTaskNameRows: jest.fn().mockResolvedValue([]),
    },
    snapshotWaitTimeByAssignedDateRepository: {
      fetchWaitTimeByAssignedDateRows: jest.fn().mockResolvedValue([]),
    },
    snapshotOverviewFilterFactsRepository: {
      fetchFilterOptionsRows: jest.fn().mockResolvedValue({
        services: [],
        roleCategories: [],
        regions: [],
        locations: [],
        taskNames: [],
        workTypes: [],
        assignees: [],
      }),
    },
    snapshotOutstandingFilterFactsRepository: {
      fetchFilterOptionsRows: jest.fn().mockResolvedValue({
        services: [],
        roleCategories: [],
        regions: [],
        locations: [],
        taskNames: [],
        workTypes: [],
        assignees: [],
      }),
      fetchCriticalTaskCount: jest.fn().mockResolvedValue(outstandingCriticalTaskCount),
    },
    snapshotCompletedFilterFactsRepository: {
      fetchFilterOptionsRows: jest.fn().mockResolvedValue({
        services: [],
        roleCategories: [],
        regions: [],
        locations: [],
        taskNames: [],
        workTypes: [],
        assignees: [],
      }),
    },
    snapshotUserFilterFactsRepository: {
      fetchFilterOptionsRows: jest.fn().mockResolvedValue({
        services: [],
        roleCategories: [],
        regions: [],
        locations: [],
        taskNames: [],
        workTypes: [],
        assignees: [],
      }),
    },
    snapshotStateRepository: {
      fetchPublishedSnapshot: jest.fn().mockResolvedValue({
        snapshotId: 1,
        publishedAt: new Date('2026-02-17T10:15:00.000Z'),
      }),
    },
    snapshotBatchesRepository: {
      fetchSucceededSnapshotById: jest
        .fn()
        .mockImplementation(async (snapshotId: number) => (snapshotId === 1 ? { snapshotId } : null)),
    },
    regionRepository: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
    },
    courtVenueRepository: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
    },
    caseWorkerProfileRepository: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
    },
  }));
}

export async function buildRouteTestServer(config: RouteTestConfig = {}): Promise<RouteTestServer> {
  jest.clearAllMocks();

  setRouteTestConfig(config);
  mockOidcMiddleware();
  mockAnalyticsRepositories(config.analyticsMocks);

  let app!: { listen: (port: number, host: string) => Server };
  let bootstrapPromise: Promise<void> | undefined;
  jest.isolateModules(() => {
    const appModule = require('../../main/app') as {
      app: { listen: (port: number, host: string) => Server };
      bootstrapPromise?: Promise<void>;
    };
    app = appModule.app;
    bootstrapPromise = appModule.bootstrapPromise;
  });
  await bootstrapPromise;
  const server: Server = app.listen(0, '127.0.0.1');
  if (!server.listening) {
    await new Promise<void>(resolve => {
      server.once('listening', () => resolve());
    });
  }

  return {
    server,
    close: () =>
      new Promise<void>((resolve, reject) => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close(error => {
          if (!error || (error as NodeJS.ErrnoException).code === 'ERR_SERVER_NOT_RUNNING') {
            resolve();
            return;
          }
          reject(error);
        });
      }),
  };
}

export function extractCsrfToken(html: string): string {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  if (!match) {
    throw new Error('CSRF token not found in response HTML');
  }
  return match[1];
}

export function getFilterCookieName(): string {
  const config = require('config');
  return config.get('analytics.filtersCookieName');
}
