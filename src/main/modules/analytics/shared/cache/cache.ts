import config from 'config';
import NodeCache from 'node-cache';

const stdTTL = config.get<number>('analytics.cacheTtlSeconds');
const cache = new NodeCache({ stdTTL });

export const CacheKeys = {
  filterOptions: 'filter-options',
  caseWorkerProfiles: 'case-worker-profiles',
  caseWorkerProfileNames: 'case-worker-profile-names',
  regions: 'regions',
  regionDescriptions: 'region-descriptions',
  courtVenues: 'court-venues',
  courtVenueDescriptions: 'court-venue-descriptions',
} as const;

export function getCache<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function setCache<T>(key: string, value: T): void {
  cache.set(key, value);
}

export function buildSnapshotScopedCacheKey(baseKey: string, snapshotId: number): string {
  return `${baseKey}:${snapshotId}`;
}
