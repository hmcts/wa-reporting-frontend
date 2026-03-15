import config from 'config';
import NodeCache from 'node-cache';

const stdTTL = config.get<number>('analytics.publishedSnapshotCacheTtlSeconds');
const cache = new NodeCache({ stdTTL });

export const CacheKeys = {
  currentPublishedSnapshot: 'current-published-snapshot',
} as const;

export function getCache<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function setCache<T>(key: string, value: T): void {
  cache.set(key, value);
}
