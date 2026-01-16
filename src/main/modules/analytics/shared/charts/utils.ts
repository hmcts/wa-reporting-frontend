export function truncateLabel(label: string, max = 50): string {
  if (label.length <= max) {
    return label;
  }
  return `${label.slice(0, max - 3)}...`;
}
