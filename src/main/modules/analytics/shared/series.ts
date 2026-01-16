import {
  AssignmentSeriesPoint,
  OutstandingResponse,
  PrioritySeriesPoint,
  ServiceOverviewRow,
  TaskEventsByServiceRow,
} from './types';

export function emptyAssignmentSeriesPoint(date: string): AssignmentSeriesPoint {
  return {
    date,
    open: 0,
    assigned: 0,
    unassigned: 0,
    assignedPct: 0,
    unassignedPct: 0,
  };
}

export function emptyPrioritySeriesPoint(date: string): PrioritySeriesPoint {
  return { date, urgent: 0, high: 0, medium: 0, low: 0 };
}

export function emptyOutstandingSummary(): OutstandingResponse['summary'] {
  return {
    open: 0,
    assigned: 0,
    unassigned: 0,
    assignedPct: 0,
    unassignedPct: 0,
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
}

export function emptyServiceOverviewRow(service: string): ServiceOverviewRow {
  return {
    service,
    open: 0,
    assigned: 0,
    assignedPct: 0,
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
}

export function emptyTaskEventsByServiceRow(service: string): TaskEventsByServiceRow {
  return { service, completed: 0, cancelled: 0, created: 0 };
}
