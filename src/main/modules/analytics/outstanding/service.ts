import {
  AssignmentSeriesPoint,
  CriticalTask,
  DueByDatePoint,
  OutstandingByLocationRow,
  OutstandingByRegionRow,
  OutstandingResponse,
  PriorityBreakdown,
  PrioritySeriesPoint,
  Task,
  TaskPriority,
  WaitTimePoint,
} from '../shared/types';
import { calculatePercent, formatDateKey, groupByDateKey } from '../shared/utils';

function dateKey(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return formatDateKey(date);
}

function tallyAssignmentSeries(tasks: Task[]): AssignmentSeriesPoint[] {
  const rows = tasks.flatMap(task => {
    const key = dateKey(task.createdDate);
    return key ? [{ key, task }] : [];
  });

  return groupByDateKey(
    rows,
    row => row.key,
    date => ({ date, open: 0, assigned: 0, unassigned: 0, assignedPct: 0, unassignedPct: 0 }),
    (point, row) => {
      if (row.task.status === 'assigned') {
        point.assigned += 1;
      } else {
        point.unassigned += 1;
      }
      point.open = point.assigned + point.unassigned;
      const assignedPct = calculatePercent(point.assigned, point.open);
      point.assignedPct = assignedPct;
      point.unassignedPct = 100 - assignedPct;
    }
  );
}

function tallyWaitTime(tasks: Task[]): WaitTimePoint[] {
  const rows = tasks.flatMap(task => {
    const assigned = dateKey(task.assignedDate);
    const created = task.createdDate ? new Date(task.createdDate) : undefined;
    const assignedDate = task.assignedDate ? new Date(task.assignedDate) : undefined;
    if (
      !assigned ||
      !created ||
      !assignedDate ||
      Number.isNaN(created.getTime()) ||
      Number.isNaN(assignedDate.getTime())
    ) {
      return [];
    }
    const diff = Math.max(0, Math.round((assignedDate.getTime() - created.getTime()) / 86400000));
    return [{ key: assigned, diff }];
  });

  return groupByDateKey(
    rows,
    row => row.key,
    date => ({ date, averageWaitDays: 0, assignedCount: 0, totalWaitDays: 0 }),
    (point, row) => {
      point.totalWaitDays += row.diff;
      point.assignedCount += 1;
      point.averageWaitDays = point.assignedCount === 0 ? 0 : point.totalWaitDays / point.assignedCount;
    }
  );
}

function tallyPrioritySeries(tasks: Task[]): PrioritySeriesPoint[] {
  const rows = tasks.flatMap(task => {
    const key = dateKey(task.dueDate);
    return key ? [{ key, task }] : [];
  });

  return groupByDateKey(
    rows,
    row => row.key,
    date => ({ date, urgent: 0, high: 0, medium: 0, low: 0 }),
    (point, row) => {
      switch (row.task.priority) {
        case TaskPriority.Urgent:
          point.urgent += 1;
          break;
        case TaskPriority.High:
          point.high += 1;
          break;
        case TaskPriority.Medium:
          point.medium += 1;
          break;
        case TaskPriority.Low:
          point.low += 1;
          break;
        default:
          break;
      }
    }
  );
}

