import { Request, Response, Router } from 'express';

import { validateFilters } from '../shared/filters';
import { getAjaxPartialTemplate, isAjaxRequest } from '../shared/partials';

import { buildOverviewPage } from './page';

class OverviewController {
  registerOverviewRoutes(router: Router): void {
    const handler = async (req: Request, res: Response) => {
      const source = (req.method === 'POST' ? req.body : req.query) as Record<string, unknown>;
      const { filters } = validateFilters(source);
      const ajaxSection = typeof source.ajaxSection === 'string' ? source.ajaxSection : undefined;
      const viewModel = await buildOverviewPage(filters, ajaxSection);
      if (isAjaxRequest(req)) {
        const template = getAjaxPartialTemplate({
          source,
          partials: {
            'overview-task-events': 'analytics/overview/partials/task-events-table',
            'overview-service-performance': 'analytics/overview/partials/service-performance-table',
          },
        });
        if (template) {
          return res.render(template, viewModel);
        }
      }
      res.render('analytics/overview/index', viewModel);
    };

    router.get('/overview', handler);
    router.post('/overview', handler);
  }
}

export const overviewController = new OverviewController();
