import type { SelectOption } from '../viewModels/filterOptions';

type BuildSelectOptionInput = string | undefined | SelectOption;

function isSelectOption(value: BuildSelectOptionInput): value is SelectOption {
  return typeof value === 'object' && value !== null && 'value' in value && 'text' in value;
}

export function buildSelectOptions(
  values: BuildSelectOptionInput[],
  label: string,
  displayMap?: Record<string, string>
): SelectOption[] {
  const optionsMap = new Map<string, SelectOption>();

  values.forEach(item => {
    if (isSelectOption(item)) {
      if (!item.value) {
        return;
      }
      if (!optionsMap.has(item.value)) {
        optionsMap.set(item.value, item);
      }
      return;
    }
    if (!item) {
      return;
    }
    optionsMap.set(item, {
      value: item,
      text: displayMap && Object.prototype.hasOwnProperty.call(displayMap, item) ? displayMap[item] : item,
    });
  });

  const options = Array.from(optionsMap.values());
  options.sort((a, b) => a.text.localeCompare(b.text));
  return [{ value: '', text: `All ${label}` }, ...options];
}
