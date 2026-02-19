import {
  displayPriorityLabel,
  toDisplayPriorityLabel,
  toPriorityKey,
} from '../../../../../main/modules/analytics/shared/priority/priorityLabels';

describe('priorityLabels helpers', () => {
  test('toPriorityKey maps display labels to internal keys', () => {
    expect(toPriorityKey('Urgent')).toBe('urgent');
    expect(toPriorityKey('High')).toBe('high');
    expect(toPriorityKey('Medium')).toBe('medium');
    expect(toPriorityKey('Low')).toBe('low');
  });

  test('toPriorityKey returns undefined for unknown labels', () => {
    expect(toPriorityKey('Unknown')).toBeUndefined();
  });

  test('displayPriorityLabel maps internal keys to display labels', () => {
    expect(displayPriorityLabel('urgent')).toBe('Urgent');
    expect(displayPriorityLabel('high')).toBe('High');
    expect(displayPriorityLabel('medium')).toBe('Medium');
    expect(displayPriorityLabel('low')).toBe('Low');
  });

  test('toDisplayPriorityLabel maps lowercase keys to sentence case labels', () => {
    expect(toDisplayPriorityLabel('urgent')).toBe('Urgent');
    expect(toDisplayPriorityLabel('high')).toBe('High');
    expect(toDisplayPriorityLabel('medium')).toBe('Medium');
    expect(toDisplayPriorityLabel('low')).toBe('Low');
  });

  test('toDisplayPriorityLabel falls back to the raw value for unknown labels', () => {
    expect(toDisplayPriorityLabel('something-else')).toBe('something-else');
    expect(toDisplayPriorityLabel('')).toBe('');
  });
});
