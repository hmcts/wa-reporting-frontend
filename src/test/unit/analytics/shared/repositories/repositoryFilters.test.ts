import { Prisma } from '@prisma/client';

import { buildAnalyticsWhere } from '../../../../../main/modules/analytics/shared/repositories/filters';

describe('buildAnalyticsWhere', () => {
  test('builds a WHERE clause with provided filters', () => {
    const sql = buildAnalyticsWhere(
      {
        service: ['Service A'],
        roleCategory: ['Ops'],
        region: ['North'],
        location: ['Leeds'],
        taskName: ['Review'],
      },
      [Prisma.sql`date_role = 'due'`]
    );

    expect(sql.sql).toContain('jurisdiction_label');
    expect(sql.sql).toContain('role_category_label');
    expect(sql.sql).toContain('region');
    expect(sql.sql).toContain('location');
    expect(sql.sql).toContain('task_name');
  });

  test('returns empty when no conditions are provided', () => {
    const sql = buildAnalyticsWhere({}, []);
    expect(sql.sql).toBe('');
  });
});
