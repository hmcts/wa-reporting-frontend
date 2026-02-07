import config from 'config';
import { csrfSync } from 'csrf-sync';
import type { NextFunction, Request, Response } from 'express';

type CsrfTokenGenerator = (req: Request) => string;
type CsrfTokenValidator = (req: Request) => boolean;
type CsrfProtection = (req: Request, res: Response, next: NextFunction) => void;

class CsrfService {
  private readonly enabled: boolean;
  private readonly generateToken: CsrfTokenGenerator;
  private readonly validateToken: CsrfTokenValidator;
  private readonly protection: CsrfProtection;

  constructor() {
    this.enabled = config.get<boolean>('useCSRFProtection') ?? true;

    if (!this.enabled) {
      this.generateToken = () => '';
      this.validateToken = () => true;
      this.protection = (_req, _res, next) => next();
      return;
    }

    const { csrfSynchronisedProtection, generateToken, isRequestValid } = csrfSync({
      ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
      getTokenFromRequest: (req: Request) => req.body?._csrf || req.headers['x-csrf-token']?.toString(),
      getTokenFromState: (req: Request) => req.session.csrfToken,
      storeTokenInState: (req: Request, token) => {
        req.session.csrfToken = token;
      },
    });

    this.generateToken = (req: Request) => generateToken(req);
    this.validateToken = isRequestValid;
    this.protection = csrfSynchronisedProtection;
  }

  public getToken(req: Request, _res: Response): string {
    return this.generateToken(req);
  }

  public validate(req: Request): boolean {
    return this.validateToken(req);
  }

  public getProtection(): CsrfProtection {
    return this.protection;
  }
}

export const csrfService = new CsrfService();
