import { Request, Response, Router } from 'express';

import { validateFilters } from '../../../../main/modules/analytics/shared/filters';
import { getAjaxPartialTemplate, isAjaxRequest } from '../../../../main/modules/analytics/shared/partials';
import { parseUserOverviewSort } from '../../../../main/modules/analytics/shared/userOverviewSort';
import { userOverviewController } from '../../../../main/modules/analytics/userOverview/controller';
import { buildUserOverviewPage } from '../../../../main/modules/analytics/userOverview/page';
import { parseAssignedPage, parseCompletedPage } from '../../../../main/modules/analytics/userOverview/pagination';

jest.mock('../../../../main/modules/analytics/shared/filters', () => ({
  validateFilters: jest.fn(),
}));

jest.mock('../../../../main/modules/analytics/shared/userOverviewSort', () => ({
  parseUserOverviewSort: jest.fn(),
}));

jest.mock('../../../../main/modules/analytics/shared/partials', () => ({
  getAjaxPartialTemplate: jest.fn(),
  isAjaxRequest: jest.fn(),
}));

jest.mock('../../../../main/modules/analytics/userOverview/page', () => ({
  buildUserOverviewPage: jest.fn(),
}));

jest.mock('../../../../main/modules/analytics/userOverview/pagination', () => ({
  parseAssignedPage: jest.fn(),
  parseCompletedPage: jest.fn(),
}));

describe('userOverviewController', () => {
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
    const req = { method: 'GET', query: { user: 'user-1' }, get: jest.fn() } as unknown as Request;
    const res = { render } as unknown as Response;

    (validateFilters as jest.Mock).mockReturnValue({ filters: { user: ['user-1'] } });
    (parseUserOverviewSort as jest.Mock).mockReturnValue({
      assigned: { by: 'createdDate', dir: 'desc' },
      completed: { by: 'completedDate', dir: 'desc' },
    });
    (parseAssignedPage as jest.Mock).mockReturnValue(1);
    (parseCompletedPage as jest.Mock).mockReturnValue(1);
    (buildUserOverviewPage as jest.Mock).mockResolvedValue({ view: 'users' });
    (isAjaxRequest as jest.Mock).mockReturnValue(false);

    userOverviewController.registerUserOverviewRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/users', expect.any(Function));
    expect(router.post).toHaveBeenCalledWith('/users', expect.any(Function));

    const handler = (router.get as jest.Mock).mock.calls[0][1];
    await handler(req, res);

    expect(validateFilters).toHaveBeenCalledWith(req.query);
    expect(parseUserOverviewSort).toHaveBeenCalledWith(req.query);
    expect(buildUserOverviewPage).toHaveBeenCalledWith(
      { user: ['user-1'] },
      {
        assigned: { by: 'createdDate', dir: 'desc' },
        completed: { by: 'completedDate', dir: 'desc' },
      },
      1,
      1
    );
    expect(getAjaxPartialTemplate).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith('analytics/user-overview/index', { view: 'users' });
  });

  test('handles POST requests with body payloads', async () => {
    const router = buildRouter();
    const render = jest.fn();
    const req = { method: 'POST', body: { service: 'Crime' }, get: jest.fn() } as unknown as Request;
    const res = { render } as unknown as Response;

    (validateFilters as jest.Mock).mockReturnValue({ filters: { service: ['Crime'] } });
    (parseUserOverviewSort as jest.Mock).mockReturnValue({
      assigned: { by: 'createdDate', dir: 'desc' },
      completed: { by: 'completedDate', dir: 'desc' },
    });
    (parseAssignedPage as jest.Mock).mockReturnValue(2);
    (parseCompletedPage as jest.Mock).mockReturnValue(3);
    (buildUserOverviewPage as jest.Mock).mockResolvedValue({ view: 'users-post' });
    (isAjaxRequest as jest.Mock).mockReturnValue(false);

    userOverviewController.registerUserOverviewRoutes(router);

    const handler = (router.post as jest.Mock).mock.calls[0][1];
    await handler(req, res);

    expect(validateFilters).toHaveBeenCalledWith(req.body);
    expect(parseUserOverviewSort).toHaveBeenCalledWith(req.body);
    expect(buildUserOverviewPage).toHaveBeenCalledWith(
      { service: ['Crime'] },
      {
        assigned: { by: 'createdDate', dir: 'desc' },
        completed: { by: 'completedDate', dir: 'desc' },
      },
      2,
      3
    );
    expect(getAjaxPartialTemplate).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith('analytics/user-overview/index', { view: 'users-post' });
  });

  test('renders assigned partial for ajax sort requests', async () => {
    const router = buildRouter();
    const render = jest.fn();
    const req = {
      method: 'POST',
      body: { user: 'user-1', ajaxSection: 'assigned' },
      get: jest.fn().mockReturnValue('fetch'),
    } as unknown as Request;
    const res = { render } as unknown as Response;

    (validateFilters as jest.Mock).mockReturnValue({ filters: { user: ['user-1'] } });
    (parseUserOverviewSort as jest.Mock).mockReturnValue({
      assigned: { by: 'createdDate', dir: 'desc' },
      completed: { by: 'completedDate', dir: 'desc' },
    });
    (parseAssignedPage as jest.Mock).mockReturnValue(2);
    (parseCompletedPage as jest.Mock).mockReturnValue(1);
    (buildUserOverviewPage as jest.Mock).mockResolvedValue({ view: 'users-ajax' });
    (isAjaxRequest as jest.Mock).mockReturnValue(true);
    (getAjaxPartialTemplate as jest.Mock).mockReturnValue('analytics/user-overview/partials/assigned-tasks');

    userOverviewController.registerUserOverviewRoutes(router);

    const handler = (router.post as jest.Mock).mock.calls[0][1];
    await handler(req, res);

    expect(buildUserOverviewPage).toHaveBeenCalledWith(
      { user: ['user-1'] },
      {
        assigned: { by: 'createdDate', dir: 'desc' },
        completed: { by: 'completedDate', dir: 'desc' },
      },
      2,
      1
    );
    expect(getAjaxPartialTemplate).toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith('analytics/user-overview/partials/assigned-tasks', { view: 'users-ajax' });
  });

  test('falls back to full page when ajax template is missing', async () => {
    const router = buildRouter();
    const render = jest.fn();
    const req = {
      method: 'POST',
      body: { ajaxSection: 'assigned' },
      get: jest.fn().mockReturnValue('fetch'),
    } as unknown as Request;
    const res = { render } as unknown as Response;

    (validateFilters as jest.Mock).mockReturnValue({ filters: {} });
    (parseUserOverviewSort as jest.Mock).mockReturnValue({
      assigned: { by: 'createdDate', dir: 'desc' },
      completed: { by: 'completedDate', dir: 'desc' },
    });
    (parseAssignedPage as jest.Mock).mockReturnValue(1);
    (parseCompletedPage as jest.Mock).mockReturnValue(1);
    (buildUserOverviewPage as jest.Mock).mockResolvedValue({ view: 'users-fallback' });
    (isAjaxRequest as jest.Mock).mockReturnValue(true);
    (getAjaxPartialTemplate as jest.Mock).mockReturnValue(undefined);

    userOverviewController.registerUserOverviewRoutes(router);

    const handler = (router.post as jest.Mock).mock.calls[0][1];
    await handler(req, res);

    expect(render).toHaveBeenCalledWith('analytics/user-overview/index', { view: 'users-fallback' });
  });
});
