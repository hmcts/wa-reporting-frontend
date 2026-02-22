import { Prisma } from '@prisma/client';

type PriorityBucketLabels = {
  Urgent: string;
  High: string;
  Medium: string;
  Low: string;
};

type PriorityBucketOptions = {
  priorityColumn: Prisma.Sql;
  dateColumn: Prisma.Sql;
  labels: PriorityBucketLabels;
};

export function priorityBucketSql({ priorityColumn, dateColumn, labels }: PriorityBucketOptions): Prisma.Sql {
  return Prisma.sql`CASE
    WHEN ${priorityColumn} <= 2000 THEN ${labels.Urgent}
    WHEN ${priorityColumn} < 5000 THEN ${labels.High}
    WHEN ${priorityColumn} = 5000 AND ${dateColumn} < CURRENT_DATE THEN ${labels.High}
    WHEN ${priorityColumn} = 5000 AND ${dateColumn} = CURRENT_DATE THEN ${labels.Medium}
    ELSE ${labels.Low}
  END`;
}
