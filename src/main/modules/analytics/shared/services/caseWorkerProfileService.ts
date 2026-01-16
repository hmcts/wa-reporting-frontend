import { CacheKeys, getCache, setCache } from '../cache/cache';
import { caseWorkerProfileRepository } from '../repositories';
import type { CaseWorkerProfileRow } from '../repositories';
import { buildDescriptionMap } from '../utils';

function buildCaseWorkerDisplayName(profile: CaseWorkerProfileRow): string {
  const firstName = profile.first_name.trim();
  const lastName = profile.last_name.trim();
  return [firstName, lastName].filter(Boolean).join(' ');
}

function buildCaseWorkerNameMap(profiles: CaseWorkerProfileRow[]): Record<string, string> {
  return buildDescriptionMap(profiles, profile => profile.case_worker_id, buildCaseWorkerDisplayName);
}

class CaseWorkerProfileService {
  async fetchCaseWorkerProfiles(): Promise<CaseWorkerProfileRow[]> {
    const cached = getCache<CaseWorkerProfileRow[]>(CacheKeys.caseWorkerProfiles);
    if (cached) {
      return cached;
    }
    const profiles = await caseWorkerProfileRepository.getAll();
    setCache(CacheKeys.caseWorkerProfiles, profiles);
    setCache(CacheKeys.caseWorkerProfileNames, buildCaseWorkerNameMap(profiles));
    return profiles;
  }

  async fetchCaseWorkerProfileNames(): Promise<Record<string, string>> {
    const cached = getCache<Record<string, string>>(CacheKeys.caseWorkerProfileNames);
    if (cached) {
      return cached;
    }
    const profiles = await this.fetchCaseWorkerProfiles();
    const names = buildCaseWorkerNameMap(profiles);
    setCache(CacheKeys.caseWorkerProfileNames, names);
    return names;
  }
}

export const caseWorkerProfileService = new CaseWorkerProfileService();
