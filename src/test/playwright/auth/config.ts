import config from 'config';
import path from 'node:path';

export const getAuthEnabled = (): boolean => {
  return Boolean(config.get('auth.enabled'));
};

export const getAuthCredentials = (): { username: string; password: string } => {
  const username = process.env.TEST_IDAM_USERNAME;
  const password = process.env.TEST_IDAM_PASSWORD;

  if (!username || !password) {
    throw new Error('Missing required environment variables: TEST_IDAM_USERNAME and TEST_IDAM_PASSWORD.');
  }

  return { username, password };
};

export const getSessionCookieName = (): string => {
  return process.env.AUTH_SESSION_COOKIE_NAME || String(config.get('session.cookie.name'));
};

export const getSessionFilePath = (): string => {
  return path.resolve(process.cwd(), 'src/test/playwright/.sessions', 'idam-session.json');
};
