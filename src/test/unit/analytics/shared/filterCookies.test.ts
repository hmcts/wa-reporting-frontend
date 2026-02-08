import type { Request, Response } from 'express';

import {
  BASE_FILTER_KEYS,
  applyFilterCookie,
  applyFilterCookieFromConfig,
  buildFilterCookieOptions,
  decodeFilterCookie,
  encodeFilterCookie,
  getFilterCookieContext,
  hasFilters,
  pickFilters,
} from '../../../../main/modules/analytics/shared/filterCookies';
import { AnalyticsFilters } from '../../../../main/modules/analytics/shared/types';

jest.mock('config', () => ({
  get: jest.fn((key: string) => {
    if (key === 'analytics.filtersCookieName') {
      return 'analytics-filters';
    }
    if (key === 'analytics.filtersCookieMaxAgeDays') {
      return 30;
    }
    throw new Error(`Unknown config key: ${key}`);
  }),
}));

describe('filterCookies', () => {
  const cookieName = 'analytics-filters';
  const cookieOptions = buildFilterCookieOptions(86_400_000, false);
  const baseKeys: (keyof AnalyticsFilters)[] = [...BASE_FILTER_KEYS];

  test('encodes and decodes filters with dates', () => {
    const filters: AnalyticsFilters = {
      service: ['Civil'],
      region: ['North'],
      completedFrom: new Date('2026-01-01T00:00:00.000Z'),
      completedTo: new Date('2026-01-31T00:00:00.000Z'),
    };

    const encoded = encodeFilterCookie(filters);
    expect(encoded).not.toBeNull();

    const decoded = decodeFilterCookie(encoded ?? undefined);
    expect(decoded.service).toEqual(['Civil']);
    expect(decoded.region).toEqual(['North']);
    expect(decoded.completedFrom?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(decoded.completedTo?.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  test('returns null when encoding empty filters', () => {
    expect(encodeFilterCookie({})).toBeNull();
  });

  test('returns null when encoded payload exceeds cookie size', () => {
    const oversized = 'x'.repeat(5000);
    const encoded = encodeFilterCookie({ service: [oversized] });
    expect(encoded).toBeNull();
  });

  test('encodes and decodes additional array filters', () => {
    const filters: AnalyticsFilters = {
      roleCategory: ['Legal'],
      region: ['South'],
      location: ['London'],
      taskName: ['Review'],
      user: ['user-1'],
    };

    const encoded = encodeFilterCookie(filters);
    const decoded = decodeFilterCookie(encoded ?? undefined);
    expect(decoded.roleCategory).toEqual(['Legal']);
    expect(decoded.region).toEqual(['South']);
    expect(decoded.location).toEqual(['London']);
    expect(decoded.taskName).toEqual(['Review']);
    expect(decoded.user).toEqual(['user-1']);
  });

  test('picks only allowed filter keys', () => {
    const filters: AnalyticsFilters = {
      service: ['Civil'],
      user: ['user-1'],
      completedFrom: new Date('2026-01-01T00:00:00.000Z'),
    };

    const picked = pickFilters(filters, baseKeys);
    expect(picked).toEqual({ service: ['Civil'] });
  });

  test('picks date filters when allowed', () => {
    const filters: AnalyticsFilters = {
      completedFrom: new Date('2026-01-01T00:00:00.000Z'),
      completedTo: new Date('2026-01-31T00:00:00.000Z'),
    };

    const picked = pickFilters(filters, ['completedFrom', 'completedTo']);
    expect(picked.completedFrom?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(picked.completedTo?.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  test('does not pick missing date filters', () => {
    const filters: AnalyticsFilters = {};
    const picked = pickFilters(filters, ['completedFrom']);
    expect(picked).toEqual({});
  });

  test('detects when filters have values', () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ service: ['Civil'] })).toBe(true);
    expect(hasFilters({ completedFrom: new Date('2026-01-01T00:00:00.000Z') })).toBe(true);
  });

  test('decodes empty and invalid cookie values', () => {
    expect(decodeFilterCookie(undefined)).toEqual({});
    expect(decodeFilterCookie('not-json')).toEqual({});
    const badVersion = Buffer.from(JSON.stringify({ v: 99 }), 'utf8').toString('base64url');
    expect(decodeFilterCookie(badVersion)).toEqual({});
  });

  test('applyFilterCookie clears cookie on reset', () => {
    const req = { method: 'GET', signedCookies: {} } as unknown as Request;
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

    const filters = applyFilterCookie({
      req,
      res,
      source: { resetFilters: '1' },
      allowedKeys: baseKeys,
      cookieName,
      cookieOptions,
    });

    expect(filters).toEqual({});
    expect(res.clearCookie).toHaveBeenCalledWith(cookieName, cookieOptions);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  test('applyFilterCookie writes cookie when request supplies filters', () => {
    const req = { method: 'POST', signedCookies: {} } as unknown as Request;
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

    const filters = applyFilterCookie({
      req,
      res,
      source: { service: 'Crime' },
      allowedKeys: baseKeys,
      cookieName,
      cookieOptions,
    });

    expect(filters).toEqual({ service: ['Crime'] });
    expect(res.cookie).toHaveBeenCalled();
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  test('applyFilterCookie clears cookie for empty filter form submission', () => {
    const req = { method: 'POST', signedCookies: {} } as unknown as Request;
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

    const filters = applyFilterCookie({
      req,
      res,
      source: {},
      allowedKeys: baseKeys,
      cookieName,
      cookieOptions,
    });

    expect(filters).toEqual({});
    expect(res.clearCookie).toHaveBeenCalledWith(cookieName, cookieOptions);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  test('applyFilterCookie clears cookie when encoding fails', () => {
    const oversized = 'x'.repeat(5000);
    const req = { method: 'POST', signedCookies: {} } as unknown as Request;
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

    const filters = applyFilterCookie({
      req,
      res,
      source: { service: oversized },
      allowedKeys: baseKeys,
      cookieName,
      cookieOptions,
    });

    expect(filters).toEqual({ service: [oversized] });
    expect(res.clearCookie).toHaveBeenCalledWith(cookieName, cookieOptions);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  test('applyFilterCookie uses stored cookie when no request filters', () => {
    const encoded = encodeFilterCookie({ service: ['Civil'] }) ?? '';
    const req = { method: 'GET', signedCookies: { [cookieName]: encoded } } as unknown as Request;
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

    const filters = applyFilterCookie({
      req,
      res,
      source: {},
      allowedKeys: baseKeys,
      cookieName,
      cookieOptions,
    });

    expect(filters).toEqual({ service: ['Civil'] });
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  test('applyFilterCookie ignores non-string signed cookie values', () => {
    const req = { method: 'GET', signedCookies: { [cookieName]: 123 } } as unknown as Request;
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

    const filters = applyFilterCookie({
      req,
      res,
      source: {},
      allowedKeys: baseKeys,
      cookieName,
      cookieOptions,
    });

    expect(filters).toEqual({});
  });

  test('applyFilterCookie does not clear cookie for ajax submissions without filters', () => {
    const encoded = encodeFilterCookie({ service: ['Civil'] }) ?? '';
    const req = { method: 'POST', signedCookies: { [cookieName]: encoded } } as unknown as Request;
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

    const filters = applyFilterCookie({
      req,
      res,
      source: { ajaxSection: 'overview-task-events' },
      allowedKeys: baseKeys,
      cookieName,
      cookieOptions,
    });

    expect(filters).toEqual({ service: ['Civil'] });
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  test('getFilterCookieContext uses configured name and age', () => {
    const context = getFilterCookieContext();
    expect(context.cookieName).toBe('analytics-filters');
    expect(context.cookieOptions.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
    expect(context.cookieOptions.signed).toBe(true);
  });

  test('applyFilterCookieFromConfig writes cookie using configured options', () => {
    const req = { method: 'POST', signedCookies: {} } as unknown as Request;
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

    const filters = applyFilterCookieFromConfig({
      req,
      res,
      source: { service: 'Civil' },
      allowedKeys: baseKeys,
    });

    expect(filters).toEqual({ service: ['Civil'] });
    expect(res.cookie).toHaveBeenCalledWith(
      'analytics-filters',
      expect.any(String),
      expect.objectContaining({ maxAge: 30 * 24 * 60 * 60 * 1000 })
    );
  });
});
