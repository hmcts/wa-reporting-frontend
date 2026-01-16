import { Prisma } from '@prisma/client';

import { priorityBucketSql } from '../../../../../main/modules/analytics/shared/priority/priorityBucketSql';

describe('priorityBucketSql', () => {
  test('builds priority buckets from priority and date columns', () => {
    const sql = priorityBucketSql({
      priorityColumn: Prisma.raw('priority'),
      dateColumn: Prisma.raw('reference_date'),
      labels: {
        urgent: 'Urgent',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
      },
    });

    expect(sql.sql).toContain('reference_date');
    expect(sql.values).toEqual(expect.arrayContaining(['Urgent', 'High', 'Medium', 'Low']));
  });
});
