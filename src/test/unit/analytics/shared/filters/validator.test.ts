import { validateFilters } from '../../../../../main/modules/analytics/shared/filters/validator';

describe('validateFilters', () => {
  test('returns parsed filters for valid values', () => {
    const result = validateFilters({
      service: 'Probate ',
      roleCategory: 'Admin',
      workType: ['Task'],
      completedFrom: '2024-01-01',
      completedTo: '2024-01-31',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.filters.service).toEqual(['Probate ']);
    expect(result.filters.roleCategory).toEqual(['Admin']);
    expect(result.filters.workType).toEqual(['Task']);
    expect(result.filters.completedFrom).toBeInstanceOf(Date);
    expect(result.filters.completedTo).toBeInstanceOf(Date);
  });

  test('parses dd/mm/yyyy date picker values', () => {
    const result = validateFilters({
      completedFrom: '05/02/2024',
      completedTo: '15/02/2024',
      eventsFrom: '1/3/2024',
      eventsTo: '2/3/2024',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.filters.completedFrom).toBeInstanceOf(Date);
    expect(result.filters.completedTo).toBeInstanceOf(Date);
    expect(result.filters.eventsFrom).toBeInstanceOf(Date);
    expect(result.filters.eventsTo).toBeInstanceOf(Date);
  });

  test('flags invalid dates', () => {
    const result = validateFilters({
      completedFrom: 'not-a-date',
    });

    expect(result.errors).toContain('completedFrom must be a valid date');
  });

  test('flags invalid dd/mm/yyyy values', () => {
    const result = validateFilters({
      completedFrom: '31/02/2024',
    });

    expect(result.errors).toContain('completedFrom must be a valid date');
  });

  test('flags inverted ranges', () => {
    const result = validateFilters({
      completedFrom: '2024-02-01',
      completedTo: '2024-01-01',
    });

    expect(result.errors).toContain('completedFrom must be before completedTo');
  });

  test('parses date parts and rejects incomplete date parts', () => {
    const valid = validateFilters({
      'completedFrom-day': '5',
      'completedFrom-month': '2',
      'completedFrom-year': '2024',
    });
    expect(valid.errors).toHaveLength(0);
    expect(valid.filters.completedFrom).toBeInstanceOf(Date);

    const invalid = validateFilters({
      completedTo: 'bad-date',
    });
    expect(invalid.errors).toContain('completedTo must be a valid date');
  });

  test('ignores empty strings for optional filters', () => {
    const result = validateFilters({
      service: '   ',
      user: '',
      roleCategory: 123,
      completedFrom: '   ',
    });

    expect(result.filters.service).toBeUndefined();
    expect(result.filters.user).toBeUndefined();
    expect(result.filters.roleCategory).toBeUndefined();
    expect(result.filters.completedFrom).toBeUndefined();
    expect(result.errors).toHaveLength(0);
  });

  test('ignores incomplete date parts without crashing', () => {
    const result = validateFilters({
      'completedFrom-day': '1',
      'completedFrom-year': '2024',
    });

    expect(result.filters.completedFrom).toBeUndefined();
    expect(result.errors).toHaveLength(0);
  });

  test('dedupes array values and parses events date parts', () => {
    const result = validateFilters({
      service: ['Probate', 'Probate', ' ', 123],
      eventsFrom: '2024-03-01',
      eventsTo: '2024-03-02',
      'eventsFrom-day': '1',
      'eventsFrom-month': '3',
      'eventsFrom-year': '2024',
      'eventsTo-day': '2',
      'eventsTo-month': '3',
      'eventsTo-year': '2024',
    });

    expect(result.filters.service).toEqual(['Probate']);
    expect(result.filters.eventsFrom).toBeInstanceOf(Date);
    expect(result.filters.eventsTo).toBeInstanceOf(Date);
    expect(result.errors).toHaveLength(0);
  });

  test('handles empty array filters and date parts without raw values', () => {
    const result = validateFilters({
      service: ['  ', ''],
      'completedTo-day': '15',
      'completedTo-month': '4',
      'completedTo-year': '2024',
      'eventsFrom-day': '10',
      'eventsFrom-month': '5',
      'eventsFrom-year': '2024',
      'eventsTo-day': '12',
      'eventsTo-month': '5',
      'eventsTo-year': '2024',
    });

    expect(result.filters.service).toBeUndefined();
    expect(result.filters.completedTo).toBeInstanceOf(Date);
    expect(result.filters.eventsFrom).toBeInstanceOf(Date);
    expect(result.filters.eventsTo).toBeInstanceOf(Date);
    expect(result.errors).toHaveLength(0);
  });

  test('flags invalid and inverted events ranges', () => {
    const invalid = validateFilters({
      eventsFrom: 'not-a-date',
      eventsTo: 'not-a-date',
    });

    expect(invalid.errors).toContain('eventsFrom must be a valid date');
    expect(invalid.errors).toContain('eventsTo must be a valid date');

    const inverted = validateFilters({
      eventsFrom: '2024-04-10',
      eventsTo: '2024-04-01',
    });

    expect(inverted.errors).toContain('eventsFrom must be before eventsTo');
  });

  test('flags invalid date parts when provided', () => {
    const invalid = validateFilters({
      'eventsFrom-day': 'aa',
      'eventsFrom-month': '02',
      'eventsFrom-year': '2024',
    });

    expect(invalid.filters.eventsFrom).toBeUndefined();
    expect(invalid.errors).toHaveLength(0);
  });
});
