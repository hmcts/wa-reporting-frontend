import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { AnalyticsFilters } from '../types';

import { AnalyticsQueryOptions, buildAnalyticsWhere } from './filters';
import { asOfSnapshotCondition } from './snapshotSql';
import { FilterValueRow, FilterValueWithTextRow, OverviewFilterOptionsRows } from './types';

type OverviewFilterOptionKind =
  | 'service'
  | 'roleCategory'
  | 'region'
  | 'location'
  | 'taskName'
  | 'workType'
  | 'assignee';

export type OverviewFacetFilterKey =
  | 'service'
  | 'roleCategory'
  | 'region'
  | 'location'
  | 'taskName'
  | 'workType'
  | 'user';

type OverviewFilterOptionRow = {
  option_type: OverviewFilterOptionKind;
  value: string;
  text: string;
};

export type FilterFactsQueryParams = {
  filters?: AnalyticsFilters;
  queryOptions?: AnalyticsQueryOptions;
  includeUserFilter?: boolean;
};

type FilterFactsQueryConfig = {
  tableName: string;
  supportsAssigneeFacet: boolean;
};

const overviewFacetFilterKeys: OverviewFacetFilterKey[] = [
  'service',
  'roleCategory',
  'region',
  'location',
  'taskName',
  'workType',
  'user',
];

function mapOverviewFilterOptionRows(optionRows: OverviewFilterOptionRow[]): OverviewFilterOptionsRows {
  const services: FilterValueRow[] = [];
  const roleCategories: FilterValueRow[] = [];
  const regions: FilterValueRow[] = [];
  const locations: FilterValueRow[] = [];
  const taskNames: FilterValueRow[] = [];
  const workTypes: FilterValueWithTextRow[] = [];
  const assignees: FilterValueRow[] = [];

  for (const row of optionRows) {
    switch (row.option_type) {
      case 'service':
        services.push({ value: row.value });
        break;
      case 'roleCategory':
        roleCategories.push({ value: row.value });
        break;
      case 'region':
        regions.push({ value: row.value });
        break;
      case 'location':
        locations.push({ value: row.value });
        break;
      case 'taskName':
        taskNames.push({ value: row.value });
        break;
      case 'workType':
        workTypes.push({ value: row.value, text: row.text });
        break;
      case 'assignee':
        assignees.push({ value: row.value });
        break;
      default:
        break;
    }
  }

  return { services, roleCategories, regions, locations, taskNames, workTypes, assignees };
}

function hasActiveOverviewFacetFilters(filters: AnalyticsFilters, includeUserFilter: boolean): boolean {
  return overviewFacetFilterKeys.some(key => {
    if (!includeUserFilter && key === 'user') {
      return false;
    }

    const values = filters[key];
    return Array.isArray(values) && values.length > 0;
  });
}

function buildUnfilteredUserOverviewFilterOptionsQuery(
  snapshotId: number,
  tableName: Prisma.Sql,
  queryOptions?: AnalyticsQueryOptions
): Prisma.Sql {
  const whereClause = buildAnalyticsWhere({}, [asOfSnapshotCondition(snapshotId)], queryOptions);

  return Prisma.sql`
    WITH grouped_options AS (
      SELECT
        CASE
          WHEN GROUPING(jurisdiction_label) = 0 THEN 'service'
          WHEN GROUPING(role_category_label) = 0 THEN 'roleCategory'
          WHEN GROUPING(region) = 0 THEN 'region'
          WHEN GROUPING(location) = 0 THEN 'location'
          WHEN GROUPING(task_name) = 0 THEN 'taskName'
          WHEN GROUPING(work_type) = 0 THEN 'workType'
          WHEN GROUPING(assignee) = 0 THEN 'assignee'
        END AS option_type,
        CASE
          WHEN GROUPING(jurisdiction_label) = 0 THEN jurisdiction_label::text
          WHEN GROUPING(role_category_label) = 0 THEN role_category_label::text
          WHEN GROUPING(region) = 0 THEN region::text
          WHEN GROUPING(location) = 0 THEN location::text
          WHEN GROUPING(task_name) = 0 THEN task_name::text
          WHEN GROUPING(work_type) = 0 THEN work_type::text
          WHEN GROUPING(assignee) = 0 THEN assignee::text
        END AS value
      FROM ${tableName}
      ${whereClause}
      GROUP BY GROUPING SETS (
        (jurisdiction_label),
        (role_category_label),
        (region),
        (location),
        (task_name),
        (work_type),
        (assignee)
      )
      HAVING
        (GROUPING(jurisdiction_label) = 0 AND jurisdiction_label IS NOT NULL)
        OR (GROUPING(role_category_label) = 0 AND role_category_label IS NOT NULL AND BTRIM(role_category_label) <> '')
        OR (GROUPING(region) = 0 AND region IS NOT NULL)
        OR (GROUPING(location) = 0 AND location IS NOT NULL)
        OR (GROUPING(task_name) = 0 AND task_name IS NOT NULL)
        OR (GROUPING(work_type) = 0 AND work_type IS NOT NULL)
        OR (GROUPING(assignee) = 0 AND assignee IS NOT NULL)
    )
    SELECT
      grouped_options.option_type,
      grouped_options.value,
      CASE
        WHEN grouped_options.option_type = 'workType'
          THEN COALESCE(work_types.label, grouped_options.value)
        ELSE grouped_options.value
      END AS text
    FROM grouped_options
    LEFT JOIN cft_task_db.work_types work_types
      ON grouped_options.option_type = 'workType'
     AND work_types.work_type_id = grouped_options.value
    ORDER BY grouped_options.option_type ASC, text ASC, grouped_options.value ASC
  `;
}

