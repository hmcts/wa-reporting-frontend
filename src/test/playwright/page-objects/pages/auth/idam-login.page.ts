import { Locator, Page } from '@playwright/test';

export class IdamLoginPage {
  constructor(private readonly page: Page) {}

  get usernameInput(): Locator {
    return this.page.locator(
      '[data-testid="idam-username-input"], #username, input[name="username"], input[type="email"]'
    );
  }

  get passwordInput(): Locator {
    return this.page.locator(
      '[data-testid="idam-password-input"], #password, input[name="password"], input[type="password"]'
    );
  }

  private submitButtonFor(input: Locator): Locator {
    const form = input.locator('xpath=ancestor::form[1]');
    return form
      .getByRole('button', { name: /continue|sign in|sign in or create an account/i })
      .or(form.locator('button[type="submit"], input[type="submit"]'));
  }

  async isLoginVisible(timeoutMs = 10_000): Promise<boolean> {
    try {
      await this.usernameInput.waitFor({ state: 'visible', timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.waitFor({ state: 'visible', timeout: 60_000 });
    await this.usernameInput.fill(username);

    if (await this.passwordInput.isVisible()) {
      await this.passwordInput.fill(password);
      await this.submitButtonFor(this.passwordInput).first().click();
      return;
    }

    await this.submitButtonFor(this.usernameInput).first().click();
    await this.passwordInput.waitFor({ state: 'visible', timeout: 60_000 });
    await this.passwordInput.fill(password);
    await this.submitButtonFor(this.passwordInput).first().click();
  }

  async loginIfPresent(username: string, password: string, timeoutMs = 10_000): Promise<boolean> {
    const isVisible = await this.isLoginVisible(timeoutMs);
    if (!isVisible) {
      return false;
    }
    await this.login(username, password);
    return true;
  }
}
