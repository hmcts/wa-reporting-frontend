import type { Request } from 'express';

import { getAjaxPartialTemplate, isAjaxRequest } from '../../../../main/modules/analytics/shared/partials';

describe('partials helpers', () => {
  test('detects ajax requests from headers', () => {
    const req = { get: jest.fn().mockReturnValue('fetch') } as unknown as Request;

    expect(isAjaxRequest(req)).toBe(true);
    expect(req.get).toHaveBeenCalledWith('X-Requested-With');
  });

  test('returns false when ajax header is missing', () => {
    const req = { get: jest.fn().mockReturnValue(undefined) } as unknown as Request;

    expect(isAjaxRequest(req)).toBe(false);
  });

  test('returns null when ajax section is missing', () => {
    const template = getAjaxPartialTemplate({
      source: {},
      partials: { section: 'analytics/partial' },
    });

    expect(template).toBeNull();
  });

  test('returns null when ajax section is not mapped', () => {
    const template = getAjaxPartialTemplate({
      source: { ajaxSection: 'missing' },
      partials: { section: 'analytics/partial' },
    });

    expect(template).toBeNull();
  });

  test('returns mapped template when ajax section matches', () => {
    const template = getAjaxPartialTemplate({
      source: { ajaxSection: 'section' },
      partials: { section: 'analytics/partial' },
    });

    expect(template).toBe('analytics/partial');
  });
});
