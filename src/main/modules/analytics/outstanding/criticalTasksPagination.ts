import { OutstandingSort } from '../shared/outstandingSort';
import { PaginationMeta, buildAnalyticsPaginationHref, paginateRows, parsePageParam } from '../shared/pagination';
import { AnalyticsFilters, CriticalTask } from '../shared/types';

export const CRITICAL_TASKS_PAGE_SIZE = 500;
const OUTSTANDING_PATH = '/analytics/outstanding';

type PaginateCriticalTasksParams = {
  tasks: CriticalTask[];
  filters: AnalyticsFilters;
  sort: OutstandingSort['criticalTasks'];
  page: number;
  pageSize?: number;
  basePath?: string;
};

export type CriticalTasksPagination = PaginationMeta;

export function parseCriticalTasksPage(raw: unknown): number {
  return parsePageParam(raw);
}

export function paginateCriticalTasks({
  tasks,
  filters,
  sort,
  page,
  pageSize = CRITICAL_TASKS_PAGE_SIZE,
  basePath = OUTSTANDING_PATH,
}: PaginateCriticalTasksParams): { pagedTasks: CriticalTask[]; pagination: CriticalTasksPagination } {
  const buildHref = (targetPage: number) =>
    buildAnalyticsPaginationHref({
      basePath,
      filters,
      pageParam: 'criticalTasksPage',
      page: targetPage,
      extraParams: {
        criticalTasksSortBy: sort.by,
        criticalTasksSortDir: sort.dir,
      },
    });
  const { pagedRows, pagination } = paginateRows({
    rows: tasks,
    page,
    pageSize,
    buildHref,
    landmarkLabel: 'Critical tasks pagination',
  });

  return { pagedTasks: pagedRows, pagination };
}
