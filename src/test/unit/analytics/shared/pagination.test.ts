import {
  MAX_PAGINATION_RESULTS,
  __testing,
  buildAnalyticsPaginationHref,
  buildPaginationMeta,
  getCappedTotalPages,
  getCappedTotalResults,
  getMaxPaginationPage,
  paginateRows,
  parsePageParam,
} from '../../../../main/modules/analytics/shared/pagination';

describe('pagination helpers', () => {
  test('parsePageParam defaults when input is invalid', () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam('0')).toBe(1);
    expect(parsePageParam('-2')).toBe(1);
    expect(parsePageParam('2.9')).toBe(2);
    expect(parsePageParam(['4'])).toBe(4);
    expect(parsePageParam('5', 3)).toBe(5);
    expect(parsePageParam('2', 3)).toBe(3);
    expect(parsePageParam(Number.POSITIVE_INFINITY)).toBe(1);
    expect(parsePageParam('3')).toBe(3);
  });

  test('buildAnalyticsPaginationHref includes filters and extra params', () => {
    const href = buildAnalyticsPaginationHref({
      basePath: '/users',
      filters: { service: ['Crime'], workType: ['hearing-work-type'], user: ['user-1'] },
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
    expect(href).not.toContain('service=+');
    expect(href).not.toContain('service=%20');
  });

  test('buildAnalyticsPaginationHref includes all supported array filter keys', () => {
    const href = buildAnalyticsPaginationHref({
      basePath: '/overview',
      filters: {
        roleCategory: ['Legal'],
        region: ['North'],
        location: ['Leeds'],
        taskName: ['Review'],
      },
      pageParam: 'page',
      page: 4,
    });
    const url = new URL(`https://example.test${href}`);

    expect(url.searchParams.get('roleCategory')).toBe('Legal');
    expect(url.searchParams.get('region')).toBe('North');
    expect(url.searchParams.get('location')).toBe('Leeds');
    expect(url.searchParams.get('taskName')).toBe('Review');
    expect(url.searchParams.get('page')).toBe('4');
  });

  test('buildAnalyticsPaginationHref handles completely empty filters safely', () => {
    const href = buildAnalyticsPaginationHref({
      basePath: '/outstanding',
      filters: {},
      pageParam: 'criticalTasksPage',
      page: 1,
    });
    const url = new URL(`https://example.test${href}`);

    expect(url.pathname).toBe('/outstanding');
    expect(url.searchParams.get('criticalTasksPage')).toBe('1');
    expect(url.searchParams.get('service')).toBeNull();
  });

  test('buildAnalyticsPaginationHref carries date filters in YYYY-MM-DD format', () => {
    const href = buildAnalyticsPaginationHref({
      basePath: '/completed',
      filters: {
        completedFrom: new Date('2024-01-01T10:30:00.000Z'),
        completedTo: new Date('2024-01-31T00:00:00.000Z'),
        eventsFrom: new Date('2024-02-01T00:00:00.000Z'),
        eventsTo: new Date('2024-02-29T00:00:00.000Z'),
      },
      pageParam: 'completedPage',
      page: 3,
    });

    const url = new URL(`https://example.test${href}`);

    expect(url.searchParams.get('completedFrom')).toBe('2024-01-01');
    expect(url.searchParams.get('completedTo')).toBe('2024-01-31');
    expect(url.searchParams.get('eventsFrom')).toBe('2024-02-01');
    expect(url.searchParams.get('eventsTo')).toBe('2024-02-29');
    expect(url.searchParams.get('completedPage')).toBe('3');
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
    expect(pagination.show).toBe(true);
    expect(pagination.pagination.previous).toEqual({ href: '/items?page=1' });
    expect(pagination.pagination.next).toEqual({ href: '/items?page=3' });
    expect(pagination.pagination.items[0]).toEqual({
      number: '1',
      href: '/items?page=1',
      current: undefined,
    });
    expect(pagination.pagination.items[1]).toEqual({
      number: '2',
      href: '/items?page=2',
      current: true,
    });
    expect(pagination.pagination.items[2]).toEqual({
      number: '3',
      href: '/items?page=3',
      current: undefined,
    });
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
    expect(pagination.pagination.previous).toEqual({ href: '/items?page=2' });
    expect(pagination.pagination.next).toBeUndefined();
  });

  test('buildPaginationMeta handles empty total results', () => {
    const pagination = buildPaginationMeta({
      totalResults: 0,
      page: 4,
      pageSize: 10,
      buildHref: page => `/items?page=${page}`,
      landmarkLabel: 'Items pagination',
    });

    expect(pagination.page).toBe(1);
    expect(pagination.totalPages).toBe(1);
    expect(pagination.startResult).toBe(0);
    expect(pagination.endResult).toBe(0);
    expect(pagination.show).toBe(false);
    expect(pagination.pagination.previous).toBeUndefined();
    expect(pagination.pagination.next).toBeUndefined();
    expect(pagination.pagination.items).toEqual([{ number: '1', href: '/items?page=1', current: true }]);
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

  test('getCappedTotalPages applies MAX_PAGINATION_RESULTS cap', () => {
    expect(getCappedTotalPages(MAX_PAGINATION_RESULTS + 1500, 500)).toBe(10);
    expect(getCappedTotalPages(1500, 500)).toBe(3);
    expect(getCappedTotalPages(0, 500)).toBe(1);
  });

  test('getCappedTotalResults returns zero for invalid totals', () => {
    expect(getCappedTotalResults(Number.NaN)).toBe(0);
    expect(getCappedTotalResults(Number.POSITIVE_INFINITY)).toBe(0);
    expect(getCappedTotalResults(-1)).toBe(0);
  });

  test('getMaxPaginationPage limits pages for a page size', () => {
    expect(getMaxPaginationPage(500)).toBe(10);
    expect(getMaxPaginationPage(1)).toBe(MAX_PAGINATION_RESULTS);
    expect(getMaxPaginationPage(MAX_PAGINATION_RESULTS + 1)).toBe(1);
  });

  test('buildPaginationMeta normalises non-finite page size to minimum', () => {
    const pagination = buildPaginationMeta({
      totalResults: 2,
      page: 1,
      pageSize: Number.NaN,
      buildHref: page => `/items?page=${page}`,
      landmarkLabel: 'Items pagination',
    });

    expect(pagination.pageSize).toBe(1);
    expect(pagination.totalPages).toBe(2);
  });

  test('normalises pages and parses non-finite values', () => {
    expect(__testing.normalisePage(2, 0)).toBe(1);
    expect(__testing.normalisePage(-1, 4)).toBe(1);
    expect(__testing.normalisePage(9, 4)).toBe(4);
    expect(__testing.parsePageValue(Number.NaN)).toBeUndefined();
    expect(__testing.parsePageValue([3])).toBe(3);
    expect(__testing.parsePageValue('not-a-number')).toBeUndefined();
  });
});
