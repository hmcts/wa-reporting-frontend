import { AnalyticsFilters } from './types';

type PaginationItem = {
  number: string;
  href: string;
  current?: boolean;
};

export type PaginationNav = {
  items: PaginationItem[];
  previous?: { href: string };
  next?: { href: string };
  landmarkLabel: string;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
  startResult: number;
  endResult: number;
  show: boolean;
  pagination: PaginationNav;
};

type PaginateRowsParams<T> = {
  rows: T[];
  page: number;
  pageSize: number;
  buildHref: (page: number) => string;
  landmarkLabel: string;
};

type PaginationHrefParams = {
  basePath: string;
  filters: AnalyticsFilters;
  pageParam: string;
  page: number;
  extraParams?: Record<string, string>;
};

export const MAX_PAGINATION_RESULTS = 5000;

const DEFAULT_PAGE = 1;

export function normalisePage(value: number, totalPages: number): number {
  if (totalPages <= 0) {
    return DEFAULT_PAGE;
  }
  return Math.min(Math.max(value, DEFAULT_PAGE), totalPages);
}

function parsePageValue(value: unknown): number | undefined {
  if (Array.isArray(value)) {
    return parsePageValue(value[0]);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.floor(value) : undefined;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return undefined;
    }
    return parsed;
  }
  return undefined;
}

export function parsePageParam(raw: unknown, defaultPage = DEFAULT_PAGE): number {
  const parsed = parsePageValue(raw);
  if (!parsed || parsed < defaultPage) {
    return defaultPage;
  }
  return parsed;
}

function appendArray(params: URLSearchParams, key: string, values?: string[]): void {
  if (!values || values.length === 0) {
    return;
  }
  values.forEach(value => {
    if (value.trim().length > 0) {
      params.append(key, value);
    }
  });
}

function formatDate(value: Date | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.toISOString().slice(0, 10);
}

function appendDate(params: URLSearchParams, key: string, value: Date | undefined): void {
  const formatted = formatDate(value);
  if (formatted) {
    params.set(key, formatted);
  }
}

function buildAnalyticsQueryParams(filters: AnalyticsFilters, extraParams?: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  appendArray(params, 'service', filters.service);
  appendArray(params, 'roleCategory', filters.roleCategory);
  appendArray(params, 'region', filters.region);
  appendArray(params, 'location', filters.location);
  appendArray(params, 'taskName', filters.taskName);
  appendArray(params, 'user', filters.user);
  appendDate(params, 'completedFrom', filters.completedFrom);
  appendDate(params, 'completedTo', filters.completedTo);
  appendDate(params, 'eventsFrom', filters.eventsFrom);
  appendDate(params, 'eventsTo', filters.eventsTo);
  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      params.set(key, value);
    });
  }
  return params;
}

export function buildAnalyticsPaginationHref({
  basePath,
  filters,
  pageParam,
  page,
  extraParams,
}: PaginationHrefParams): string {
  const params = buildAnalyticsQueryParams(filters, extraParams);
  params.set(pageParam, page.toString());
  const query = params.toString();
  return query.length > 0 ? `${basePath}?${query}` : basePath;
}

function buildPaginationItems(
  totalPages: number,
  currentPage: number,
  buildHref: (page: number) => string
): PaginationItem[] {
  return Array.from({ length: totalPages }, (_, index) => {
    const pageNumber = index + 1;
    return {
      number: pageNumber.toString(),
      href: buildHref(pageNumber),
      current: pageNumber === currentPage || undefined,
    };
  });
}

export function buildPaginationMeta(params: {
  totalResults: number;
  page: number;
  pageSize: number;
  buildHref: (page: number) => string;
  landmarkLabel: string;
}): PaginationMeta {
  const { totalResults, page, pageSize, buildHref, landmarkLabel } = params;
  const cappedTotalResults = Math.min(totalResults, MAX_PAGINATION_RESULTS);
  const totalPages = Math.max(1, Math.ceil(cappedTotalResults / pageSize));
  const currentPage = normalisePage(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(cappedTotalResults, startIndex + pageSize);
  const startResult = cappedTotalResults === 0 ? 0 : startIndex + 1;
  const endResult = cappedTotalResults === 0 ? 0 : endIndex;
  const show = totalPages > 1;
  const paginationItems = buildPaginationItems(totalPages, currentPage, buildHref);

  return {
    page: currentPage,
    pageSize,
    totalResults: cappedTotalResults,
    totalPages,
    startResult,
    endResult,
    show,
    pagination: {
      items: paginationItems,
      previous: currentPage > 1 ? { href: buildHref(currentPage - 1) } : undefined,
      next: currentPage < totalPages ? { href: buildHref(currentPage + 1) } : undefined,
      landmarkLabel,
    },
  };
}

export function paginateRows<T>({ rows, page, pageSize, buildHref, landmarkLabel }: PaginateRowsParams<T>): {
  pagedRows: T[];
  pagination: PaginationMeta;
} {
  const pagination = buildPaginationMeta({
    totalResults: rows.length,
    page,
    pageSize,
    buildHref,
    landmarkLabel,
  });
  const startIndex = (pagination.page - 1) * pageSize;
  const endIndex = Math.min(rows.length, startIndex + pageSize);

  return {
    pagedRows: rows.slice(startIndex, endIndex),
    pagination,
  };
}

export const __testing = {
  normalisePage,
  parsePageValue,
};
