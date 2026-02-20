import { Prisma } from '@prisma/client';

import { AnalyticsFilters } from '../types';

export type AnalyticsQueryOptions = {
  excludeRoleCategories?: string[];
};

function inCondition(column: string, values: string[]): Prisma.Sql {
  return Prisma.sql`${Prisma.raw(column)} IN (${Prisma.join(values)})`;
}

function normaliseExcludedRoleCategories(queryOptions?: AnalyticsQueryOptions): string[] {
  const excluded = queryOptions?.excludeRoleCategories;
  if (!excluded || excluded.length === 0) {
    return [];
  }
  return [...new Set(excluded.map(value => value.trim().toUpperCase()).filter(value => value.length > 0))].sort();
}

function excludedRoleCategoriesCondition(values: string[]): Prisma.Sql | null {
  if (values.length === 0) {
    return null;
  }
  return Prisma.sql`(role_category_label IS NULL OR UPPER(role_category_label) NOT IN (${Prisma.join(values)}))`;
}

export function buildAnalyticsWhere(
  filters: AnalyticsFilters,
  baseConditions: Prisma.Sql[],
  queryOptions?: AnalyticsQueryOptions
): Prisma.Sql {
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

  const excludedRoleCategories = normaliseExcludedRoleCategories(queryOptions);
  const excludedRoleCategoriesSql = excludedRoleCategoriesCondition(excludedRoleCategories);
  if (excludedRoleCategoriesSql) {
    conditions.push(excludedRoleCategoriesSql);
  }

  return conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
}
