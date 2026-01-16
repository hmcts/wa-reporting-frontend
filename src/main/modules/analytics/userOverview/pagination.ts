import { PaginationMeta, buildAnalyticsPaginationHref, paginateRows, parsePageParam } from '../shared/pagination';
import { AnalyticsFilters } from '../shared/types';
import { UserOverviewSort } from '../shared/userOverviewSort';

export const USER_OVERVIEW_PAGE_SIZE = 500;
const USER_OVERVIEW_PATH = '/analytics/users';

type PaginateUserOverviewParams<T> = {
  rows: T[];
  filters: AnalyticsFilters;
  sort: UserOverviewSort['assigned'] | UserOverviewSort['completed'];
  page: number;
  pageSize?: number;
  basePath?: string;
};

export function parseAssignedPage(raw: unknown): number {
  return parsePageParam(raw);
}

export function parseCompletedPage(raw: unknown): number {
  return parsePageParam(raw);
}

export function paginateAssignedTasks<T>({
  rows,
  filters,
  sort,
  page,
  pageSize = USER_OVERVIEW_PAGE_SIZE,
  basePath = USER_OVERVIEW_PATH,
}: PaginateUserOverviewParams<T>): { pagedRows: T[]; pagination: PaginationMeta } {
  const buildHref = (targetPage: number) =>
    buildAnalyticsPaginationHref({
      basePath,
      filters,
      pageParam: 'assignedPage',
      page: targetPage,
      extraParams: {
        assignedSortBy: sort.by,
        assignedSortDir: sort.dir,
      },
    });

  return paginateRows({
    rows,
    page,
    pageSize,
    buildHref,
    landmarkLabel: 'Assigned tasks pagination',
  });
}

export function paginateCompletedTasks<T>({
  rows,
  filters,
  sort,
  page,
  pageSize = USER_OVERVIEW_PAGE_SIZE,
  basePath = USER_OVERVIEW_PATH,
}: PaginateUserOverviewParams<T>): { pagedRows: T[]; pagination: PaginationMeta } {
  const buildHref = (targetPage: number) =>
    buildAnalyticsPaginationHref({
      basePath,
      filters,
      pageParam: 'completedPage',
      page: targetPage,
      extraParams: {
        completedSortBy: sort.by,
        completedSortDir: sort.dir,
      },
    });

  return paginateRows({
    rows,
    page,
    pageSize,
    buildHref,
    landmarkLabel: 'Completed tasks pagination',
  });
}