function buildUnfilteredNonUserOverviewFilterOptionsQuery(
  snapshotId: number,
  tableName: Prisma.Sql,
  queryOptions?: AnalyticsQueryOptions
): Prisma.Sql {
  const whereClause = buildAnalyticsWhere({}, [asOfSnapshotCondition(snapshotId)], queryOptions);

  return Prisma.sql`
    WITH grouped_options AS (
      SELECT
        CASE
          WHEN GROUPING(jurisdiction_label) = 0 THEN 'service'
          WHEN GROUPING(role_category_label) = 0 THEN 'roleCategory'
          WHEN GROUPING(region) = 0 THEN 'region'
          WHEN GROUPING(location) = 0 THEN 'location'
          WHEN GROUPING(task_name) = 0 THEN 'taskName'
          WHEN GROUPING(work_type) = 0 THEN 'workType'
        END AS option_type,
        CASE
          WHEN GROUPING(jurisdiction_label) = 0 THEN jurisdiction_label::text
          WHEN GROUPING(role_category_label) = 0 THEN role_category_label::text
          WHEN GROUPING(region) = 0 THEN region::text
          WHEN GROUPING(location) = 0 THEN location::text
          WHEN GROUPING(task_name) = 0 THEN task_name::text
          WHEN GROUPING(work_type) = 0 THEN work_type::text
        END AS value
      FROM ${tableName}
      ${whereClause}
      GROUP BY GROUPING SETS (
        (jurisdiction_label),
        (role_category_label),
        (region),
        (location),
        (task_name),
        (work_type)
      )
      HAVING
        (GROUPING(jurisdiction_label) = 0 AND jurisdiction_label IS NOT NULL)
        OR (GROUPING(role_category_label) = 0 AND role_category_label IS NOT NULL AND BTRIM(role_category_label) <> '')
        OR (GROUPING(region) = 0 AND region IS NOT NULL)
        OR (GROUPING(location) = 0 AND location IS NOT NULL)
        OR (GROUPING(task_name) = 0 AND task_name IS NOT NULL)
        OR (GROUPING(work_type) = 0 AND work_type IS NOT NULL)
    )
    SELECT
      grouped_options.option_type,
      grouped_options.value,
      CASE
        WHEN grouped_options.option_type = 'workType'
          THEN COALESCE(work_types.label, grouped_options.value)
        ELSE grouped_options.value
      END AS text
    FROM grouped_options
    LEFT JOIN cft_task_db.work_types work_types
      ON grouped_options.option_type = 'workType'
     AND work_types.work_type_id = grouped_options.value
    ORDER BY grouped_options.option_type ASC, text ASC, grouped_options.value ASC
  `;
}

function buildOverviewFacetWhereClause(params: {
  snapshotId: number;
  filters: AnalyticsFilters;
  queryOptions?: AnalyticsQueryOptions;
  excludeFacet: OverviewFacetFilterKey;
  includeUserFilter: boolean;
}): Prisma.Sql {
  const { snapshotId, filters, queryOptions, excludeFacet, includeUserFilter } = params;
  const branchFilters: AnalyticsFilters = {
    ...filters,
  };

  delete branchFilters[excludeFacet];
  if (!includeUserFilter) {
    delete branchFilters.user;
  }

  const conditions: Prisma.Sql[] = [asOfSnapshotCondition(snapshotId)];
  if (includeUserFilter && excludeFacet !== 'user' && filters.user && filters.user.length > 0) {
    conditions.push(Prisma.sql`assignee IN (${Prisma.join(filters.user)})`);
  }

  return buildAnalyticsWhere(branchFilters, conditions, queryOptions);
}

