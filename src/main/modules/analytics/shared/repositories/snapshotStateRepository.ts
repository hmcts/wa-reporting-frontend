import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';

const { Logger } = require('../../../logging');

type SnapshotStateRow = {
  published_snapshot_id: bigint | number | string | null;
  published_at: Date | string | null;
  as_of_date: Date | string | null;
};

export type PublishedSnapshot = {
  snapshotId: number;
  publishedAt: Date;
  asOfDate: Date;
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

function parseAsOfDate(value: Date | string): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid as_of_date: ${value}`);
  }
  return parsed;
}

export class SnapshotStateRepository {
  async fetchPublishedSnapshot(): Promise<PublishedSnapshot | null> {
    try {
      const rows = await tmPrisma.$queryRaw<SnapshotStateRow[]>(Prisma.sql`
        SELECT
          state.published_snapshot_id,
          state.published_at,
          batches.as_of_date
        FROM analytics.snapshot_state state
        LEFT JOIN analytics.snapshot_batches batches
          ON batches.snapshot_id = state.published_snapshot_id
        WHERE singleton_id = TRUE
        LIMIT 1
      `);

      const row = rows[0];
      if (!row?.published_snapshot_id || !row.published_at || !row.as_of_date) {
        return null;
      }

      return {
        snapshotId: parseSnapshotId(row.published_snapshot_id),
        publishedAt: parsePublishedAt(row.published_at),
        asOfDate: parseAsOfDate(row.as_of_date),
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
          COALESCE(state.published_at, batches.completed_at) AS published_at,
          batches.as_of_date
        FROM analytics.snapshot_batches batches
        LEFT JOIN analytics.snapshot_state state
          ON state.singleton_id = TRUE
         AND state.published_snapshot_id = batches.snapshot_id
        WHERE batches.snapshot_id = ${snapshotId}
          AND batches.status = 'succeeded'
        LIMIT 1
      `);

      const row = rows[0];
      if (!row?.published_snapshot_id || !row.published_at || !row.as_of_date) {
        return null;
      }

      return {
        snapshotId: parseSnapshotId(row.published_snapshot_id),
        publishedAt: parsePublishedAt(row.published_at),
        asOfDate: parseAsOfDate(row.as_of_date),
      };
    } catch (error) {
      logger.error('Failed to fetch snapshot metadata by id', { snapshotId, error });
      return null;
    }
  }
}

export const snapshotStateRepository = new SnapshotStateRepository();
