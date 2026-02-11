import { CacheKeys, getCache, setCache } from '../cache/cache';
import { taskFactsRepository } from '../repositories';
import type { CaseWorkerProfileRow } from '../repositories';
import type { SelectOption } from '../viewModels/filterOptions';

import { caseWorkerProfileService, courtVenueService, regionService } from './index';

export type FilterOptions = {
  services: string[];
  roleCategories: string[];
  regions: SelectOption[];
  locations: SelectOption[];
  taskNames: string[];
  workTypes: SelectOption[];
  users: SelectOption[];
};

const compareByText = (a: SelectOption, b: SelectOption) => a.text.localeCompare(b.text);

function buildUserOptions(assigneeIds: string[], profiles: CaseWorkerProfileRow[]): SelectOption[] {
  const normalisedAssignees = new Set(assigneeIds);
  const options = profiles
    .filter(profile => normalisedAssignees.has(profile.case_worker_id))
    .map(profile => {
      const fullName = [profile.first_name, profile.last_name].join(' ');
      const displayName = `${fullName} (${profile.email_id})`;
      return { value: profile.case_worker_id, text: displayName };
    })
    .sort(compareByText);

  return [{ value: '', text: 'All users' }, ...options];
}

function buildRegionOptions(
  regionIds: string[],
  regionRecords: { region_id: string; description: string }[]
): SelectOption[] {
  const descriptions = regionRecords.reduce<Record<string, string>>((acc, region) => {
    acc[region.region_id] = region.description;
    return acc;
  }, {});
  const options = regionIds
    .map(regionId => ({
      value: regionId,
      text: regionId === '' ? '(Blank)' : (descriptions[regionId] ?? regionId),
    }))
    .sort(compareByText);
  return [{ value: '', text: 'All regions' }, ...options];
}

function buildLocationOptions(
  locationIds: string[],
  courtVenues: { epimms_id: string; site_name: string }[]
): SelectOption[] {
  const descriptions = courtVenues.reduce<Record<string, string>>((acc, venue) => {
    acc[venue.epimms_id] = venue.site_name;
    return acc;
  }, {});
  const options = locationIds
    .map(locationId => ({
      value: locationId,
      text: locationId === '' ? '(Blank)' : (descriptions[locationId] ?? locationId),
    }))
    .sort(compareByText);
  return [{ value: '', text: 'All locations' }, ...options];
}

class FilterService {
  async fetchFilterOptions(): Promise<FilterOptions> {
    const cached = getCache<FilterOptions>(CacheKeys.filterOptions);
    if (cached) {
      return cached;
    }

    const { services, roleCategories, regions, locations, taskNames, workTypes, assignees } =
      await taskFactsRepository.fetchOverviewFilterOptionsRows();
    const regionRecords = await regionService.fetchRegions();
    const courtVenues = await courtVenueService.fetchCourtVenues();
    const profiles = await caseWorkerProfileService.fetchCaseWorkerProfiles();
    const userOptions = buildUserOptions(
      assignees.map(row => row.value),
      profiles
    );
    const regionOptions = buildRegionOptions(
      regions.map(row => row.value),
      regionRecords
    );
    const locationOptions = buildLocationOptions(
      locations.map(row => row.value),
      courtVenues
    );

    const options = {
      services: services.map(row => row.value),
      roleCategories: roleCategories.map(row => row.value),
      regions: regionOptions,
      locations: locationOptions,
      taskNames: taskNames.map(row => row.value),
      workTypes: [
        { value: '', text: 'All work types' },
        ...workTypes.map(row => ({ value: row.value, text: row.text })),
      ],
      users: userOptions,
    };

    setCache(CacheKeys.filterOptions, options);
    return options;
  }
}

export const filterService = new FilterService();
