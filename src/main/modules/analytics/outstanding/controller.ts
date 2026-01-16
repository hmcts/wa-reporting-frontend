import { Request, Response, Router } from 'express';

import { validateFilters } from '../shared/filters';
import { parseOutstandingSort } from '../shared/outstandingSort';
import { getAjaxPartialTemplate, isAjaxRequest } from '../shared/partials';

import { parseCriticalTasksPage } from './criticalTasksPagination';
import { buildOutstandingPage } from './page';

class OutstandingController {
  registerOutstandingRoutes(router: Router): void {
    const handler = async (req: Request, res: Response) => {
      const source = (req.method === 'POST' ? req.body : req.query) as Record<string, unknown>;
      const { filters } = validateFilters(source);
      const sort = parseOutstandingSort(source);
      const criticalTasksPage = parseCriticalTasksPage(source.criticalTasksPage);
      const viewModel = await buildOutstandingPage(filters, sort, criticalTasksPage);
      if (isAjaxRequest(req)) {
        const template = getAjaxPartialTemplate({
          source,
          partials: {
            criticalTasks: 'analytics/outstanding/partials/critical-tasks',
          },
        });
        if (template) {
          return res.render(template, viewModel);
        }
      }
      res.render('analytics/outstanding/index', viewModel);
    };

    router.get('/outstanding', handler);
    router.post('/outstanding', handler);
  }
}

export const outstandingController = new OutstandingController();
