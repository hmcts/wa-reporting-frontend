import {
  buildDateParts,
  buildFreshnessInsetText,
  formatDatePickerValue,
  formatNumber,
  formatPercent,
  formatUkDateTime,
} from '../../../../main/modules/analytics/shared/formatting';

describe('formatNumber', () => {
  test('formats numeric values using en-GB', () => {
    expect(formatNumber(1200)).toBe('1,200');
    expect(formatNumber(12.345, { maximumFractionDigits: 1 })).toBe('12.3');
  });

  test('returns fallback for non-numbers', () => {
    expect(formatNumber(Number.NaN)).toBe('NaN');
    expect(formatNumber(undefined as unknown as number)).toBe('');
  });
});

describe('formatPercent', () => {
  test('formats percentage values', () => {
    expect(formatPercent(12.345, { maximumFractionDigits: 1 })).toBe('12.3%');
  });

  test('returns zero format for invalid numbers', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(Number.NaN)).toBe('0%');
  });
});

describe('buildDateParts', () => {
  test('formats date parts', () => {
    expect(buildDateParts(new Date('2024-01-05'))).toEqual({ day: '5', month: '1', year: '2024' });
  });

  test('returns empty strings when no date provided', () => {
    expect(buildDateParts()).toEqual({ day: '', month: '', year: '' });
  });
});

describe('formatDatePickerValue', () => {
  test('formats date for picker values', () => {
    expect(formatDatePickerValue(new Date('2024-01-05'))).toBe('05/01/2024');
  });

  test('returns empty string when no date provided', () => {
    expect(formatDatePickerValue()).toBe('');
  });
});

describe('formatUkDateTime', () => {
  test('formats date/time in UK local time', () => {
    expect(formatUkDateTime(new Date('2026-02-17T10:15:00Z'))).toBe('17 February 2026 at 10:15 GMT');
  });
});

describe('buildFreshnessInsetText', () => {
  test('builds freshness text from a published timestamp', () => {
    expect(buildFreshnessInsetText(new Date('2026-02-17T10:15:00Z'))).toBe(
      'Data last refreshed: 17 February 2026 at 10:15 GMT.'
    );
  });

  test('returns fallback text when no timestamp is provided', () => {
    expect(buildFreshnessInsetText()).toBe('Data freshness unavailable.');
  });
});