function buildFilteredFilterOptionsQuery(params: {
  snapshotId: number;
  filters: AnalyticsFilters;
  queryOptions?: AnalyticsQueryOptions;
  includeUserFilter: boolean;
  tableName: Prisma.Sql;
}): Prisma.Sql {
  const { snapshotId, filters, queryOptions, includeUserFilter, tableName } = params;
  const optionBranches: Prisma.Sql[] = [];

  const serviceWhere = buildOverviewFacetWhereClause({
    snapshotId,
    filters,
    queryOptions,
    excludeFacet: 'service',
    includeUserFilter,
  });
  optionBranches.push(Prisma.sql`
    SELECT
      'service'::text AS option_type,
      jurisdiction_label AS value
    FROM ${tableName}
    ${serviceWhere}
      AND jurisdiction_label IS NOT NULL
    GROUP BY jurisdiction_label
  `);

  const roleCategoryWhere = buildOverviewFacetWhereClause({
    snapshotId,
    filters,
    queryOptions,
    excludeFacet: 'roleCategory',
    includeUserFilter,
  });
  optionBranches.push(Prisma.sql`
    SELECT
      'roleCategory'::text AS option_type,
      role_category_label AS value
    FROM ${tableName}
    ${roleCategoryWhere}
      AND role_category_label IS NOT NULL
      AND BTRIM(role_category_label) <> ''
    GROUP BY role_category_label
  `);

  const regionWhere = buildOverviewFacetWhereClause({
    snapshotId,
    filters,
    queryOptions,
    excludeFacet: 'region',
    includeUserFilter,
  });
  optionBranches.push(Prisma.sql`
    SELECT
      'region'::text AS option_type,
      region AS value
    FROM ${tableName}
    ${regionWhere}
      AND region IS NOT NULL
    GROUP BY region
  `);

  const locationWhere = buildOverviewFacetWhereClause({
    snapshotId,
    filters,
    queryOptions,
    excludeFacet: 'location',
    includeUserFilter,
  });
  optionBranches.push(Prisma.sql`
    SELECT
      'location'::text AS option_type,
      location AS value
    FROM ${tableName}
    ${locationWhere}
      AND location IS NOT NULL
    GROUP BY location
  `);

  const taskNameWhere = buildOverviewFacetWhereClause({
    snapshotId,
    filters,
    queryOptions,
    excludeFacet: 'taskName',
    includeUserFilter,
  });
  optionBranches.push(Prisma.sql`
    SELECT
      'taskName'::text AS option_type,
      task_name AS value
    FROM ${tableName}
    ${taskNameWhere}
      AND task_name IS NOT NULL
    GROUP BY task_name
  `);

  const workTypeWhere = buildOverviewFacetWhereClause({
    snapshotId,
    filters,
    queryOptions,
    excludeFacet: 'workType',
    includeUserFilter,
  });
  optionBranches.push(Prisma.sql`
    SELECT
      'workType'::text AS option_type,
      work_type AS value
    FROM ${tableName}
    ${workTypeWhere}
      AND work_type IS NOT NULL
    GROUP BY work_type
  `);

  if (includeUserFilter) {
    const assigneeWhere = buildOverviewFacetWhereClause({
      snapshotId,
      filters,
      queryOptions,
      excludeFacet: 'user',
      includeUserFilter,
    });
    optionBranches.push(Prisma.sql`
      SELECT
        'assignee'::text AS option_type,
        assignee AS value
      FROM ${tableName}
      ${assigneeWhere}
        AND assignee IS NOT NULL
      GROUP BY assignee
    `);
  }

  return Prisma.sql`
    WITH option_rows AS (
      ${Prisma.join(optionBranches, ' UNION ALL ')}
    ),
    deduped_options AS (
      SELECT option_type, value
      FROM option_rows
      GROUP BY option_type, value
    )
    SELECT
      deduped_options.option_type,
      deduped_options.value,
      CASE
        WHEN deduped_options.option_type = 'workType'
          THEN COALESCE(work_types.label, deduped_options.value)
        ELSE deduped_options.value
      END AS text
    FROM deduped_options
    LEFT JOIN cft_task_db.work_types work_types
      ON deduped_options.option_type = 'workType'
     AND work_types.work_type_id = deduped_options.value
    ORDER BY deduped_options.option_type ASC, text ASC, deduped_options.value ASC
  `;
}

export async function fetchFilterOptionsRows(
  config: FilterFactsQueryConfig,
  snapshotId: number,
  params: FilterFactsQueryParams = {}
): Promise<OverviewFilterOptionsRows> {
  const filters = params.filters ?? {};
  const queryOptions = params.queryOptions;
  const requestedIncludeUserFilter = params.includeUserFilter ?? true;
  const includeUserFilter = config.supportsAssigneeFacet ? requestedIncludeUserFilter : false;
  const tableName = Prisma.raw(config.tableName);

  if (config.supportsAssigneeFacet && includeUserFilter && !hasActiveOverviewFacetFilters(filters, true)) {
    const optionRows = await tmPrisma.$queryRaw<OverviewFilterOptionRow[]>(
      buildUnfilteredUserOverviewFilterOptionsQuery(snapshotId, tableName, queryOptions)
    );
    return mapOverviewFilterOptionRows(optionRows);
  }

  if (!includeUserFilter && !hasActiveOverviewFacetFilters(filters, false)) {
    const optionRows = await tmPrisma.$queryRaw<OverviewFilterOptionRow[]>(
      buildUnfilteredNonUserOverviewFilterOptionsQuery(snapshotId, tableName, queryOptions)
    );
    return mapOverviewFilterOptionRows(optionRows);
  }

  const optionRows = await tmPrisma.$queryRaw<OverviewFilterOptionRow[]>(
    buildFilteredFilterOptionsQuery({
      snapshotId,
      filters,
      queryOptions,
      includeUserFilter,
      tableName,
    })
  );
  return mapOverviewFilterOptionRows(optionRows);
}
