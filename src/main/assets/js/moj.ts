import { SortableTable } from '@ministryofjustice/frontend/moj/components/sortable-table/sortable-table.mjs';

type MojInitOptions = Element | Document | null | { scope?: Element | Document | null };

const getScope = (scopeOrOptions?: MojInitOptions): Element | Document | null => {
  if (typeof scopeOrOptions === 'undefined') {
    return document;
  }

  if (scopeOrOptions === null) {
    return null;
  }

  if (scopeOrOptions instanceof Element || scopeOrOptions instanceof Document) {
    return scopeOrOptions;
  }

  return scopeOrOptions.scope ?? null;
};

export const initMojAll = (scopeOrOptions?: MojInitOptions): void => {
  const scope = getScope(scopeOrOptions);

  if (!scope) {
    return;
  }

  scope.querySelectorAll('[data-module="moj-sortable-table"]').forEach($root => {
    try {
      new SortableTable($root);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(error);
    }
  });
};
