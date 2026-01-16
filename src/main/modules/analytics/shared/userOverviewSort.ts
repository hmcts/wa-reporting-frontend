import { SortDirection, SortState, parseDirection, parseSortBy } from './sort';

export type { SortDirection, SortState };

export type AssignedSortBy =
  | 'caseId'
  | 'createdDate'
  | 'taskName'
  | 'assignedDate'
  | 'dueDate'
  | 'priority'
  | 'totalAssignments'
  | 'assignee'
  | 'location';

export type CompletedSortBy =
  | 'caseId'
  | 'createdDate'
  | 'taskName'
  | 'assignedDate'
  | 'dueDate'
  | 'completedDate'
  | 'handlingTimeDays'
  | 'withinDue'
  | 'totalAssignments'
  | 'assignee'
  | 'location';

export type UserOverviewSort = {
  assigned: SortState<AssignedSortBy>;
  completed: SortState<CompletedSortBy>;
};

const assignedSortKeys = new Set<AssignedSortBy>([
  'caseId',
  'createdDate',
  'taskName',
  'assignedDate',
  'dueDate',
  'priority',
  'totalAssignments',
  'assignee',
  'location',
]);

const completedSortKeys = new Set<CompletedSortBy>([
  'caseId',
  'createdDate',
  'taskName',
  'assignedDate',
  'dueDate',
  'completedDate',
  'handlingTimeDays',
  'withinDue',
  'totalAssignments',
  'assignee',
  'location',
]);

const defaultSort: UserOverviewSort = {
  assigned: { by: 'createdDate', dir: 'desc' },
  completed: { by: 'completedDate', dir: 'desc' },
};

export function getDefaultUserOverviewSort(): UserOverviewSort {
  return {
    assigned: { ...defaultSort.assigned },
    completed: { ...defaultSort.completed },
  };
}

export function parseUserOverviewSort(raw: Record<string, unknown>): UserOverviewSort {
  const fallback = getDefaultUserOverviewSort();
  return {
    assigned: {
      by: parseSortBy(raw.assignedSortBy, assignedSortKeys) ?? fallback.assigned.by,
      dir: parseDirection(raw.assignedSortDir) ?? fallback.assigned.dir,
    },
    completed: {
      by: parseSortBy(raw.completedSortBy, completedSortKeys) ?? fallback.completed.by,
      dir: parseDirection(raw.completedSortDir) ?? fallback.completed.dir,
    },
  };
}
