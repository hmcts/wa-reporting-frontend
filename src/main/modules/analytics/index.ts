import csurf from 'csurf';
import { Request, Response, Router } from 'express';

import { completedController } from './completed/controller';
import { outstandingController } from './outstanding/controller';
import { overviewController } from './overview/controller';
import { userOverviewController } from './userOverview/controller';

export function createAnalyticsRouter(): Router {
  const router = Router();
  const csrfProtection = csurf({ cookie: true });

  router.use(csrfProtection);
  router.use((req: Request, res: Response, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
  });

  router.get('/', (req: Request, res: Response) => {
    res.render('analytics/index');
  });

  overviewController.registerOverviewRoutes(router);
  outstandingController.registerOutstandingRoutes(router);
  completedController.registerCompletedRoutes(router);
  userOverviewController.registerUserOverviewRoutes(router);

  return router;
}
