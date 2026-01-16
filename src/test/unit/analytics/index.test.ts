import csurf from 'csurf';
import { Request, Response, Router } from 'express';

import { createAnalyticsRouter } from '../../../main/modules/analytics';
import { completedController } from '../../../main/modules/analytics/completed/controller';
import { outstandingController } from '../../../main/modules/analytics/outstanding/controller';
import { overviewController } from '../../../main/modules/analytics/overview/controller';
import { userOverviewController } from '../../../main/modules/analytics/userOverview/controller';

jest.mock('csurf', () => jest.fn(() => (req: { csrfToken: () => string }, res: unknown, next: () => void) => next()));

jest.mock('../../../main/modules/analytics/overview/controller', () => ({
  overviewController: { registerOverviewRoutes: jest.fn() },
}));

jest.mock('../../../main/modules/analytics/outstanding/controller', () => ({
  outstandingController: { registerOutstandingRoutes: jest.fn() },
}));

jest.mock('../../../main/modules/analytics/completed/controller', () => ({
  completedController: { registerCompletedRoutes: jest.fn() },
}));

jest.mock('../../../main/modules/analytics/userOverview/controller', () => ({
  userOverviewController: { registerUserOverviewRoutes: jest.fn() },
}));

describe('createAnalyticsRouter', () => {
  type MiddlewareHandle = (req: Request, res: Response, next: () => void) => void;
  type RouterLayer = { route?: { path: string; stack: { handle: MiddlewareHandle }[] }; handle: MiddlewareHandle };

  test('registers middleware and sub-routes', () => {
    const router = createAnalyticsRouter();

    expect(csurf).toHaveBeenCalledWith({ cookie: true });
    expect(overviewController.registerOverviewRoutes).toHaveBeenCalledWith(router);
    expect(outstandingController.registerOutstandingRoutes).toHaveBeenCalledWith(router);
    expect(completedController.registerCompletedRoutes).toHaveBeenCalledWith(router);
    expect(userOverviewController.registerUserOverviewRoutes).toHaveBeenCalledWith(router);
  });

  test('sets csrf token and renders the analytics index', () => {
    const router = createAnalyticsRouter();
    const middlewareLayers = (router as Router & { stack: RouterLayer[] }).stack.filter(layer => !layer.route);
    const localsHandler = middlewareLayers[1].handle;
    const req = { csrfToken: jest.fn().mockReturnValue('token') } as unknown as Request;
    const res = { locals: {}, render: jest.fn() } as unknown as Response;

    localsHandler(req, res, jest.fn());

    expect(res.locals.csrfToken).toBe('token');

    const rootLayer = (router as Router & { stack: RouterLayer[] }).stack.find(layer => layer.route?.path === '/');
    expect(rootLayer).toBeDefined();

    rootLayer?.route?.stack[0].handle(req, res, jest.fn());

    expect(res.render).toHaveBeenCalledWith('analytics/index');
  });
});
