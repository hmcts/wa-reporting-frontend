import { Prisma } from '@prisma/client';

function qualifiedColumn(tableAlias: string | undefined, column: string): Prisma.Sql {
  if (!tableAlias) {
    return Prisma.raw(column);
  }
  return Prisma.raw(`${tableAlias}.${column}`);
}

export function asOfSnapshotCondition(snapshotId: number, tableAlias?: string): Prisma.Sql {
  const validFrom = qualifiedColumn(tableAlias, 'valid_from_snapshot_id');
  const validTo = qualifiedColumn(tableAlias, 'valid_to_snapshot_id');
  return Prisma.sql`${validFrom} <= ${snapshotId} AND (${validTo} IS NULL OR ${validTo} > ${snapshotId})`;
}

export function snapshotAsOfDateSql(snapshotId: number): Prisma.Sql {
  return Prisma.sql`(
    SELECT batches.as_of_date
    FROM analytics.snapshot_batches batches
    WHERE batches.snapshot_id = ${snapshotId}
    LIMIT 1
  )`;
}
