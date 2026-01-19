import {
  USER_OVERVIEW_PAGE_SIZE,
  paginateAssignedTasks,
  paginateCompletedTasks,
  parseAssignedPage,
  parseCompletedPage,
} from '../../../../main/modules/analytics/userOverview/pagination';

describe('user overview pagination', () => {
  test('parses assigned and completed page params', () => {
    expect(parseAssignedPage('3')).toBe(3);
    expect(parseCompletedPage(undefined)).toBe(1);
  });

  test('paginates assigned tasks with sort parameters', () => {
    const rows = ['a', 'b', 'c'];
    const { pagedRows, pagination } = paginateAssignedTasks({
      rows,
      filters: { service: ['Service A'] },
      sort: { by: 'assignee', dir: 'asc' },
      page: 1,
      pageSize: 2,
    });

    expect(pagedRows).toEqual(['a', 'b']);
    expect(pagination.pageSize).toBe(2);
    expect(pagination.pagination.items[0]?.href).toContain('assignedSortBy=assignee');
    expect(pagination.pagination.items[0]?.href).toContain('assignedSortDir=asc');
  });

  test('paginates completed tasks using default page size', () => {
    const rows = Array.from({ length: USER_OVERVIEW_PAGE_SIZE + 1 }, (_, index) => `row-${index + 1}`);
    const { pagination } = paginateCompletedTasks({
      rows,
      filters: {},
      sort: { by: 'completedDate', dir: 'desc' },
      page: 2,
    });

    expect(pagination.page).toBe(2);
    expect(pagination.totalPages).toBe(2);
    expect(pagination.pagination.items[1]?.href).toContain('completedSortBy=completedDate');
    expect(pagination.pagination.items[1]?.href).toContain('completedSortDir=desc');
  });
});
