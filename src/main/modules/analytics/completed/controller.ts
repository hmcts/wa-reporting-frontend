import { Request, Response, Router } from 'express';

import { validateFilters } from '../shared/filters';
import { getAjaxPartialTemplate, isAjaxRequest } from '../shared/partials';
import { CompletedMetric } from '../shared/types';

import { buildCompletedPage } from './page';

function parseCaseId(source: Record<string, unknown>): string | undefined {
  if (typeof source.caseId !== 'string') {
    return undefined;
  }
  const trimmed = source.caseId.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseMetric(source: Record<string, unknown>): CompletedMetric {
  if (source.metric === 'processingTime') {
    return 'processingTime';
  }
  return 'handlingTime';
}

class CompletedController {
  registerCompletedRoutes(router: Router): void {
    const handler = async (req: Request, res: Response) => {
      const source = (req.method === 'POST' ? req.body : req.query) as Record<string, unknown>;
      const { filters } = validateFilters(source);
      const caseId = parseCaseId(source);
      const metric = parseMetric(source);
      const viewModel = await buildCompletedPage(filters, metric, caseId);

      if (isAjaxRequest(req)) {
        const template = getAjaxPartialTemplate({
          source,
          partials: {
            'completed-task-audit': 'analytics/completed/partials/task-audit',
            'completed-processing-handling-time': 'analytics/completed/partials/processing-handling-time',
          },
        });
        if (template) {
          return res.render(template, viewModel);
        }
      }
      res.render('analytics/completed/index', viewModel);
    };

    router.get('/completed', handler);
    router.post('/completed', handler);
  }
}

export const completedController = new CompletedController();
