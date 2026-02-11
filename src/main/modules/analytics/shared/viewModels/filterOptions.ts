export type SelectOption = { value: string; text: string };

export type FilterOptionsViewModel = {
  serviceOptions: SelectOption[];
  roleCategoryOptions: SelectOption[];
  regionOptions: SelectOption[];
  locationOptions: SelectOption[];
  taskNameOptions: SelectOption[];
  workTypeOptions: SelectOption[];
  userOptions?: SelectOption[];
};

export function getUniqueOptions(values: (string | undefined)[], label: string): SelectOption[] {
  const unique = Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
  return [{ value: '', text: `All ${label}` }, ...unique.map(value => ({ value, text: value }))];
}

export function getUserOptions(tasks: { assigneeId?: string; assigneeName?: string }[]): SelectOption[] {
  const values = tasks.flatMap(task => [task.assigneeName, task.assigneeId].filter(Boolean) as string[]);
  return getUniqueOptions(values, 'users');
}
