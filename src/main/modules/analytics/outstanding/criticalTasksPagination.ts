import { OutstandingSort } from '../shared/outstandingSort';
import {
  PaginationMeta,
  buildAnalyticsPaginationHref,
  buildPaginationMeta,
  parsePageParam,
} from '../shared/pagination';
import { AnalyticsFilters, CriticalTask } from '../shared/types';

export const CRITICAL_TASKS_PAGE_SIZE = 500;
const OUTSTANDING_PATH = '/outstanding';

type PaginateCriticalTasksParams = {
  tasks: CriticalTask[];
  totalResults: number;
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
  totalResults,
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
  const pagination = buildPaginationMeta({
    totalResults,
    page,
    pageSize,
    buildHref,
    landmarkLabel: 'Critical tasks pagination',
  });

  return { pagedTasks: tasks, pagination };
}
