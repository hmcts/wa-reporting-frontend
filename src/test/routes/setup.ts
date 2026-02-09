type RouteTestConfigValues = Record<string, unknown>;

type RouteTestGlobals = {
  __routeTestConfigValues: RouteTestConfigValues;
  __setRouteTestConfigValues: (next: RouteTestConfigValues) => void;
};

const globalState = globalThis as unknown as RouteTestGlobals;

const defaultValues: RouteTestConfigValues = {
  'auth.enabled': false,
  useCSRFProtection: true,
  'secrets.wa.csrf-cookie-secret': 'csrf-cookie-secret',
  'secrets.wa.session-secret': 'session-secret',
  'session.cookie.name': 'wa-reporting-frontend-session',
  'session.appCookie.name': 'wa-reporting-frontend-app',
  'secrets.wa.wa-reporting-redis-host': '',
  'secrets.wa.wa-reporting-redis-port': 6379,
  'secrets.wa.wa-reporting-redis-access-key': '',
  'analytics.filtersCookieName': 'wa-reporting-analytics-filters',
  'analytics.filtersCookieMaxAgeDays': 365,
  'analytics.manageCaseBaseUrl': 'https://manage-case.aat.platform.hmcts.net',
  'analytics.cacheTtlSeconds': 900,
  'govukFrontend.rebrandEnabled': true,
  security: {
    referrerPolicy: 'same-origin',
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  },
  logging: { prismaQueryTimings: false },
};

globalState.__routeTestConfigValues = { ...defaultValues };

globalState.__setRouteTestConfigValues = (next: RouteTestConfigValues) => {
  globalState.__routeTestConfigValues = { ...globalState.__routeTestConfigValues, ...next };
};

const get = (key: string): unknown => globalState.__routeTestConfigValues[key];
const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(globalState.__routeTestConfigValues, key);

jest.mock('config', () => ({ get, has }));

process.env.AUTH_ENABLED = 'false';
process.env.NODE_CONFIG = JSON.stringify({
  auth: { enabled: false },
  useCSRFProtection: true,
});
