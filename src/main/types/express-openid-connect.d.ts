import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    oidc?: {
      isAuthenticated?: () => boolean;
      user?: {
        roles?: string[];
        [key: string]: unknown;
      };
    };
  }
}
