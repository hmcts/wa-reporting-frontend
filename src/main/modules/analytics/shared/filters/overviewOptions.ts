import { FilterOptions } from '../services/filterService';
export function emptyOverviewFilterOptions(): FilterOptions {
  return {
    services: [],
    roleCategories: [],
    regions: [],
    locations: [],
    taskNames: [],
    workTypes: [],
    users: [],
  };
}
