import { Prisma } from '@prisma/client';

import { TaskPriority, TaskPriorityValue } from '../types';

type PriorityRankOptions = {
  priorityColumn: Prisma.Sql;
  dateColumn: Prisma.Sql;
  asOfDateColumn: Prisma.Sql;
};

export function priorityRankSql({ priorityColumn, dateColumn, asOfDateColumn }: PriorityRankOptions): Prisma.Sql {
  return Prisma.sql`CASE
    WHEN ${priorityColumn} <= 2000 THEN 4
    WHEN ${priorityColumn} < 5000 THEN 3
    WHEN ${priorityColumn} = 5000 AND ${dateColumn} < ${asOfDateColumn} THEN 3
    WHEN ${priorityColumn} = 5000 AND ${dateColumn} = ${asOfDateColumn} THEN 2
    ELSE 1
  END`;
}

export function priorityLabelFromRank(priorityRank: number | null | undefined): TaskPriorityValue {
  switch (priorityRank) {
    case 4:
      return TaskPriority.Urgent;
    case 3:
      return TaskPriority.High;
    case 2:
      return TaskPriority.Medium;
    default:
      return TaskPriority.Low;
  }
}

export function prioritySortValue(priority: TaskPriorityValue | null | undefined): number {
  switch (priority) {
    case TaskPriority.Urgent:
      return 4;
    case TaskPriority.High:
      return 3;
    case TaskPriority.Medium:
      return 2;
    default:
      return 1;
  }
}
