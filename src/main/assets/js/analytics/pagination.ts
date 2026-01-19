import type { FetchPaginatedSection } from './ajax';
import { getAnalyticsFiltersForm, setHiddenInput } from './forms';

export function getPaginationParamFromHref(href: string, param: string): string | null {
  try {
    const url = new URL(href, window.location.origin);
    return url.searchParams.get(param);
  } catch {
    return null;
  }
}

export function initCriticalTasksPagination(fetchPaginatedSection: FetchPaginatedSection): void {
  const paginations = document.querySelectorAll<HTMLElement>('[data-critical-tasks-pagination="true"]');
  paginations.forEach(pagination => {
    if (pagination.dataset.paginationBound === 'true') {
      return;
    }
    pagination.addEventListener('click', event => {
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a');
      if (!link || !link.href) {
        return;
      }
      const page = getPaginationParamFromHref(link.href, 'criticalTasksPage');
      if (!page) {
        return;
      }
      const form = getAnalyticsFiltersForm();
      if (!form) {
        return;
      }
      event.preventDefault();
      setHiddenInput(form, 'criticalTasksPage', page);
      void fetchPaginatedSection(form, 'outstanding-critical-tasks', 'criticalTasks', 'criticalTasksPage', page);
    });
    pagination.dataset.paginationBound = 'true';
  });
}

export function initUserOverviewPagination(fetchPaginatedSection: FetchPaginatedSection): void {
  const paginations = document.querySelectorAll<HTMLElement>('[data-user-overview-pagination]');
  paginations.forEach(pagination => {
    if (pagination.dataset.paginationBound === 'true') {
      return;
    }
    const scope = pagination.dataset.userOverviewPagination;
    if (!scope) {
      return;
    }
    pagination.addEventListener('click', event => {
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a');
      if (!link || !link.href) {
        return;
      }
      const pageParam = scope === 'completed' ? 'completedPage' : 'assignedPage';
      const page = getPaginationParamFromHref(link.href, pageParam);
      if (!page) {
        return;
      }
      const form = getAnalyticsFiltersForm();
      if (!form) {
        return;
      }
      const sectionId = scope === 'completed' ? 'user-overview-completed' : 'user-overview-assigned';
      event.preventDefault();
      setHiddenInput(form, pageParam, page);
      void fetchPaginatedSection(form, sectionId, scope, pageParam, page);
    });
    pagination.dataset.paginationBound = 'true';
  });
}
