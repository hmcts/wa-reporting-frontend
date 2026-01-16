import { CacheKeys, getCache, setCache } from '../../../../../main/modules/analytics/shared/cache/cache';
import { caseWorkerProfileRepository } from '../../../../../main/modules/analytics/shared/repositories';
import { caseWorkerProfileService } from '../../../../../main/modules/analytics/shared/services/caseWorkerProfileService';

jest.mock('../../../../../main/modules/analytics/shared/cache/cache', () => ({
  CacheKeys: { caseWorkerProfiles: 'case-worker-profiles', caseWorkerProfileNames: 'case-worker-profile-names' },
  getCache: jest.fn(),
  setCache: jest.fn(),
}));

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  caseWorkerProfileRepository: { getAll: jest.fn() },
}));

describe('caseWorkerProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns cached profiles when available', async () => {
    (getCache as jest.Mock).mockReturnValue([{ case_worker_id: 'id-1' }]);

    const result = await caseWorkerProfileService.fetchCaseWorkerProfiles();

    expect(result).toEqual([{ case_worker_id: 'id-1' }]);
    expect(caseWorkerProfileRepository.getAll).not.toHaveBeenCalled();
  });

  test('fetches profiles and stores in cache', async () => {
    (getCache as jest.Mock).mockReturnValue(undefined);
    (caseWorkerProfileRepository.getAll as jest.Mock).mockResolvedValue([
      { case_worker_id: 'id-2', first_name: 'Sam', last_name: 'Lee', email_id: 'sam@example.com', region_id: 1 },
    ]);

    const result = await caseWorkerProfileService.fetchCaseWorkerProfiles();

    expect(result).toEqual([
      { case_worker_id: 'id-2', first_name: 'Sam', last_name: 'Lee', email_id: 'sam@example.com', region_id: 1 },
    ]);
    expect(setCache).toHaveBeenCalledWith(CacheKeys.caseWorkerProfiles, [
      { case_worker_id: 'id-2', first_name: 'Sam', last_name: 'Lee', email_id: 'sam@example.com', region_id: 1 },
    ]);
    expect(setCache).toHaveBeenCalledWith(CacheKeys.caseWorkerProfileNames, { 'id-2': 'Sam Lee' });
  });

  test('builds name map from cached profiles when needed', async () => {
    (getCache as jest.Mock).mockImplementation((key: string) => {
      if (key === CacheKeys.caseWorkerProfiles) {
        return [
          { case_worker_id: 'id-1', first_name: 'Alex', last_name: 'Ng', email_id: 'alex@example.com', region_id: 1 },
        ];
      }
      return undefined;
    });

    const result = await caseWorkerProfileService.fetchCaseWorkerProfileNames();

    expect(result).toEqual({ 'id-1': 'Alex Ng' });
    expect(caseWorkerProfileRepository.getAll).not.toHaveBeenCalled();
    expect(setCache).toHaveBeenCalledWith(CacheKeys.caseWorkerProfileNames, { 'id-1': 'Alex Ng' });
  });

  test('returns cached names when available', async () => {
    (getCache as jest.Mock).mockImplementation((key: string) => {
      if (key === CacheKeys.caseWorkerProfileNames) {
        return { 'id-9': 'Morgan Doe' };
      }
      return undefined;
    });

    const result = await caseWorkerProfileService.fetchCaseWorkerProfileNames();

    expect(result).toEqual({ 'id-9': 'Morgan Doe' });
    expect(caseWorkerProfileRepository.getAll).not.toHaveBeenCalled();
  });
});
