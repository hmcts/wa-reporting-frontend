declare module 'govuk-frontend' {
  export type InitAllConfig = {
    scope?: Element | Document | null;
  };
  export function initAll(config?: InitAllConfig): void;
}
