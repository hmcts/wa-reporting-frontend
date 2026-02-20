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
        workType: ['Hearing'],
      },
      [Prisma.sql`date_role = 'due'`]
    );

    expect(sql.sql).toContain('jurisdiction_label');
    expect(sql.sql).toContain('role_category_label');
    expect(sql.sql).toContain('region');
    expect(sql.sql).toContain('location');
    expect(sql.sql).toContain('task_name');
    expect(sql.sql).toContain('work_type');
  });

  test('returns empty when no conditions are provided', () => {
    const sql = buildAnalyticsWhere({}, []);
    expect(sql.sql).toBe('');
  });

  test('adds role-category exclusion when query options are provided', () => {
    const sql = buildAnalyticsWhere({}, [Prisma.sql`snapshot_id = 7`], {
      excludeRoleCategories: ['Judicial', ' Judicial '],
    });

    expect(sql.sql).toContain('UPPER(role_category_label) NOT IN');
    expect(sql.values).toEqual(expect.arrayContaining(['JUDICIAL']));
  });
});