function tallyOpenByName(tasks: Task[]): PriorityBreakdown[] {
  const map = new Map<string, PriorityBreakdown>();
  tasks.forEach(task => {
    const key = task.taskName;
    const entry = map.get(key) ?? {
      name: key,
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    switch (task.priority) {
      case TaskPriority.Urgent:
        entry.urgent += 1;
        break;
      case TaskPriority.High:
        entry.high += 1;
        break;
      case TaskPriority.Medium:
        entry.medium += 1;
        break;
      case TaskPriority.Low:
        entry.low += 1;
        break;
      default:
        break;
    }
    map.set(key, entry);
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function tallyOutstandingByLocation(tasks: Task[]): OutstandingByLocationRow[] {
  const map = new Map<string, OutstandingByLocationRow>();
  tasks.forEach(task => {
    const location = task.location || 'Unknown';
    const region = task.region || 'Unknown';
    const key = `${location}||${region}`;
    const entry = map.get(key) ?? {
      location,
      region,
      open: 0,
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    entry.open += 1;
    switch (task.priority) {
      case TaskPriority.Urgent:
        entry.urgent += 1;
        break;
      case TaskPriority.High:
        entry.high += 1;
        break;
      case TaskPriority.Medium:
        entry.medium += 1;
        break;
      case TaskPriority.Low:
        entry.low += 1;
        break;
      default:
        break;
    }
    map.set(key, entry);
  });

  return Array.from(map.values()).sort((a, b) => {
    const locationCompare = a.location.localeCompare(b.location);
    if (locationCompare !== 0) {
      return locationCompare;
    }
    return a.region.localeCompare(b.region);
  });
}

function tallyOutstandingByRegion(rows: OutstandingByLocationRow[]): OutstandingByRegionRow[] {
  const map = new Map<string, OutstandingByRegionRow>();
  rows.forEach(row => {
    const entry = map.get(row.region) ?? {
      region: row.region,
      open: 0,
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    entry.open += row.open;
    entry.urgent += row.urgent;
    entry.high += row.high;
    entry.medium += row.medium;
    entry.low += row.low;
    map.set(row.region, entry);
  });

  return Array.from(map.values()).sort((a, b) => a.region.localeCompare(b.region));
}

function buildCriticalTasks(tasks: Task[]): CriticalTask[] {
  const urgent = tasks.filter(task => task.priority === TaskPriority.Urgent || task.priority === TaskPriority.High);
  return urgent
    .sort((a, b) => {
      const aDue = a.dueDate ?? '';
      const bDue = b.dueDate ?? '';
      return aDue.localeCompare(bDue);
    })
    .slice(0, 10)
    .map(task => ({
      caseId: task.caseId,
      caseType: task.service,
      location: task.location,
      taskName: task.taskName,
      createdDate: task.createdDate,
      dueDate: task.dueDate,
      priority: task.priority,
      agentName: task.assigneeName ?? '',
    }));
}

function tallyDueByDate(tasks: Task[]): DueByDatePoint[] {
  const rows = tasks.flatMap(task => {
    const key = dateKey(task.dueDate);
    return key ? [{ key, task }] : [];
  });

  return groupByDateKey(
    rows,
    row => row.key,
    date => ({ date, totalDue: 0, open: 0, completed: 0 }),
    (point, row) => {
      if (row.task.status === 'completed') {
        point.completed += 1;
      } else {
        point.open += 1;
      }
      point.totalDue = point.open + point.completed;
    }
  );
}

class OutstandingService {
  buildOutstanding(tasks: Task[]): OutstandingResponse {
    const outstanding = tasks.filter(task => task.status !== 'completed');
    const assignedCount = outstanding.filter(task => task.status === 'assigned').length;
    const unassignedCount = outstanding.length - assignedCount;
    const outstandingByLocation = tallyOutstandingByLocation(outstanding);
    const outstandingByRegion = tallyOutstandingByRegion(outstandingByLocation);
    const summary = {
      open: outstanding.length,
      assigned: assignedCount,
      unassigned: unassignedCount,
      assignedPct: calculatePercent(assignedCount, outstanding.length),
      unassignedPct: calculatePercent(unassignedCount, outstanding.length),
      urgent: outstanding.filter(task => task.priority === TaskPriority.Urgent).length,
      high: outstanding.filter(task => task.priority === TaskPriority.High).length,
      medium: outstanding.filter(task => task.priority === TaskPriority.Medium).length,
      low: outstanding.filter(task => task.priority === TaskPriority.Low).length,
    };

    return {
      summary,
      timelines: {
        openByCreated: tallyAssignmentSeries(outstanding),
        waitTimeByAssigned: tallyWaitTime(outstanding.filter(task => task.status === 'assigned')),
        dueByDate: tallyDueByDate(tasks),
        tasksDueByPriority: tallyPrioritySeries(outstanding),
      },
      openByName: tallyOpenByName(outstanding),
      criticalTasks: buildCriticalTasks(outstanding),
      outstandingByLocation,
      outstandingByRegion,
    };
  }
}

export const outstandingService = new OutstandingService();
