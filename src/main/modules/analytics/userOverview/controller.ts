import { Request, Response, Router } from 'express';

import { validateFilters } from '../shared/filters';
import { getAjaxPartialTemplate, isAjaxRequest } from '../shared/partials';
import { parseUserOverviewSort } from '../shared/userOverviewSort';

import { buildUserOverviewPage } from './page';
import { parseAssignedPage, parseCompletedPage } from './pagination';

class UserOverviewController {
  private readonly partials = {
    assigned: 'analytics/user-overview/partials/assigned-tasks',
    completed: 'analytics/user-overview/partials/completed-tasks',
    'user-overview-assigned': 'analytics/user-overview/partials/assigned-tasks',
    'user-overview-completed': 'analytics/user-overview/partials/completed-tasks',
    'user-overview-completed-by-date': 'analytics/user-overview/partials/completed-by-date',
    'user-overview-completed-by-task-name': 'analytics/user-overview/partials/completed-by-task-name',
  };

  registerUserOverviewRoutes(router: Router): void {
    const handler = async (req: Request, res: Response) => {
      const source = (req.method === 'POST' ? req.body : req.query) as Record<string, unknown>;
      const { filters } = validateFilters(source);
      const sort = parseUserOverviewSort(source);

      const assignedPage = parseAssignedPage(source.assignedPage);
      const completedPage = parseCompletedPage(source.completedPage);
      const ajaxSection = typeof source.ajaxSection === 'string' ? source.ajaxSection : undefined;
      const viewModel = await buildUserOverviewPage(filters, sort, assignedPage, completedPage, ajaxSection);
      if (isAjaxRequest(req)) {
        const template = getAjaxPartialTemplate({
          source,
          partials: this.partials,
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
