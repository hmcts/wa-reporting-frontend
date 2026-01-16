import { FilterOptions } from '../services/filterService';
import { Task } from '../types';
import type { FilterOptionsViewModel } from '../viewModels/filterOptions';

import { buildSelectOptions } from './options';

type FilterTask = Pick<Task, 'service' | 'roleCategory' | 'region' | 'location' | 'taskName'>;

export function buildFilterOptionsViewModel(
  filterOptions: FilterOptions,
  allTasks: FilterTask[]
): FilterOptionsViewModel {
  return {
    serviceOptions: buildSelectOptions(
      filterOptions.services.length > 0 ? filterOptions.services : allTasks.map(task => task.service),
      'services'
    ),
    roleCategoryOptions: buildSelectOptions(
      filterOptions.roleCategories.length > 0 ? filterOptions.roleCategories : allTasks.map(task => task.roleCategory),
      'role categories'
    ),
    regionOptions:
      filterOptions.regions.length > 0
        ? filterOptions.regions
        : buildSelectOptions(
            allTasks.map(task => task.region),
            'regions'
          ),
    locationOptions:
      filterOptions.locations.length > 0
        ? filterOptions.locations
        : buildSelectOptions(
            allTasks.map(task => task.location),
            'locations'
          ),
    taskNameOptions: buildSelectOptions(
      filterOptions.taskNames.length > 0 ? filterOptions.taskNames : allTasks.map(task => task.taskName),
      'task names'
    ),
  };
}
