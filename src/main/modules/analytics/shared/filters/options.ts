import type { SelectOption } from '../viewModels/filterOptions';

export function buildSelectOptions(
  values: (string | undefined)[],
  label: string,
  displayMap?: Record<string, string>
): SelectOption[] {
  const unique = Array.from(new Set(values.filter(Boolean) as string[]));
  const options = unique.map(value => ({
    value,
    text: displayMap && Object.prototype.hasOwnProperty.call(displayMap, value) ? displayMap[value] : value,
  }));
  options.sort((a, b) => a.text.localeCompare(b.text));
  return [{ value: '', text: `All ${label}` }, ...options];
}
