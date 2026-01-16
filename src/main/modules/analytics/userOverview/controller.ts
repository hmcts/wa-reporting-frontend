import { Request, Response, Router } from 'express';

import { validateFilters } from '../shared/filters';
import { getAjaxPartialTemplate, isAjaxRequest } from '../shared/partials';
import { parseUserOverviewSort } from '../shared/userOverviewSort';

import { buildUserOverviewPage } from './page';
import { parseAssignedPage, parseCompletedPage } from './pagination';

class UserOverviewController {
  registerUserOverviewRoutes(router: Router): void {
    const handler = async (req: Request, res: Response) => {
      const source = (req.method === 'POST' ? req.body : req.query) as Record<string, unknown>;
      const { filters } = validateFilters(source);
      const sort = parseUserOverviewSort(source);

      const assignedPage = parseAssignedPage(source.assignedPage);
      const completedPage = parseCompletedPage(source.completedPage);
      const viewModel = await buildUserOverviewPage(filters, sort, assignedPage, completedPage);
      if (isAjaxRequest(req)) {
        const template = getAjaxPartialTemplate({
          source,
          partials: {
            assigned: 'analytics/user-overview/partials/assigned-tasks',
            completed: 'analytics/user-overview/partials/completed-tasks',
          },
        });
        if (template) {
          return res.render(template, viewModel);
        }
      }
      res.render('analytics/user-overview/index', viewModel);
    };

    router.get('/users', handler);
    router.post('/users', handler);
  }
}

export const userOverviewController = new UserOverviewController();
