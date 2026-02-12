import {
  MAX_PAGINATION_RESULTS,
  __testing,
  buildAnalyticsPaginationHref,
  buildPaginationMeta,
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
      basePath: '/users',
      filters: { service: ['Crime'], user: ['user-1'] },
      pageParam: 'assignedPage',
      page: 2,
      extraParams: { assignedSortBy: 'createdDate', assignedSortDir: 'asc' },
    });

    expect(href).toContain('/users?');
    expect(href).toContain('service=Crime');
    expect(href).toContain('workType=hearing-work-type');
    expect(href).toContain('user=user-1');
    expect(href).toContain('assignedSortBy=createdDate');
    expect(href).toContain('assignedSortDir=asc');
    expect(href).toContain('assignedPage=2');
  });

  test('buildAnalyticsPaginationHref skips empty filters and optional extras', () => {
    const href = buildAnalyticsPaginationHref({
      basePath: '/',
      filters: { service: [' ', 'Crime'], user: [''] },
      pageParam: 'page',
      page: 1,
    });

    expect(href).toContain('service=Crime');
    expect(href).not.toContain('user=');
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

  test('buildPaginationMeta uses total results for range calculations', () => {
    const pagination = buildPaginationMeta({
      totalResults: 25,
      page: 3,
      pageSize: 10,
      buildHref: page => `/items?page=${page}`,
      landmarkLabel: 'Items pagination',
    });

    expect(pagination.page).toBe(3);
    expect(pagination.totalPages).toBe(3);
    expect(pagination.startResult).toBe(21);
    expect(pagination.endResult).toBe(25);
    expect(pagination.pagination.next).toBeUndefined();
  });

  test('buildPaginationMeta caps total results for pagination metadata', () => {
    const pagination = buildPaginationMeta({
      totalResults: MAX_PAGINATION_RESULTS + 500,
      page: 10,
      pageSize: 500,
      buildHref: page => `/items?page=${page}`,
      landmarkLabel: 'Items pagination',
    });

    expect(pagination.totalResults).toBe(MAX_PAGINATION_RESULTS);
    expect(pagination.totalPages).toBe(10);
  });

  test('normalises pages and parses non-finite values', () => {
    expect(__testing.normalisePage(2, 0)).toBe(1);
    expect(__testing.parsePageValue(Number.NaN)).toBeUndefined();
    expect(__testing.parsePageValue([3])).toBe(3);
  });
});
