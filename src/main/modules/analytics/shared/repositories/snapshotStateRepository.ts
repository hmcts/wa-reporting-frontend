import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';

import { PublishedSnapshot, parsePublishedAt, parseSnapshotId } from './snapshotMetadataHelpers';

const { Logger } = require('../../../logging');

type SnapshotStateRow = {
  published_snapshot_id: bigint | number | string | null;
  published_at: Date | string | null;
};

const logger = Logger.getLogger('snapshot-state-repository');

export class SnapshotStateRepository {
  async fetchPublishedSnapshot(): Promise<PublishedSnapshot | null> {
    try {
      const rows = await tmPrisma.$queryRaw<SnapshotStateRow[]>(Prisma.sql`
        SELECT
          state.published_snapshot_id,
          state.published_at
        FROM analytics.snapshot_state state
        WHERE singleton_id = TRUE
        LIMIT 1
      `);

      const snapshotId = parseSnapshotId(rows[0]?.published_snapshot_id ?? null);
      if (!snapshotId) {
        return null;
      }

      return {
        snapshotId,
        publishedAt: parsePublishedAt(rows[0]?.published_at),
      };
    } catch (error) {
      logger.error('Failed to fetch published snapshot metadata', error);
      return null;
    }
  }
}

export const snapshotStateRepository = new SnapshotStateRepository();
