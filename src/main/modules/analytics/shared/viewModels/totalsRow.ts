import { formatNumber } from '../formatting';

type TotalsValue = number | string;

export function buildTotalsRow(label: string, values: TotalsValue[]): { text: string }[] {
  return [
    { text: label },
    ...values.map(value => ({
      text: typeof value === 'number' ? formatNumber(value) : value,
    })),
  ];
}

export function buildTotalsRowWithLabelColumns(
  label: string,
  labelColumns: number,
  values: TotalsValue[],
  trailingBlanks = 0
): { text: string }[] {
  const prefix = Array.from({ length: Math.max(0, labelColumns - 1) }).map(() => ({ text: '' }));
  const blanks = Array.from({ length: Math.max(0, trailingBlanks) }).map(() => ({ text: '' }));
  return [
    { text: label },
    ...prefix,
    ...values.map(value => ({ text: typeof value === 'number' ? formatNumber(value) : value })),
    ...blanks,
  ];
}

export function buildTotalRow(values: TotalsValue[]): { text: string }[] {
  return buildTotalsRow('Total', values);
}

export function sumBy<T>(rows: T[], selector: (row: T) => number): number {
  return rows.reduce((total, row) => total + selector(row), 0);
}
