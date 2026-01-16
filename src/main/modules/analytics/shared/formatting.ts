export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return `${value ?? ''}`;
  }
  return new Intl.NumberFormat('en-GB', options).format(value);
}

export function formatPercent(value: number, options: Intl.NumberFormatOptions = {}, zeroFormat = '0%'): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) {
    return zeroFormat;
  }
  return `${formatNumber(value, options)}%`;
}

export function buildDateParts(date?: Date): { day: string; month: string; year: string } {
  if (!date) {
    return { day: '', month: '', year: '' };
  }
  return {
    day: `${date.getDate()}`,
    month: `${date.getMonth() + 1}`,
    year: `${date.getFullYear()}`,
  };
}
