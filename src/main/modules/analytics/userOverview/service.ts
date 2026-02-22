import { Task, TaskPriority, UserOverviewResponse, UserTaskRow } from '../shared/types';
import { formatDateKey, isWithinDue } from '../shared/utils';

export interface UserOverviewMetrics extends UserOverviewResponse {
  completedByDate: CompletedByDatePoint[];
}

export interface CompletedByDatePoint {
  date: string;
  tasks: number;
  withinDue: number;
  beyondDue: number;
  handlingTimeSum: number;
  handlingTimeCount: number;
}

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

function buildTaskRow(task: Task): UserTaskRow {
  return {
    caseId: task.caseId,
    taskName: task.taskName,
    createdDate: task.createdDate,
    assignedDate: task.assignedDate,
    dueDate: task.dueDate,
    completedDate: task.completedDate,
    handlingTimeDays: task.handlingTimeDays,
    withinDue: task.status === 'completed' ? isWithinDue(task) : null,
    priority: task.priority,
    totalAssignments: task.totalAssignments ?? 0,
    assigneeName: task.assigneeName,
    location: task.location,
    status: task.status ?? 'open',
  };
}

function buildCompletedByDate(tasks: Task[]): CompletedByDatePoint[] {
  const map = new Map<
    string,
    { tasks: number; withinDue: number; beyondDue: number; handlingTimeSum: number; handlingTimeCount: number }
  >();
  tasks.forEach(task => {
    const key = dateKey(task.completedDate);
    if (!key) {
      return;
    }
    const entry = map.get(key) ?? {
      tasks: 0,
      withinDue: 0,
      beyondDue: 0,
      handlingTimeSum: 0,
      handlingTimeCount: 0,
    };
    entry.tasks += 1;
    if (isWithinDue(task)) {
      entry.withinDue += 1;
    } else {
      entry.beyondDue += 1;
    }
    if (typeof task.handlingTimeDays === 'number' && Number.isFinite(task.handlingTimeDays)) {
      entry.handlingTimeSum += task.handlingTimeDays;
      entry.handlingTimeCount += 1;
    }
    map.set(key, entry);
  });
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, ...value }));
}

class UserOverviewService {
  buildUserOverview(tasks: Task[]): UserOverviewMetrics {
    const assignedTasks = tasks.filter(task => task.status === 'assigned' || task.status === 'open');
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const withinDueYes = completedTasks.filter(task => isWithinDue(task)).length;
    const withinDueNo = completedTasks.length - withinDueYes;

    const prioritySummary = assignedTasks.reduce(
      (acc, task) => {
        switch (task.priority) {
          case TaskPriority.Urgent:
            acc.urgent += 1;
            break;
          case TaskPriority.High:
            acc.high += 1;
            break;
          case TaskPriority.Medium:
            acc.medium += 1;
            break;
          case TaskPriority.Low:
            acc.low += 1;
            break;
          default:
            break;
        }
        return acc;
      },
      { urgent: 0, high: 0, medium: 0, low: 0 }
    );

    return {
      assigned: assignedTasks.map(buildTaskRow),
      completed: completedTasks.map(buildTaskRow),
      prioritySummary,
      completedSummary: {
        total: completedTasks.length,
        withinDueYes,
        withinDueNo,
      },
      completedByDate: buildCompletedByDate(completedTasks),
    };
  }
}

export const userOverviewService = new UserOverviewService();
