import moment from 'moment';

import { AnalyticsFilters } from '../types';

export interface FilterValidationResult {
  filters: AnalyticsFilters;
  errors: string[];
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toOptionalStringArray(value: unknown): string[] | undefined {
  if (typeof value === 'string') {
    return value.trim().length > 0 ? [value] : undefined;
  }
  if (Array.isArray(value)) {
    const values = value.map(item => (typeof item === 'string' ? item : '')).filter(item => item.trim().length > 0);
    return values.length > 0 ? Array.from(new Set(values)) : undefined;
  }
  return undefined;
}

function parseDate(value: string): Date | undefined {
  const parsed = moment.utc(value, ['YYYY-MM-DD', 'D/M/YYYY', 'DD/MM/YYYY'], true);
  if (!parsed.isValid()) {
    return undefined;
  }
  return parsed.toDate();
}

function parseDateParts(prefix: string, raw: Record<string, unknown>): Date | undefined {
  const day = toOptionalString(raw[`${prefix}-day`]);
  const month = toOptionalString(raw[`${prefix}-month`]);
  const year = toOptionalString(raw[`${prefix}-year`]);

  if (!day && !month && !year) {
    return undefined;
  }

  if (!day || !month || !year) {
    return undefined;
  }

  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return parseDate(iso);
}

export function validateFilters(raw: Record<string, unknown>): FilterValidationResult {
  const errors: string[] = [];
  const filters: AnalyticsFilters = {
    service: toOptionalStringArray(raw.service),
    roleCategory: toOptionalStringArray(raw.roleCategory),
    region: toOptionalStringArray(raw.region),
    location: toOptionalStringArray(raw.location),
    taskName: toOptionalStringArray(raw.taskName),
    workType: toOptionalStringArray(raw.workType),
    user: toOptionalStringArray(raw.user),
  };

  const completedFromRaw = toOptionalString(raw.completedFrom);
  const completedToRaw = toOptionalString(raw.completedTo);
  const completedFromParts = parseDateParts('completedFrom', raw);
  const completedToParts = parseDateParts('completedTo', raw);

  if (completedFromRaw || completedFromParts) {
    const parsed = completedFromRaw ? parseDate(completedFromRaw) : completedFromParts;
    if (parsed) {
      filters.completedFrom = parsed;
    } else {
      errors.push('completedFrom must be a valid date');
    }
  }

  if (completedToRaw || completedToParts) {
    const parsed = completedToRaw ? parseDate(completedToRaw) : completedToParts;
    if (parsed) {
      filters.completedTo = parsed;
    } else {
      errors.push('completedTo must be a valid date');
    }
  }

  if (filters.completedFrom && filters.completedTo && filters.completedFrom > filters.completedTo) {
    errors.push('completedFrom must be before completedTo');
  }

  const eventsFromRaw = toOptionalString(raw.eventsFrom);
  const eventsToRaw = toOptionalString(raw.eventsTo);
  const eventsFromParts = parseDateParts('eventsFrom', raw);
  const eventsToParts = parseDateParts('eventsTo', raw);

  if (eventsFromRaw || eventsFromParts) {
    const parsed = eventsFromRaw ? parseDate(eventsFromRaw) : eventsFromParts;
    if (parsed) {
      filters.eventsFrom = parsed;
    } else {
      errors.push('eventsFrom must be a valid date');
    }
  }

  if (eventsToRaw || eventsToParts) {
    const parsed = eventsToRaw ? parseDate(eventsToRaw) : eventsToParts;
    if (parsed) {
      filters.eventsTo = parsed;
    } else {
      errors.push('eventsTo must be a valid date');
    }
  }

  if (filters.eventsFrom && filters.eventsTo && filters.eventsFrom > filters.eventsTo) {
    errors.push('eventsFrom must be before eventsTo');
  }

  return { filters, errors };
}
