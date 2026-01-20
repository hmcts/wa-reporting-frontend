export const setupAnalyticsDom = (): void => {
  document.body.innerHTML = '';
  window.localStorage.clear();
  window.sessionStorage.clear();
  jest.clearAllMocks();
  history.pushState({}, '', '/analytics/completed');
  window.scrollTo = jest.fn();
  Object.defineProperty(window, 'scrollY', { value: 120, writable: true });
  window.requestAnimationFrame = jest.fn(callback => {
    callback(0);
    return 1;
  });
  window.cancelAnimationFrame = jest.fn();
  URL.createObjectURL = jest.fn(() => 'blob:mock');
  URL.revokeObjectURL = jest.fn();
  HTMLAnchorElement.prototype.click = jest.fn();
  HTMLFormElement.prototype.submit = jest.fn();
  HTMLFormElement.prototype.requestSubmit = jest.fn();
};

export const mockBoundingClientRect = (): DOMRect =>
  ({
    top: 0,
    left: 0,
    right: 100,
    bottom: 100,
    width: 100,
    height: 100,
    x: 0,
    y: 0,
    toJSON: () => undefined,
  }) as DOMRect;
