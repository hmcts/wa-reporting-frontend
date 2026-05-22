import { AnalyticsFilters } from '../types';

export const SHARED_FILTER_KEYS = ['service', 'roleCategory', 'region', 'location', 'taskName', 'workType'] as const;

export function hasSelectedValues(values?: string[]): values is string[] {
  return Boolean(values && values.length > 0);
}

export function hasSelectedFilter(filters: AnalyticsFilters, keys: readonly (keyof AnalyticsFilters)[]): boolean {
  return keys.some(key => {
    const values = filters[key];
    return Array.isArray(values) && hasSelectedValues(values);
  });
}

export function hasActiveExcludeRoleCategories(values?: string[]): boolean {
  return Boolean(values?.some(value => value.trim().length > 0));
}
