import * as path from 'path';
import { constants as http } from 'node:http2';

import config = require('config');
import type { Express, NextFunction, Request, Response } from 'express';

import { HTTPError } from './HttpError';

const env = process.env.NODE_ENV || 'development';
const developmentMode = env === 'development';
const authEnabled: boolean = config.get('auth.enabled') ?? true;
const compressionEnabled: boolean = config.get('compression.enabled') ?? false;

const bodyParser = require('body-parser');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const express = require('express') as typeof import('express');
const RateLimit = require('express-rate-limit');
const { glob } = require('glob');
const { Logger } = require('./modules/logging');
const { Helmet } = require('./modules/helmet');
const { Nunjucks } = require('./modules/nunjucks');
const { OidcMiddleware } = require('./modules/oidc');
const { PropertiesVolume } = require('./modules/properties-volume');
const { AppSession } = require('./modules/session');
const { startAnalyticsCacheWarmup, stopAnalyticsCacheWarmup } = require('./modules/analytics/shared/cache/cacheWarmup');
const healthRoutes = require('./routes/health').default;
const infoRoutes = require('./routes/info').default;
const { setupDev } = require('./development');

const limiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per windowMs
});

export const app = express();
app.locals.ENV = env;
app.set('trust proxy', 1);

const logger = Logger.getLogger('app');
let cacheWarmupLifecycleEnabled = false;

type RouteModule = { default?: (app: Express) => void };

function enableCacheWarmupLifecycle(): void {
  if (cacheWarmupLifecycleEnabled) {
    return;
  }

  startAnalyticsCacheWarmup();
  (app as unknown as { on: (event: string, listener: () => void) => void }).on('shutdown', () => {
    stopAnalyticsCacheWarmup();
    cacheWarmupLifecycleEnabled = false;
  });
  cacheWarmupLifecycleEnabled = true;
}

export const bootstrap = async (): Promise<void> => {
  new PropertiesVolume().enableFor(app);
  new Nunjucks(developmentMode).enableFor(app);
  // secure the application by adding various HTTP headers to its responses
  new Helmet(config.get('security')).enableFor(app);

  const assetsDirectory = path.join(__dirname, 'public', 'assets');
  const faviconPath = path.join(assetsDirectory, 'images/favicon.ico');

  app.get('/favicon.ico', limiter, (req, res) => {
    res.sendFile(faviconPath);
  });

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(cookieParser(config.get('secrets.wa.session-secret')));
  if (compressionEnabled) {
    app.use(compression());
  }
  app.use(express.static(path.join(__dirname, 'public')));
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate, no-store');
    next();
  });

  healthRoutes(app);
  infoRoutes(app);

  new AppSession().enableFor(app);
  if (authEnabled) {
    new OidcMiddleware().enableFor(app);
  }

  const routeFiles: string[] = await glob(path.join(__dirname, 'routes/**/*.+(ts|js)'));
  routeFiles
    .filter((filename: string) => !['health', 'info'].includes(path.basename(filename, path.extname(filename))))
    .map((filename: string) => require(filename) as RouteModule)
    .forEach((route: RouteModule) => route.default?.(app));

  enableCacheWarmupLifecycle();
  setupDev(app, developmentMode);
  // returning "not found" page for requests with paths not resolved by the router
  app.use((req, res) => {
    res.status(404);
    res.render('not-found');
  });

  // error handler
  app.use((err: HTTPError, req: Request, res: Response, _next: NextFunction) => {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = env === 'development' ? err : {};
    const status = err.status || 500;
    const summaries = {
      [http.HTTP_STATUS_UNAUTHORIZED]: {
        title: 'Sorry, access to this resource requires authorisation',
        suggestions: [
          'Please ensure you have logged into the service.',
          'Contact a system administrator if you continue to receive this error after signing in.',
        ],
        signOutUrl: '/logout',
      },
      [http.HTTP_STATUS_FORBIDDEN]: {
        title: 'Sorry, access to this resource is forbidden',
        suggestions: [
          'Please ensure you have the correct permissions to access this resource.',
          'Contact a system administrator if you should have access to this resource.',
        ],
        signOutUrl: '/logout',
      },
      default: {
        title: 'Sorry, there is a problem with the service',
        suggestions: ['Please try again later.'],
      },
    };

    if (![http.HTTP_STATUS_UNAUTHORIZED, http.HTTP_STATUS_FORBIDDEN].includes(status)) {
      logger.error(`${err.stack || err}`);
    }

    res.status(status);
    const summary = summaries[status] ?? summaries.default;
    res.render('error', summary);
  });
};

export const bootstrapPromise = bootstrap();

bootstrapPromise.catch(err => {
  logger.error('Failed to bootstrap app:', err);
  process.exit(1);
});
