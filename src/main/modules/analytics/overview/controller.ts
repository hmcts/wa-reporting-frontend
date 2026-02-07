import { Request, Response, Router } from 'express';

import { BASE_FILTER_KEYS, applyFilterCookieFromConfig } from '../shared/filterCookies';
import { getAjaxPartialTemplate, isAjaxRequest } from '../shared/partials';
import { AnalyticsFilters } from '../shared/types';

import { buildOverviewPage } from './page';

class OverviewController {
  private readonly allowedFilterKeys: (keyof AnalyticsFilters)[] = [...BASE_FILTER_KEYS, 'eventsFrom', 'eventsTo'];
  private readonly partials = {
    'overview-task-events': 'analytics/overview/partials/task-events-table',
    'overview-service-performance': 'analytics/overview/partials/service-performance-table',
  };

  registerOverviewRoutes(router: Router): void {
    const handler = async (req: Request, res: Response) => {
      const source = (req.method === 'POST' ? req.body : req.query) as Record<string, unknown>;
      const filters = applyFilterCookieFromConfig({
        req,
        res,
        source,
        allowedKeys: this.allowedFilterKeys,
      });
      const ajaxSection = typeof source.ajaxSection === 'string' ? source.ajaxSection : undefined;
      const viewModel = await buildOverviewPage(filters, ajaxSection);
      if (isAjaxRequest(req)) {
        const template = getAjaxPartialTemplate({
          source,
          partials: this.partials,
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
