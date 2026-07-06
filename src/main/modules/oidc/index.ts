import { constants as http } from 'node:http2';

import config from 'config';
import { RedisStore } from 'connect-redis';
import { Application, Request, Response } from 'express';
import { Session, SessionStore, auth } from 'express-openid-connect';
import session from 'express-session';
import { jwtDecode } from 'jwt-decode';
import FileStoreFactory from 'session-file-store';

import { HTTPError } from '../../app/errors/HttpError';
import { User } from '../../interfaces/User';
import { Logger } from '../logging';
import { RoleAssignmentClient } from '../role-assignment/roleAssignmentClient';
import type { RoleAssignment } from '../role-assignment/roleAssignmentClient';
import { getRedisClient } from '../redis';
import { S2sTokenClient } from '../s2s/s2sTokenClient';
import {
  WA_REPORTING_AUTHORIZATION_SESSION_KEY,
  buildWaReportingAuthorization,
  findActiveRoleAssignment,
  hasRoleAssignmentAuthorization,
  parseRoleAssignmentRoleNames,
} from './roleAssignmentAccess';
import type { WaReportingAuthorization } from './roleAssignmentAccess';

interface TokenUser {
  uid: string;
  email: string;
  roles?: string[];
}

const toSafeErrorDetails = (error: unknown): Record<string, number | string> => {
  const details: Record<string, number | string> = {};
  if (error instanceof Error) {
    details.name = error.name;
    details.message = error.message;
  } else {
    details.message = String(error);
  }

  const errorLike =
    error && typeof error === 'object'
      ? (error as { code?: unknown; response?: { status?: unknown }; status?: unknown })
      : {};
  if (typeof errorLike.code === 'string') {
    details.code = errorLike.code;
  }

  const status = errorLike.response?.status ?? errorLike.status;
  if (typeof status === 'number') {
    details.status = status;
  }

  return details;
};

export class OidcMiddleware {
  private readonly logger = Logger.getLogger('OidcMiddleware');
  private readonly clientId: string = config.get('services.idam.clientID');
  private readonly clientSecret: string = config.get('secrets.wa.wa-reporting-frontend-client-secret');
  private readonly clientScope: string = config.get('services.idam.scope');
  private readonly baseUrl: string = config.get('services.idam.url.wa');
  private readonly idamBaseUrl: string = config.get('services.idam.url.public');
  private readonly sessionSecret: string = config.get('secrets.wa.wa-reporting-frontend-session-secret');
  private readonly accessRole: string = config.get('RBAC.access');
  private readonly roleAssignmentRoleNames: string[] = parseRoleAssignmentRoleNames(
    config.get('RBAC.roleAssignmentRoleNames')
  );
  private readonly sessionCookieName: string = config.get('session.cookie.name');
  private readonly roleAssignmentClient: RoleAssignmentClient = new RoleAssignmentClient(
    config.get('services.roleAssignment.url'),
    new S2sTokenClient(config.get('services.s2s.url'), config.get('secrets.wa.wa-reporting-frontend-s2s-secret'))
  );

  public enableFor(app: Application): void {
    app.use(
      auth({
        issuerBaseURL: this.idamBaseUrl + '/o',
        baseURL: this.baseUrl,
        httpTimeout: 15099,
        clientID: this.clientId,
        secret: this.sessionSecret,
        clientSecret: this.clientSecret,
        clientAuthMethod: 'client_secret_post',
        idpLogout: true,
        authorizationParams: {
          response_type: 'code',
          scope: this.clientScope,
        },
        session: {
          name: this.sessionCookieName,
          rollingDuration: 60 * 60,
          cookie: {
            httpOnly: true,
          },
          rolling: true,
          store: this.getSessionStore(app),
        },
        afterCallback: async (req: Request, res: Response, oidcSession: Session) => {
          if (res.statusCode === http.HTTP_STATUS_OK && oidcSession.id_token) {
            const tokenUser = jwtDecode(oidcSession.id_token) as TokenUser;
            const roles = Array.isArray(tokenUser.roles) ? tokenUser.roles : [];
            const authorization = roles.includes(this.accessRole)
              ? buildWaReportingAuthorization('idam')
              : await this.getRoleAssignmentAuthorization(tokenUser, oidcSession);

            if (!authorization) {
              throw new HTTPError(http.HTTP_STATUS_FORBIDDEN);
            }

            const user = {
              id: tokenUser.uid,
              email: tokenUser.email,
              roles,
            } as User;
            return { ...oidcSession, user, [WA_REPORTING_AUTHORIZATION_SESSION_KEY]: authorization };
          } else {
            throw new HTTPError(http.HTTP_STATUS_FORBIDDEN);
          }
        },
      })
    );

    app.use((req, _res, next) => {
      if (!req.oidc?.isAuthenticated?.()) {
        throw new HTTPError(http.HTTP_STATUS_FORBIDDEN);
      }

      const roles = req.oidc?.user?.roles ?? [];
      if (!roles.includes(this.accessRole) && !this.isRoleAssignmentAuthorized(req)) {
        throw new HTTPError(http.HTTP_STATUS_FORBIDDEN);
      }

      next();
    });
  }

  private async getRoleAssignmentAuthorization(
    tokenUser: TokenUser,
    oidcSession: Session
  ): Promise<WaReportingAuthorization | undefined> {
    if (!tokenUser.uid || !oidcSession.access_token) {
      return undefined;
    }

    let matchingAssignment: RoleAssignment | undefined;

    try {
      const assignments = await this.roleAssignmentClient.getAssignmentsForActor(
        tokenUser.uid,
        oidcSession.access_token
      );
      matchingAssignment = findActiveRoleAssignment(assignments, this.roleAssignmentRoleNames);
    } catch (error) {
      this.logger.warn('Role assignment authorization failed', toSafeErrorDetails(error));
      return undefined;
    }

    if (!matchingAssignment?.roleName) {
      return undefined;
    }

    return buildWaReportingAuthorization('role-assignment', matchingAssignment.roleName);
  }

  private isRoleAssignmentAuthorized(req: Request): boolean {
    const oidcSessionData = (req as unknown as Record<string, unknown>)[this.sessionCookieName];
    return hasRoleAssignmentAuthorization(oidcSessionData);
  }

  private getSessionStore(app: Application): SessionStore {
    const fileStore = FileStoreFactory(session);

    const client = getRedisClient(app);

    if (client) {
      return new RedisStore({
        client,
        prefix: 'wa-reporting-frontend:',
      }) as unknown as SessionStore;
    }

    return new fileStore({ path: '/tmp' }) as unknown as SessionStore;
  }
}
