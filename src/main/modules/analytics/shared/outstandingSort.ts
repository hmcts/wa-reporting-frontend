import { SortState, parseDirection, parseSortBy } from './sort';

export type CriticalTasksSortBy =
  | 'caseId'
  | 'caseType'
  | 'location'
  | 'taskName'
  | 'createdDate'
  | 'dueDate'
  | 'priority'
  | 'agentName';

export type OutstandingSort = {
  criticalTasks: SortState<CriticalTasksSortBy>;
};

const criticalTasksSortKeys = new Set<CriticalTasksSortBy>([
  'caseId',
  'caseType',
  'location',
  'taskName',
  'createdDate',
  'dueDate',
  'priority',
  'agentName',
]);

const defaultSort: OutstandingSort = {
  criticalTasks: { by: 'dueDate', dir: 'asc' },
};

export function getDefaultOutstandingSort(): OutstandingSort {
  return {
    criticalTasks: { ...defaultSort.criticalTasks },
  };
}

export function parseOutstandingSort(raw: Record<string, unknown>): OutstandingSort {
  const fallback = getDefaultOutstandingSort();
  return {
    criticalTasks: {
      by: parseSortBy(raw.criticalTasksSortBy, criticalTasksSortKeys) ?? fallback.criticalTasks.by,
      dir: parseDirection(raw.criticalTasksSortDir) ?? fallback.criticalTasks.dir,
    },
  };
}
