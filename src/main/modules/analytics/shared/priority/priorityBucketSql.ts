import { Prisma } from '@prisma/client';

type PriorityBucketLabels = {
  urgent: string;
  high: string;
  medium: string;
  low: string;
};

type PriorityBucketOptions = {
  priorityColumn: Prisma.Sql;
  dateColumn: Prisma.Sql;
  labels: PriorityBucketLabels;
};

export function priorityBucketSql({ priorityColumn, dateColumn, labels }: PriorityBucketOptions): Prisma.Sql {
  return Prisma.sql`CASE
    WHEN ${priorityColumn} <= 2000 THEN ${labels.urgent}
    WHEN ${priorityColumn} < 5000 THEN ${labels.high}
    WHEN ${priorityColumn} = 5000 AND ${dateColumn} < CURRENT_DATE THEN ${labels.high}
    WHEN ${priorityColumn} = 5000 AND ${dateColumn} = CURRENT_DATE THEN ${labels.medium}
    ELSE ${labels.low}
  END`;
}
