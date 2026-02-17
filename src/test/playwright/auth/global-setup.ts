import { SessionUtils } from '@hmcts/playwright-common';
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

import { buildUrl } from '../config';
import { IdamLoginPage } from '../page-objects/pages';

import { getAuthCredentials, getAuthEnabled, getSessionCookieName, getSessionFilePath } from './config';

const ensureSessionDirectory = async (sessionFile: string): Promise<void> => {
  await fs.mkdir(path.dirname(sessionFile), { recursive: true });
};

const isSessionReusable = (sessionFile: string, cookieName: string): boolean => {
  try {
    return SessionUtils.isSessionValid(sessionFile, cookieName);
  } catch {
    return false;
  }
};

const createFreshSession = async (sessionFile: string, username: string, password: string): Promise<void> => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const idamLoginPage = new IdamLoginPage(page);

  try {
    await page.goto(buildUrl('/'));

    const loginVisible = await idamLoginPage.isLoginVisible(15_000);
    if (loginVisible) {
      await idamLoginPage.login(username, password);
    } else {
      const analyticsHeading = page.getByRole('heading', { name: 'Service performance overview', level: 1 });
      const analyticsVisible = await analyticsHeading.waitFor({ state: 'visible', timeout: 15_000 }).then(
        () => true,
        () => false
      );
      if (!analyticsVisible) {
        await idamLoginPage.login(username, password);
      }
    }

    await page.getByRole('heading', { name: 'Service performance overview', level: 1 }).waitFor({ timeout: 60_000 });
    await page.context().storageState({ path: sessionFile });
  } finally {
    await browser.close();
  }
};

const globalSetup = async (): Promise<void> => {
  if (!getAuthEnabled()) {
    return;
  }

  const { username, password } = getAuthCredentials();
  const sessionFile = getSessionFilePath();
  const cookieName = getSessionCookieName();

  await ensureSessionDirectory(sessionFile);

  if (isSessionReusable(sessionFile, cookieName)) {
    return;
  }

  await createFreshSession(sessionFile, username, password);
};

export default globalSetup;
