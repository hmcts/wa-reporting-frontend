import type { Request, Response } from 'express';

const getMock = jest.fn();
const csrfSynchronisedProtection = jest.fn((req: Request, res: Response, next: () => void) => next());
const generateToken = jest.fn();
const isRequestValid = jest.fn();
const csrfSyncMock = jest.fn(() => ({
  csrfSynchronisedProtection,
  generateToken,
  isRequestValid,
})) as jest.Mock;

jest.mock('config', () => ({
  get: (...args: unknown[]) => getMock(...args),
}));

jest.mock('csrf-sync', () => ({
  csrfSync: csrfSyncMock,
}));

describe('csrfService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const loadService = () => require('../../../../main/modules/csrf');

  test('configures csrf-sync and exposes token helpers when enabled', () => {
    getMock.mockImplementation((key: string) => {
      if (key === 'useCSRFProtection') {
        return true;
      }
      return undefined;
    });
    generateToken.mockReturnValue('token');
    isRequestValid.mockReturnValue(true);

    const { csrfService } = loadService();
    expect(csrfSyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
        getTokenFromRequest: expect.any(Function),
        getTokenFromState: expect.any(Function),
        storeTokenInState: expect.any(Function),
      })
    );

    const req = { session: { csrfToken: 'stored-token' } } as unknown as Request;
    const res = {} as Response;
    const token = csrfService.getToken(req, res);
    expect(token).toBe('token');
    expect(csrfService.validate(req)).toBe(true);

    const middleware = csrfService.getProtection();
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();

    const configArgs = csrfSyncMock.mock.calls[0]?.[0] as
      | {
          getTokenFromRequest: (request: Request) => string | undefined;
          getTokenFromState: (request: Request) => string | undefined;
          storeTokenInState: (request: Request, token: string) => void;
        }
      | undefined;
    expect(configArgs).toBeDefined();
    if (!configArgs) {
      throw new Error('Expected csrf-sync to be configured');
    }
    expect(configArgs.getTokenFromState(req)).toBe('stored-token');
    configArgs.storeTokenInState(req, 'new-token');
    expect(req.session.csrfToken).toBe('new-token');
    expect(configArgs.getTokenFromRequest({ body: { _csrf: 'body-token' }, headers: {} } as Request)).toBe(
      'body-token'
    );
    expect(configArgs.getTokenFromRequest({ headers: { 'x-csrf-token': 'header-token' } } as unknown as Request)).toBe(
      'header-token'
    );
    expect(configArgs.getTokenFromRequest({ headers: { 'x-csrf-token': ['array-token'] } } as unknown as Request)).toBe(
      'array-token'
    );
    expect(configArgs.getTokenFromRequest({ headers: {} } as unknown as Request)).toBeUndefined();
  });

  test('disables csrf-sync when feature flag is off', () => {
    getMock.mockImplementation((key: string) => {
      if (key === 'useCSRFProtection') {
        return false;
      }
      return undefined;
    });

    const { csrfService } = loadService();
    expect(csrfSyncMock).not.toHaveBeenCalled();

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
    getMock.mockImplementation((_key: string) => {
      return undefined;
    });

    const { csrfService } = loadService();
    expect(csrfSyncMock).toHaveBeenCalledTimes(1);
    const req = { session: {} } as unknown as Request;
    const res = {} as Response;
    csrfService.getToken(req, res);
    csrfService.validate(req);
  });
});
