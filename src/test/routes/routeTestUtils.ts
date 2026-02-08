import { Server } from 'http';

type RouteTestServer = {
  server: Server;
  close: () => Promise<void>;
};

type RouteTestConfig = {
  authEnabled?: boolean;
};

function setRouteTestConfig({ authEnabled = false }: RouteTestConfig): void {
  process.env.AUTH_ENABLED = authEnabled ? 'true' : 'false';
  process.env.NODE_CONFIG = JSON.stringify({
    auth: { enabled: authEnabled },
    useCSRFProtection: true,
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

function mockAnalyticsRepositories(): void {
  jest.doMock('../../main/modules/analytics/shared/repositories/taskFactsRepository', () => ({
    taskFactsRepository: {
      fetchServiceOverviewRows: jest.fn().mockResolvedValue([]),
      fetchTaskEventsByServiceRows: jest.fn().mockResolvedValue([]),
      fetchOverviewFilterOptionsRows: jest.fn().mockResolvedValue({
        services: [],
        roleCategories: [],
        regions: [],
        locations: [],
        taskNames: [],
        assignees: [],
      }),
      fetchOpenTasksCreatedByAssignmentRows: jest.fn().mockResolvedValue([]),
      fetchTasksDuePriorityRows: jest.fn().mockResolvedValue([]),
      fetchCompletedSummaryRows: jest.fn().mockResolvedValue([]),
      fetchCompletedTimelineRows: jest.fn().mockResolvedValue([]),
      fetchCompletedProcessingHandlingTimeRows: jest.fn().mockResolvedValue([]),
      fetchCompletedByNameRows: jest.fn().mockResolvedValue([]),
      fetchCompletedByLocationRows: jest.fn().mockResolvedValue([]),
      fetchCompletedByRegionRows: jest.fn().mockResolvedValue([]),
    },
  }));

  jest.doMock('../../main/modules/analytics/shared/repositories/taskThinRepository', () => ({
    taskThinRepository: {
      fetchUserOverviewAssignedTaskRows: jest.fn().mockResolvedValue([]),
      fetchUserOverviewCompletedTaskRows: jest.fn().mockResolvedValue([]),
      fetchUserOverviewAssignedTaskCount: jest.fn().mockResolvedValue(0),
      fetchUserOverviewCompletedTaskCount: jest.fn().mockResolvedValue(0),
      fetchUserOverviewCompletedByDateRows: jest.fn().mockResolvedValue([]),
      fetchUserOverviewCompletedByTaskNameRows: jest.fn().mockResolvedValue([]),
      fetchCompletedTaskAuditRows: jest.fn().mockResolvedValue([]),
      fetchOutstandingCriticalTaskRows: jest.fn().mockResolvedValue([]),
      fetchOutstandingCriticalTaskCount: jest.fn().mockResolvedValue(0),
      fetchOpenTasksByNameRows: jest.fn().mockResolvedValue([]),
      fetchOpenTasksByRegionLocationRows: jest.fn().mockResolvedValue([]),
      fetchOpenTasksSummaryRows: jest.fn().mockResolvedValue([]),
      fetchWaitTimeByAssignedDateRows: jest.fn().mockResolvedValue([]),
      fetchTasksDueByDateRows: jest.fn().mockResolvedValue([]),
      fetchAssigneeIds: jest.fn().mockResolvedValue([]),
    },
  }));

  jest.doMock('../../main/modules/analytics/shared/repositories/regionRepository', () => ({
    regionRepository: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
    },
  }));

  jest.doMock('../../main/modules/analytics/shared/repositories/courtVenueRepository', () => ({
    courtVenueRepository: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
    },
  }));

  jest.doMock('../../main/modules/analytics/shared/repositories/caseWorkerProfileRepository', () => ({
    caseWorkerProfileRepository: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
    },
  }));
}

export async function buildRouteTestServer(config: RouteTestConfig = {}): Promise<RouteTestServer> {
  jest.resetModules();
  jest.clearAllMocks();

  setRouteTestConfig(config);
  mockOidcMiddleware();
  mockAnalyticsRepositories();

  const { app } = require('../../main/app');
  const server: Server = app.listen(0, '127.0.0.1');

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
