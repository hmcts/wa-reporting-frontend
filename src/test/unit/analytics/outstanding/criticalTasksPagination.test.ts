import {
  CRITICAL_TASKS_PAGE_SIZE,
  paginateCriticalTasks,
  parseCriticalTasksPage,
} from '../../../../main/modules/analytics/outstanding/criticalTasksPagination';

const buildTasks = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    caseId: `CASE-${index + 1}`,
    caseType: 'Type',
    location: 'Leeds',
    taskName: 'Review',
    createdDate: '2024-01-01',
    dueDate: '2024-01-02',
    priority: 'urgent' as const,
    agentName: 'Sam',
  }));

describe('criticalTasksPagination', () => {
  test('parseCriticalTasksPage defaults to 1 for invalid values', () => {
    expect(parseCriticalTasksPage(undefined)).toBe(1);
    expect(parseCriticalTasksPage('')).toBe(1);
    expect(parseCriticalTasksPage('0')).toBe(1);
    expect(parseCriticalTasksPage('-2')).toBe(1);
    expect(parseCriticalTasksPage('abc')).toBe(1);
    expect(parseCriticalTasksPage(['3'])).toBe(3);
  });

  test('paginateCriticalTasks builds pagination links for server-side data', () => {
    const tasks = buildTasks(500);
    const { pagedTasks, pagination } = paginateCriticalTasks({
      tasks,
      totalResults: 1200,
      filters: { service: ['Crime'], region: ['North'] },
      sort: { by: 'dueDate', dir: 'asc' },
      page: 2,
      pageSize: CRITICAL_TASKS_PAGE_SIZE,
      basePath: '/outstanding',
    });

    expect(pagedTasks).toHaveLength(500);
    expect(pagedTasks[0].caseId).toBe('CASE-1');
    expect(pagination.page).toBe(2);
    expect(pagination.totalPages).toBe(3);
    expect(pagination.startResult).toBe(501);
    expect(pagination.endResult).toBe(1000);
    expect(pagination.pagination.items[1].current).toBe(true);
    expect(pagination.pagination.previous?.href).toContain('criticalTasksPage=1');
    expect(pagination.pagination.next?.href).toContain('criticalTasksPage=3');
    expect(pagination.pagination.items[1].href).toContain('criticalTasksSortBy=dueDate');
    expect(pagination.pagination.items[1].href).toContain('service=Crime');
  });

  test('paginateCriticalTasks clamps out-of-range pages', () => {
    const tasks = buildTasks(10);
    const { pagination } = paginateCriticalTasks({
      tasks,
      totalResults: 10,
      filters: {},
      sort: { by: 'dueDate', dir: 'asc' },
      page: 99,
    });

    expect(pagination.page).toBe(1);
    expect(pagination.totalPages).toBe(1);
  });
});
