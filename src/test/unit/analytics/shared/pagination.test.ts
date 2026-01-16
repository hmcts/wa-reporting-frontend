import {
  buildAnalyticsPaginationHref,
  paginateRows,
  parsePageParam,
} from '../../../../main/modules/analytics/shared/pagination';

describe('pagination helpers', () => {
  test('parsePageParam defaults when input is invalid', () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam('0')).toBe(1);
    expect(parsePageParam('-2')).toBe(1);
    expect(parsePageParam('3')).toBe(3);
  });

  test('buildAnalyticsPaginationHref includes filters and extra params', () => {
    const href = buildAnalyticsPaginationHref({
      basePath: '/analytics/users',
      filters: { service: ['Crime'], user: ['user-1'] },
      pageParam: 'assignedPage',
      page: 2,
      extraParams: { assignedSortBy: 'createdDate', assignedSortDir: 'asc' },
    });

    expect(href).toContain('/analytics/users?');
    expect(href).toContain('service=Crime');
    expect(href).toContain('user=user-1');
    expect(href).toContain('assignedSortBy=createdDate');
    expect(href).toContain('assignedSortDir=asc');
    expect(href).toContain('assignedPage=2');
  });

  test('paginateRows slices rows and builds pagination metadata', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({ id: index + 1 }));
    const { pagedRows, pagination } = paginateRows({
      rows,
      page: 2,
      pageSize: 5,
      buildHref: page => `/items?page=${page}`,
      landmarkLabel: 'Items pagination',
    });

    expect(pagedRows).toHaveLength(5);
    expect(pagedRows[0].id).toBe(6);
    expect(pagination.totalPages).toBe(3);
    expect(pagination.startResult).toBe(6);
    expect(pagination.endResult).toBe(10);
    expect(pagination.pagination.items[1].current).toBe(true);
  });
});
