/* @jest-environment jsdom */
import {
  SessionTimeout,
  formatRemainingTime,
  initializeSessionTimeout,
  sessionTimeoutBrowser,
} from '../../../main/assets/js/sessionTimeout';

const renderDialog = (): HTMLElement => {
  document.body.innerHTML = `
    <button id="page-action">Page action</button>
    <div data-session-timeout-minutes="2" hidden aria-hidden="true">
      <span data-session-timeout-countdown></span>
      <button data-session-timeout-continue="true">Continue</button>
    </div>
  `;
  return document.querySelector<HTMLElement>('[data-session-timeout-minutes]') as HTMLElement;
};

describe('SessionTimeout', () => {
  const navigate = jest.spyOn(sessionTimeoutBrowser, 'navigate').mockImplementation(() => undefined);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-27T12:00:00.000Z'));
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  it('shows an accessible warning halfway through the configured inactivity interval and signs out at the deadline', () => {
    const dialog = renderDialog();
    const timeout = new SessionTimeout(dialog, 2 * 60 * 1000);

    timeout.start();
    jest.advanceTimersByTime(60 * 1000);

    expect(dialog.hidden).toBe(false);
    expect(dialog.getAttribute('aria-hidden')).toBe('false');
    expect(dialog.querySelector('[data-session-timeout-countdown]')?.textContent).toBe('1 minute');
    expect(document.activeElement).toBe(dialog.querySelector('[data-session-timeout-continue]'));

    jest.advanceTimersByTime(60 * 1000);

    expect(navigate).toHaveBeenCalledWith('/logout');
  });

  it('keeps the session alive and restarts the timeout when the user continues from the warning', async () => {
    const dialog = renderDialog();
    const timeout = new SessionTimeout(dialog, 2 * 60 * 1000);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, redirected: false });

    timeout.start();
    jest.advanceTimersByTime(60 * 1000);
    (dialog.querySelector('[data-session-timeout-continue]') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledWith('/active', { credentials: 'same-origin', cache: 'no-store' });
    expect(dialog.hidden).toBe(true);
    expect(navigate).not.toHaveBeenCalled();

    jest.advanceTimersByTime(59 * 1000);
    expect(dialog.hidden).toBe(true);
    jest.advanceTimersByTime(1_000);
    expect(dialog.hidden).toBe(false);
  });

  it('signs out when the activity check cannot confirm that the session is still valid', async () => {
    const dialog = renderDialog();
    const timeout = new SessionTimeout(dialog, 2 * 60 * 1000);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, redirected: true });

    timeout.start();
    document.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();

    expect(navigate).toHaveBeenCalledWith('/logout');
  });

  it('signs out when a previously hidden page becomes visible after the inactivity deadline', () => {
    const dialog = renderDialog();
    const timeout = new SessionTimeout(dialog, 2 * 60 * 1000);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });

    timeout.start();
    jest.setSystemTime(new Date('2026-07-27T12:02:00.000Z'));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(navigate).toHaveBeenCalledWith('/logout');
  });

  it('does not reset the timeout from background activity while the warning is shown', () => {
    const dialog = renderDialog();
    const timeout = new SessionTimeout(dialog, 2 * 60 * 1000);

    timeout.start();
    jest.advanceTimersByTime(60 * 1000);
    document.dispatchEvent(new Event('scroll'));

    jest.advanceTimersByTime(60 * 1000);
    expect(navigate).toHaveBeenCalledWith('/logout');
  });

  it('signs out when the activity request fails and traps focus in the warning dialog', async () => {
    const dialog = renderDialog();
    const timeout = new SessionTimeout(dialog, 2 * 60 * 1000);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    timeout.start();
    document.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();

    expect(navigate).toHaveBeenCalledWith('/logout');

    navigate.mockClear();
    jest.clearAllTimers();
    timeout.start();
    jest.advanceTimersByTime(60 * 1000);
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog.querySelector('[data-session-timeout-continue]'));

    const nonTabEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    document.dispatchEvent(nonTabEvent);
    expect(nonTabEvent.defaultPrevented).toBe(false);
  });

  it('signs out when the activity check is redirected to a different page', async () => {
    const dialog = renderDialog();
    const timeout = new SessionTimeout(dialog, 2 * 60 * 1000);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, redirected: true });

    timeout.start();
    document.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();

    expect(navigate).toHaveBeenCalledWith('/logout');
  });

  it('still signs out without dialog controls when the inactivity deadline expires', () => {
    document.body.innerHTML = '<div data-session-timeout-minutes="2" hidden></div>';
    const dialog = document.querySelector<HTMLElement>('[data-session-timeout-minutes]') as HTMLElement;
    const timeout = new SessionTimeout(dialog, 2 * 60 * 1000);

    timeout.start();
    jest.advanceTimersByTime(2 * 60 * 1000);

    expect(navigate).toHaveBeenCalledWith('/logout');
  });

  it('initialises only when the page supplies a positive timeout value', () => {
    initializeSessionTimeout();
    expect(navigate).not.toHaveBeenCalled();

    document.body.innerHTML = '<div data-session-timeout-minutes="invalid"></div>';
    initializeSessionTimeout();
    expect(navigate).not.toHaveBeenCalled();

    const dialog = renderDialog();
    initializeSessionTimeout();
    jest.advanceTimersByTime(60 * 1000);

    expect(dialog.hidden).toBe(false);
  });

  it.each([
    [0, '0 seconds'],
    [1_000, '1 second'],
    [61_000, '1 minute 1 second'],
    [120_000, '2 minutes'],
  ])('formats %i milliseconds as a readable countdown', (milliseconds, expected) => {
    expect(formatRemainingTime(milliseconds)).toBe(expected);
  });
});
