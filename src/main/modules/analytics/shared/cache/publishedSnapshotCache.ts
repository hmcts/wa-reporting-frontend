import config from 'config';
import NodeCache from 'node-cache';

import type { PublishedSnapshot } from '../repositories/snapshotStateRepository';

export const PUBLISHED_SNAPSHOT_CACHE_TTL_SECONDS = config.get<number>('analytics.publishedSnapshotCacheTtlSeconds');

const CURRENT_PUBLISHED_SNAPSHOT_CACHE_KEY = 'current-published-snapshot';

const publishedSnapshotCache = new NodeCache({ stdTTL: PUBLISHED_SNAPSHOT_CACHE_TTL_SECONDS });

export function getCurrentPublishedSnapshotFromCache(): PublishedSnapshot | undefined {
  return publishedSnapshotCache.get<PublishedSnapshot>(CURRENT_PUBLISHED_SNAPSHOT_CACHE_KEY);
}

export function setCurrentPublishedSnapshotInCache(snapshot: PublishedSnapshot): void {
  publishedSnapshotCache.set(CURRENT_PUBLISHED_SNAPSHOT_CACHE_KEY, snapshot);
}

export function clearCurrentPublishedSnapshotCache(): void {
  publishedSnapshotCache.del(CURRENT_PUBLISHED_SNAPSHOT_CACHE_KEY);
}
