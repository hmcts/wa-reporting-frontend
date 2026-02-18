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

export function formatDatePickerValue(date?: Date): string {
  if (!date) {
    return '';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

export function formatUkDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London',
    timeZoneName: 'short',
  }).format(date);
}

export function buildFreshnessInsetText(publishedAt?: Date): string {
  if (!publishedAt) {
    return 'Data freshness unavailable.';
  }
  return `Data last refreshed: ${formatUkDateTime(publishedAt)}.`;
}
