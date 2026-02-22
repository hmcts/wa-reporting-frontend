import { Prisma } from '@prisma/client';

import {
  priorityLabelFromRank,
  priorityRankSql,
} from '../../../../../main/modules/analytics/shared/priority/priorityRankSql';

describe('priorityRankSql', () => {
  test('builds numeric priority rank from priority and date columns', () => {
    const sql = priorityRankSql({
      priorityColumn: Prisma.raw('priority'),
      dateColumn: Prisma.raw('reference_date'),
      asOfDateColumn: Prisma.raw('as_of_date'),
    });

    expect(sql.sql).toContain('reference_date');
    expect(sql.sql).toContain('as_of_date');
    expect(sql.sql).toContain('THEN 4');
    expect(sql.sql).toContain('THEN 3');
    expect(sql.sql).toContain('THEN 2');
    expect(sql.sql).toContain('ELSE 1');
  });

  test('maps numeric rank to task-priority label with low fallback', () => {
    expect(priorityLabelFromRank(4)).toBe('Urgent');
    expect(priorityLabelFromRank(3)).toBe('High');
    expect(priorityLabelFromRank(2)).toBe('Medium');
    expect(priorityLabelFromRank(1)).toBe('Low');
    expect(priorityLabelFromRank(0)).toBe('Low');
    expect(priorityLabelFromRank(undefined)).toBe('Low');
  });
});
