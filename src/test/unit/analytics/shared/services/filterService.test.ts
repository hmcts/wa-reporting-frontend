import { CacheKeys, getCache, setCache } from '../../../../../main/modules/analytics/shared/cache/cache';
import { taskFactsRepository } from '../../../../../main/modules/analytics/shared/repositories';
import {
  caseWorkerProfileService,
  courtVenueService,
  regionService,
} from '../../../../../main/modules/analytics/shared/services';
import { filterService } from '../../../../../main/modules/analytics/shared/services/filterService';

jest.mock('../../../../../main/modules/analytics/shared/cache/cache', () => ({
  CacheKeys: { filterOptions: 'filter-options' },
  getCache: jest.fn(),
  setCache: jest.fn(),
}));

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskFactsRepository: { fetchOverviewFilterOptionsRows: jest.fn() },
}));

jest.mock('../../../../../main/modules/analytics/shared/services/index', () => ({
  caseWorkerProfileService: { fetchCaseWorkerProfiles: jest.fn() },
  courtVenueService: { fetchCourtVenues: jest.fn() },
  regionService: { fetchRegions: jest.fn() },
}));

describe('filterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns cached options when available', async () => {
    (getCache as jest.Mock).mockReturnValue({
      services: ['cached'],
      roleCategories: [],
      regions: [],
      locations: [],
      taskNames: [],
      workTypes: [],
      users: [],
    });

    const result = await filterService.fetchFilterOptions();

    expect(result.services).toEqual(['cached']);
    expect(taskFactsRepository.fetchOverviewFilterOptionsRows).not.toHaveBeenCalled();
  });

  test('builds filter options and stores them in cache', async () => {
    (getCache as jest.Mock).mockReturnValue(undefined);
    (taskFactsRepository.fetchOverviewFilterOptionsRows as jest.Mock).mockResolvedValue({
      services: [{ value: 'Service A' }],
      roleCategories: [{ value: 'Ops' }],
      regions: [{ value: '1' }, { value: '' }, { value: '99' }],
      locations: [{ value: '100' }, { value: '' }, { value: '999' }],
      taskNames: [{ value: 'Review' }],
      workTypes: [{ value: 'hearing-work-type', text: 'Hearing work' }],
      assignees: [{ value: 'user-1' }, { value: 'user-2' }],
    });
    (regionService.fetchRegions as jest.Mock).mockResolvedValue([{ region_id: '1', description: 'North' }]);
    (courtVenueService.fetchCourtVenues as jest.Mock).mockResolvedValue([{ epimms_id: '100', site_name: 'Leeds' }]);
    (caseWorkerProfileService.fetchCaseWorkerProfiles as jest.Mock).mockResolvedValue([
      { case_worker_id: 'user-1', first_name: 'Sam', last_name: 'Lee', email_id: 'sam@example.com', region_id: 1 },
      { case_worker_id: 'user-3', first_name: 'Alex', last_name: 'P', email_id: 'alex@example.com', region_id: 2 },
    ]);

    const result = await filterService.fetchFilterOptions();

    expect(result.services).toEqual(['Service A']);
    expect(result.roleCategories).toEqual(['Ops']);
    expect(result.taskNames).toEqual(['Review']);
    expect(result.workTypes).toEqual([{ value: 'hearing-work-type', text: 'Hearing work' }]);
    expect(result.regions).toEqual([
      { value: '', text: 'All regions' },
      { value: '', text: '(Blank)' },
      { value: '99', text: '99' },
      { value: '1', text: 'North' },
    ]);
    expect(result.locations).toEqual([
      { value: '', text: 'All locations' },
      { value: '', text: '(Blank)' },
      { value: '999', text: '999' },
      { value: '100', text: 'Leeds' },
    ]);
    expect(result.users[0]).toEqual({ value: '', text: 'All users' });
    expect(result.users[1].value).toBe('user-1');
    expect(result.users.find(option => option.value === 'user-2')).toBeUndefined();
    expect(setCache).toHaveBeenCalledWith(CacheKeys.filterOptions, result);
  });
});
