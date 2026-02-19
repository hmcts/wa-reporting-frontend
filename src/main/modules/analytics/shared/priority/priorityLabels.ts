export const priorityLabelMap = {
  Urgent: 'urgent',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
} as const;

export const priorityDisplayLabels = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
} as const;

type PriorityKey = keyof typeof priorityDisplayLabels;

export function toPriorityKey(label: string): PriorityKey | undefined {
  return priorityLabelMap[label as keyof typeof priorityLabelMap];
}

export function displayPriorityLabel(key: PriorityKey): string {
  return priorityDisplayLabels[key];
}

function isPriorityKey(value: string): value is PriorityKey {
  return value in priorityDisplayLabels;
}

export function toDisplayPriorityLabel(value: string): string {
  const key = value.trim().toLowerCase();
  if (!isPriorityKey(key)) {
    return value;
  }
  return displayPriorityLabel(key);
}
