import { Application } from 'express';

import { createAnalyticsRouter } from '../modules/analytics';

export default function (app: Application): void {
  app.use('/', createAnalyticsRouter());
}
