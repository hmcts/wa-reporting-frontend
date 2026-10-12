const MILLISECONDS_PER_SECOND = 1_000;
const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND;
const DEFAULT_WARNING_DURATION_MS = 2 * MILLISECONDS_PER_MINUTE;
const KEEP_ALIVE_INTERVAL_MS = 30 * MILLISECONDS_PER_SECOND;
const SESSION_ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;

export const sessionTimeoutBrowser = {
  navigate(url: string): void {
    /* istanbul ignore next -- jsdom does not implement browser navigation */
    window.location.assign(url);
  },
};

export function formatRemainingTime(remainingMilliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMilliseconds / MILLISECONDS_PER_SECOND));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
  }

  return parts.join(' ');
}

export class SessionTimeout {
  private readonly continueButton: HTMLButtonElement | null;
  private readonly countdown: HTMLElement | null;
  private readonly warningDurationMs: number;
  private signOutTimer: number | undefined;
  private warningTimer: number | undefined;
  private countdownTimer: number | undefined;
  private deadline = 0;
  private warningVisible = false;
  private lastKeepAliveAt = 0;
  private previouslyFocusedElement: HTMLElement | null = null;

  constructor(
    private readonly dialog: HTMLElement,
    private readonly timeoutMs: number
  ) {
    this.continueButton = dialog.querySelector<HTMLButtonElement>('[data-session-timeout-continue]');
    this.countdown = dialog.querySelector<HTMLElement>('[data-session-timeout-countdown]');
    this.warningDurationMs = Math.min(DEFAULT_WARNING_DURATION_MS, Math.floor(timeoutMs / 2));
  }

  public start(): void {
    this.schedule();
    SESSION_ACTIVITY_EVENTS.forEach(eventName =>
      document.addEventListener(eventName, this.recordActivity, { passive: true })
    );
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    document.addEventListener('keydown', this.trapFocus);
    this.continueButton?.addEventListener('click', this.continueSession);
  }

  private readonly recordActivity = (): void => {
    if (this.warningVisible) {
      return;
    }

    this.schedule();
    if (Date.now() - this.lastKeepAliveAt >= KEEP_ALIVE_INTERVAL_MS) {
      this.lastKeepAliveAt = Date.now();
      void this.keepAlive();
    }
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible' && Date.now() >= this.deadline) {
      this.signOut();
    }
  };

  private readonly continueSession = (): void => {
    void this.keepAlive();
  };

  private schedule(): void {
    this.clearTimers();
    this.hideWarning();
    this.deadline = Date.now() + this.timeoutMs;
    this.warningTimer = window.setTimeout(() => this.showWarning(), this.timeoutMs - this.warningDurationMs);
    this.signOutTimer = window.setTimeout(() => this.signOut(), this.timeoutMs);
  }

  private async keepAlive(): Promise<void> {
    try {
      const response = await fetch('/active', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok || response.redirected) {
        this.signOut();
        return;
      }

      this.lastKeepAliveAt = Date.now();
      this.schedule();
    } catch {
      this.signOut();
    }
  }

  private showWarning(): void {
    this.warningVisible = true;
    this.previouslyFocusedElement = document.activeElement as HTMLElement | null;
    this.dialog.hidden = false;
    this.dialog.setAttribute('aria-hidden', 'false');
    this.updateCountdown();
    this.countdownTimer = window.setInterval(() => this.updateCountdown(), MILLISECONDS_PER_SECOND);
    this.continueButton?.focus();
  }

  private hideWarning(): void {
    if (!this.warningVisible) {
      return;
    }

    this.warningVisible = false;
    this.dialog.hidden = true;
    this.dialog.setAttribute('aria-hidden', 'true');
    this.previouslyFocusedElement?.focus();
    this.previouslyFocusedElement = null;
  }

  private updateCountdown(): void {
    if (this.countdown) {
      this.countdown.textContent = formatRemainingTime(this.deadline - Date.now());
    }
  }

  private trapFocus = (event: KeyboardEvent): void => {
    if (!this.warningVisible || event.key !== 'Tab') {
      return;
    }

    event.preventDefault();
    this.continueButton?.focus();
  };

  private clearTimers(): void {
    if (this.signOutTimer !== undefined) {
      window.clearTimeout(this.signOutTimer);
    }
    if (this.warningTimer !== undefined) {
      window.clearTimeout(this.warningTimer);
    }
    if (this.countdownTimer !== undefined) {
      window.clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
    }
  }

  private signOut(): void {
    this.clearTimers();
    sessionTimeoutBrowser.navigate('/logout');
  }
}

export function initializeSessionTimeout(): void {
  const dialog = document.querySelector<HTMLElement>('[data-session-timeout-minutes]');
  const timeoutMinutes = Number(dialog?.dataset.sessionTimeoutMinutes);

  if (!dialog || !Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) {
    return;
  }

  new SessionTimeout(dialog, timeoutMinutes * MILLISECONDS_PER_MINUTE).start();
}
