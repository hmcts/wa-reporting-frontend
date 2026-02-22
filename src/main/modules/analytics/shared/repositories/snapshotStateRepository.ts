import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';

const { Logger } = require('../../../logging');

type SnapshotStateRow = {
  published_snapshot_id: bigint | number | string | null;
  published_at: Date | string | null;
};

export type PublishedSnapshot = {
  snapshotId: number;
  publishedAt: Date;
};

const logger = Logger.getLogger('snapshot-state-repository');

function parseSnapshotId(value: bigint | number | string): number {
  const parsed = typeof value === 'bigint' ? Number(value) : Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid published snapshot id: ${value}`);
  }
  return parsed;
}

function parsePublishedAt(value: Date | string): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid published_at timestamp: ${value}`);
  }
  return parsed;
}

export class SnapshotStateRepository {
  async fetchPublishedSnapshot(): Promise<PublishedSnapshot | null> {
    try {
      const rows = await tmPrisma.$queryRaw<SnapshotStateRow[]>(Prisma.sql`
        SELECT published_snapshot_id, published_at
        FROM analytics.snapshot_state
        WHERE singleton_id = TRUE
        LIMIT 1
      `);

      const row = rows[0];
      if (!row?.published_snapshot_id || !row.published_at) {
        return null;
      }

      return {
        snapshotId: parseSnapshotId(row.published_snapshot_id),
        publishedAt: parsePublishedAt(row.published_at),
      };
    } catch (error) {
      logger.error('Failed to fetch published snapshot metadata', error);
      return null;
    }
  }

  async fetchSnapshotById(snapshotId: number): Promise<PublishedSnapshot | null> {
    try {
      const rows = await tmPrisma.$queryRaw<SnapshotStateRow[]>(Prisma.sql`
        SELECT
          batches.snapshot_id AS published_snapshot_id,
          COALESCE(state.published_at, batches.completed_at) AS published_at
        FROM analytics.snapshot_batches batches
        LEFT JOIN analytics.snapshot_state state
          ON state.singleton_id = TRUE
         AND state.published_snapshot_id = batches.snapshot_id
        WHERE batches.snapshot_id = ${snapshotId}
          AND batches.status = 'succeeded'
        LIMIT 1
      `);

      const row = rows[0];
      if (!row?.published_snapshot_id || !row.published_at) {
        return null;
      }

      return {
        snapshotId: parseSnapshotId(row.published_snapshot_id),
        publishedAt: parsePublishedAt(row.published_at),
      };
    } catch (error) {
      logger.error('Failed to fetch snapshot metadata by id', { snapshotId, error });
      return null;
    }
  }
}

export const snapshotStateRepository = new SnapshotStateRepository();
