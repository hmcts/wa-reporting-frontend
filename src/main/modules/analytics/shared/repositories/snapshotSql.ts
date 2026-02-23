import { Prisma } from '@prisma/client';

function qualifiedColumn(tableAlias: string | undefined, column: string): Prisma.Sql {
  if (!tableAlias) {
    return Prisma.raw(column);
  }
  return Prisma.raw(`${tableAlias}.${column}`);
}

export function asOfSnapshotCondition(snapshotId: number, tableAlias?: string): Prisma.Sql {
  const snapshotColumn = qualifiedColumn(tableAlias, 'snapshot_id');
  return Prisma.sql`${snapshotColumn} = ${snapshotId}`;
}
