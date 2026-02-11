import { Prisma } from '@prisma/client';

import { AnalyticsFilters } from '../types';

function inCondition(column: string, values: string[]): Prisma.Sql {
  return Prisma.sql`${Prisma.raw(column)} IN (${Prisma.join(values)})`;
}

export function buildAnalyticsWhere(filters: AnalyticsFilters, baseConditions: Prisma.Sql[]): Prisma.Sql {
  const conditions: Prisma.Sql[] = [...baseConditions];
  const filterMappings = [
    { column: 'jurisdiction_label', values: filters.service },
    { column: 'role_category_label', values: filters.roleCategory },
    { column: 'region', values: filters.region },
    { column: 'location', values: filters.location },
    { column: 'task_name', values: filters.taskName },
    { column: 'work_type', values: filters.workType },
  ];

  for (const { column, values } of filterMappings) {
    if (values && values.length > 0) {
      conditions.push(inCondition(column, values));
    }
  }

  return conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
}
