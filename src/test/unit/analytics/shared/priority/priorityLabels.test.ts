import {
  displayPriorityLabel,
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
});
