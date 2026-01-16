import config from 'config';
import { type DoubleCsrfProtection, doubleCsrf } from 'csrf-csrf';
import type { Request, Response } from 'express';

type CsrfTokenGenerator = (req: Request, res: Response) => string;
type CsrfTokenValidator = (req: Request) => boolean;

class CsrfService {
  private readonly enabled: boolean;
  private readonly generateToken: CsrfTokenGenerator;
  private readonly validateToken: CsrfTokenValidator;
  private readonly protection: DoubleCsrfProtection;

  constructor() {
    this.enabled = config.get<boolean>('useCSRFProtection') ?? true;

    if (!this.enabled) {
      this.generateToken = () => '';
      this.validateToken = () => true;
      this.protection = (_req, _res, next) => next();
      return;
    }

    const csrfSecret: string = config.get('csrfCookieSecret') || 'dummy-token';

    const { doubleCsrfProtection, generateCsrfToken, validateRequest } = doubleCsrf({
      getSecret: () => csrfSecret,
      getSessionIdentifier: (req: Request) => req.cookies['x-csrf-id'] || 'anonymous',
      getCsrfTokenFromRequest: (req: Request) => req.body?._csrf || req.headers['x-csrf-token']?.toString(),
      cookieName: 'x-csrf-token',
      cookieOptions: {
        httpOnly: true,
        sameSite: 'strict',
        secure: true,
      },
    });

    this.generateToken = generateCsrfToken;
    this.validateToken = validateRequest;
    this.protection = doubleCsrfProtection;
  }

  public getToken(req: Request, res: Response): string {
    return this.generateToken(req, res);
  }

  public validate(req: Request): boolean {
    return this.validateToken(req);
  }

  public getProtection(): DoubleCsrfProtection {
    return this.protection;
  }
}

export const csrfService = new CsrfService();
