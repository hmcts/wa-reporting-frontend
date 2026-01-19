import { Request, Response, Router } from 'express';

import { completedController } from '../../../../main/modules/analytics/completed/controller';
import { buildCompletedPage } from '../../../../main/modules/analytics/completed/page';
import { validateFilters } from '../../../../main/modules/analytics/shared/filters';
import { getAjaxPartialTemplate, isAjaxRequest } from '../../../../main/modules/analytics/shared/partials';

jest.mock('../../../../main/modules/analytics/shared/filters', () => ({
  validateFilters: jest.fn(),
}));

jest.mock('../../../../main/modules/analytics/completed/page', () => ({
  buildCompletedPage: jest.fn(),
}));

jest.mock('../../../../main/modules/analytics/shared/partials', () => ({
  getAjaxPartialTemplate: jest.fn(),
  isAjaxRequest: jest.fn(),
}));

describe('completedController', () => {
  const buildRouter = () =>
    ({
      get: jest.fn(),
      post: jest.fn(),
    }) as unknown as Router;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('registers routes and handles GET requests', async () => {
    const router = buildRouter();
    const render = jest.fn();
    const req = { method: 'GET', query: { service: 'Civil' } } as unknown as Request;
    const res = { render } as unknown as Response;

    (validateFilters as jest.Mock).mockReturnValue({ filters: { service: ['Civil'] } });
    (buildCompletedPage as jest.Mock).mockResolvedValue({ view: 'completed' });
    (isAjaxRequest as jest.Mock).mockReturnValue(false);

    completedController.registerCompletedRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/completed', expect.any(Function));
    expect(router.post).toHaveBeenCalledWith('/completed', expect.any(Function));

    const handler = (router.get as jest.Mock).mock.calls[0][1];
    await handler(req, res);

    expect(validateFilters).toHaveBeenCalledWith(req.query);
    expect(buildCompletedPage).toHaveBeenCalledWith({ service: ['Civil'] }, 'handlingTime', undefined);
    expect(render).toHaveBeenCalledWith('analytics/completed/index', { view: 'completed' });
  });

  test('handles POST requests with body payloads', async () => {
    const router = buildRouter();
    const render = jest.fn();
    const req = { method: 'POST', body: { taskName: 'Review' } } as unknown as Request;
    const res = { render } as unknown as Response;

    (validateFilters as jest.Mock).mockReturnValue({ filters: { taskName: ['Review'] } });
    (buildCompletedPage as jest.Mock).mockResolvedValue({ view: 'completed-post' });
    (isAjaxRequest as jest.Mock).mockReturnValue(false);

    completedController.registerCompletedRoutes(router);

    const handler = (router.post as jest.Mock).mock.calls[0][1];
    await handler(req, res);

    expect(validateFilters).toHaveBeenCalledWith(req.body);
    expect(buildCompletedPage).toHaveBeenCalledWith({ taskName: ['Review'] }, 'handlingTime', undefined);
    expect(render).toHaveBeenCalledWith('analytics/completed/index', { view: 'completed-post' });
  });

  test('passes trimmed case ID to page builder', async () => {
    const router = buildRouter();
    const render = jest.fn();
    const req = {
      method: 'POST',
      body: { caseId: ' 1234567890 ' },
    } as unknown as Request;
    const res = { render } as unknown as Response;

    (validateFilters as jest.Mock).mockReturnValue({ filters: {} });
    (buildCompletedPage as jest.Mock).mockResolvedValue({ view: 'completed-case-id' });
    (isAjaxRequest as jest.Mock).mockReturnValue(false);

    completedController.registerCompletedRoutes(router);

    const handler = (router.post as jest.Mock).mock.calls[0][1];
    await handler(req, res);

    expect(buildCompletedPage).toHaveBeenCalledWith({}, 'handlingTime', '1234567890');
    expect(render).toHaveBeenCalledWith('analytics/completed/index', { view: 'completed-case-id' });
  });

  test('uses processing time metric when provided', async () => {
    const router = buildRouter();
    const render = jest.fn();
    const req = { method: 'GET', query: { metric: 'processingTime' } } as unknown as Request;
    const res = { render } as unknown as Response;

    (validateFilters as jest.Mock).mockReturnValue({ filters: {} });
    (buildCompletedPage as jest.Mock).mockResolvedValue({ view: 'completed-metric' });
    (isAjaxRequest as jest.Mock).mockReturnValue(false);

    completedController.registerCompletedRoutes(router);

    const handler = (router.get as jest.Mock).mock.calls[0][1];
    await handler(req, res);

    expect(buildCompletedPage).toHaveBeenCalledWith({}, 'processingTime', undefined);
    expect(render).toHaveBeenCalledWith('analytics/completed/index', { view: 'completed-metric' });
  });

  test('renders task audit partial for ajax requests', async () => {
    const router = buildRouter();
    const render = jest.fn();
    const req = {
      method: 'POST',
      body: { ajaxSection: 'completed-task-audit', caseId: '174' },
      get: jest.fn().mockReturnValue('fetch'),
    } as unknown as Request;
    const res = { render } as unknown as Response;

    (validateFilters as jest.Mock).mockReturnValue({ filters: { service: ['Crime'] } });
    (buildCompletedPage as jest.Mock).mockResolvedValue({ view: 'completed-ajax' });
    (isAjaxRequest as jest.Mock).mockReturnValue(true);
    (getAjaxPartialTemplate as jest.Mock).mockReturnValue('analytics/completed/partials/task-audit');

    completedController.registerCompletedRoutes(router);

    const handler = (router.post as jest.Mock).mock.calls[0][1];
    await handler(req, res);

    expect(getAjaxPartialTemplate).toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith('analytics/completed/partials/task-audit', { view: 'completed-ajax' });
  });
});
