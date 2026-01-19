import { storeScrollPosition } from './forms';

export type InitAll = (options?: { scope?: HTMLElement }) => void;

export type AjaxDeps = {
  initAll: InitAll;
  initMojAll: InitAll;
  rebindSectionBehaviors: () => void;
};

export type FetchSectionUpdate = (form: HTMLFormElement, sectionId: string) => Promise<void>;
export type FetchSortedSection = (form: HTMLFormElement, scope: string, sectionId?: string) => Promise<void>;
export type FetchPaginatedSection = (
  form: HTMLFormElement,
  sectionId: string,
  ajaxSection: string,
  pageParam: string,
  page: string
) => Promise<void>;

export function buildUrlEncodedBody(form: HTMLFormElement, extra: Record<string, string> = {}): URLSearchParams {
  const formData = new FormData(form);
  const params = new URLSearchParams();
  formData.forEach((value, key) => {
    if (typeof value === 'string') {
      params.append(key, value);
      return;
    }
    params.append(key, value.name);
  });
  Object.entries(extra).forEach(([key, value]) => {
    params.set(key, value);
  });
  return params;
}

export async function postAjaxForm(form: HTMLFormElement, extra: Record<string, string>): Promise<string> {
  const response = await fetch(form.action || window.location.pathname, {
    method: form.method || 'POST',
    headers: {
      'X-Requested-With': 'fetch',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: buildUrlEncodedBody(form, extra).toString(),
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch section: ${response.status}`);
  }
  return response.text();
}

export async function fetchSectionUpdate(form: HTMLFormElement, sectionId: string, deps: AjaxDeps): Promise<void> {
  const target = document.querySelector<HTMLElement>(`[data-section="${sectionId}"]`);
  if (!target) {
    form.submit();
    return;
  }
  try {
    const html = await postAjaxForm(form, { ajaxSection: sectionId });
    target.innerHTML = html;
    deps.initAll({ scope: target });
    deps.initMojAll({ scope: target });
    deps.rebindSectionBehaviors();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to update section', error);
    form.submit();
  }
}

export async function fetchSortedSection(
  form: HTMLFormElement,
  scope: string,
  sectionId: string | undefined,
  deps: AjaxDeps
): Promise<void> {
  const resolvedSectionId = sectionId ?? `user-overview-${scope}`;
  const target = document.querySelector<HTMLElement>(`[data-section="${resolvedSectionId}"]`);
  if (!target) {
    storeScrollPosition();
    form.submit();
    return;
  }
  try {
    const html = await postAjaxForm(form, { ajaxSection: scope });
    target.innerHTML = html;
    deps.initMojAll({ scope: target });
    deps.rebindSectionBehaviors();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to update sorted section', error);
    storeScrollPosition();
    form.submit();
  }
}

export async function fetchPaginatedSection(
  form: HTMLFormElement,
  sectionId: string,
  ajaxSection: string,
  pageParam: string,
  page: string,
  deps: AjaxDeps
): Promise<void> {
  const target = document.querySelector<HTMLElement>(`[data-section="${sectionId}"]`);
  if (!target) {
    storeScrollPosition();
    form.submit();
    return;
  }
  try {
    const html = await postAjaxForm(form, { ajaxSection, [pageParam]: page });
    target.innerHTML = html;
    deps.initAll({ scope: target });
    deps.initMojAll({ scope: target });
    deps.rebindSectionBehaviors();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to update paginated section', error);
    storeScrollPosition();
    form.submit();
  }
}

export function initAjaxFilterSections(fetchSectionUpdateWithDeps: FetchSectionUpdate): void {
  const forms = document.querySelectorAll<HTMLFormElement>('form[data-ajax-section]');
  forms.forEach(form => {
    if (form.dataset.ajaxBound === 'true') {
      return;
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      const sectionId = form.dataset.ajaxSection;
      if (!sectionId) {
        form.submit();
        return;
      }
      void fetchSectionUpdateWithDeps(form, sectionId);
    });
    form.dataset.ajaxBound = 'true';
  });
}
