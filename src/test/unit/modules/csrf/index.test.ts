import type { Request, Response } from 'express';

const getMock = jest.fn();
const doubleCsrfProtection = jest.fn((req: Request, res: Response, next: () => void) => next());
const generateCsrfToken = jest.fn();
const validateRequest = jest.fn();
const doubleCsrfMock = jest.fn(() => ({
  doubleCsrfProtection,
  generateCsrfToken,
  validateRequest,
})) as jest.Mock;

jest.mock('config', () => ({
  get: (...args: unknown[]) => getMock(...args),
}));

jest.mock('csrf-csrf', () => ({
  doubleCsrf: doubleCsrfMock,
}));

describe('csrfService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const loadService = () => require('../../../../main/modules/csrf');

  test('configures csrf-csrf and exposes token helpers when enabled', () => {
    getMock.mockImplementation((key: string) => {
      if (key === 'useCSRFProtection') {
        return true;
      }
      if (key === 'csrfCookieSecret') {
        return 'test-secret';
      }
      return undefined;
    });
    generateCsrfToken.mockReturnValue('token');
    validateRequest.mockReturnValue(true);

    const { csrfService } = loadService();
    expect(doubleCsrfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cookieName: 'x-csrf-token',
        cookieOptions: expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          secure: true,
        }),
        getSecret: expect.any(Function),
        getSessionIdentifier: expect.any(Function),
        getCsrfTokenFromRequest: expect.any(Function),
      })
    );

    const req = { cookies: { 'x-csrf-id': 'cookie-id' }, get: jest.fn(), ip: '127.0.0.1' } as unknown as Request;
    const res = {} as Response;
    const token = csrfService.getToken(req, res);
    expect(token).toBe('token');
    expect(csrfService.validate(req)).toBe(true);

    const middleware = csrfService.getProtection();
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();

    const configArgs = doubleCsrfMock.mock.calls[0]?.[0] as
      | {
          getSessionIdentifier: (request: Request) => string;
          getCsrfTokenFromRequest: (request: Request) => string | undefined;
        }
      | undefined;
    expect(configArgs).toBeDefined();
    if (!configArgs) {
      throw new Error('Expected csrf-csrf to be configured');
    }
    expect(configArgs.getSessionIdentifier(req)).toBe('cookie-id');
    expect(configArgs.getSessionIdentifier({ cookies: {} } as Request)).toBe('anonymous');
    expect(configArgs.getCsrfTokenFromRequest({ body: { _csrf: 'body-token' }, headers: {} } as Request)).toBe(
      'body-token'
    );
    expect(configArgs.getCsrfTokenFromRequest({ headers: { 'x-csrf-token': 'header-token' } } as Request)).toBe(
      'header-token'
    );
    expect(
      configArgs.getCsrfTokenFromRequest({ headers: { 'x-csrf-token': ['array-token'] } } as unknown as Request)
    ).toBe('array-token');
    expect(configArgs.getCsrfTokenFromRequest({ headers: {} } as Request)).toBeUndefined();
  });

  test('disables csrf-csrf when feature flag is off', () => {
    getMock.mockImplementation((key: string) => {
      if (key === 'useCSRFProtection') {
        return false;
      }
      return undefined;
    });

    const { csrfService } = loadService();
    expect(doubleCsrfMock).not.toHaveBeenCalled();

    const req = {} as Request;
    const res = {} as Response;
    expect(csrfService.getToken(req, res)).toBe('');
    expect(csrfService.validate(req)).toBe(true);

    const middleware = csrfService.getProtection();
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('defaults to enabled when feature flag is undefined', () => {
    getMock.mockImplementation((key: string) => {
      if (key === 'csrfCookieSecret') {
        return 'test-secret';
      }
      return undefined;
    });

    const { csrfService } = loadService();
    expect(doubleCsrfMock).toHaveBeenCalledTimes(1);
    const req = {} as Request;
    const res = {} as Response;
    csrfService.getToken(req, res);
    csrfService.validate(req);
  });

  test('falls back to dummy secret when csrfCookieSecret is empty', () => {
    getMock.mockImplementation((key: string) => {
      if (key === 'useCSRFProtection') {
        return true;
      }
      if (key === 'csrfCookieSecret') {
        return '';
      }
      return undefined;
    });

    loadService();

    const configArgs = doubleCsrfMock.mock.calls[0]?.[0] as { getSecret: () => string } | undefined;
    expect(configArgs).toBeDefined();
    if (!configArgs) {
      throw new Error('Expected csrf-csrf to be configured');
    }
    expect(configArgs.getSecret()).toBe('dummy-token');
  });
});
