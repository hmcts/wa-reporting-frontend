import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';

import { parseSnapshotId } from './snapshotMetadataHelpers';

const { Logger } = require('../../../logging');

type SnapshotBatchRow = {
  snapshot_id: bigint | number | string | null;
};

const logger = Logger.getLogger('snapshot-batches-repository');

export class SnapshotBatchesRepository {
  async fetchSucceededSnapshotById(snapshotId: number): Promise<{ snapshotId: number } | null> {
    try {
      const rows = await tmPrisma.$queryRaw<SnapshotBatchRow[]>(Prisma.sql`
        SELECT batches.snapshot_id
        FROM analytics.snapshot_batches batches
        WHERE batches.snapshot_id = ${snapshotId}
          AND batches.status = 'succeeded'
        LIMIT 1
      `);

      const resolvedSnapshotId = parseSnapshotId(rows[0]?.snapshot_id ?? null);
      if (!resolvedSnapshotId) {
        return null;
      }

      return { snapshotId: resolvedSnapshotId };
    } catch (error) {
      logger.error('Failed to fetch snapshot metadata by id', { snapshotId, error });
      return null;
    }
  }
}

export const snapshotBatchesRepository = new SnapshotBatchesRepository();
