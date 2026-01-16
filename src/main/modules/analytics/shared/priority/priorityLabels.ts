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
