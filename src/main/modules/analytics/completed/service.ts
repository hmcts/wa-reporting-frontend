import { sortByTotalThenName } from '../shared/sorting';
import {
  CompletedByLocationRow,
  CompletedByName,
  CompletedByRegionRow,
  CompletedPoint,
  CompletedProcessingHandlingPoint,
  CompletedResponse,
  HandlingTimeStats,
  Task,
} from '../shared/types';
import { formatDateKey, groupByDateKey, isWithinDue } from '../shared/utils';

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

function buildTimeline(tasks: Task[]): CompletedPoint[] {
  const rows = tasks.flatMap(task => {
    const key = dateKey(task.completedDate);
    return key ? [{ key, task }] : [];
  });

  return groupByDateKey(
    rows,
    row => row.key,
    date => ({ date, completed: 0, withinDue: 0, beyondDue: 0 }),
    (point, row) => {
      point.completed += 1;
      if (isWithinDue(row.task)) {
        point.withinDue += 1;
      } else {
        point.beyondDue += 1;
      }
    }
  );
}

function buildCompletedByName(tasks: Task[]): CompletedByName[] {
  const map = new Map<string, { tasks: number; within: number; beyond: number }>();

  tasks.forEach(task => {
    const entry = map.get(task.taskName) ?? { tasks: 0, within: 0, beyond: 0 };
    entry.tasks += 1;
    if (isWithinDue(task)) {
      entry.within += 1;
    } else {
      entry.beyond += 1;
    }
    map.set(task.taskName, entry);
  });

  return sortByTotalThenName(
    Array.from(map.entries()).map(([taskName, data]) => ({
      taskName,
      tasks: data.tasks,
      withinDue: data.within,
      beyondDue: data.beyond,
    })),
    row => row.tasks,
    row => row.taskName
  );
}

function buildHandlingStats(tasks: Task[], metric: 'handlingTime' | 'processingTime'): HandlingTimeStats {
  const values = tasks
    .map(task => (metric === 'handlingTime' ? task.handlingTimeDays : task.processingTimeDays))
    .filter((value): value is number => typeof value === 'number');

  if (values.length === 0) {
    return {
      metric,
      averageDays: 0,
      lowerRange: 0,
      upperRange: 0,
    };
  }

  const total = values.reduce((a, b) => a + b, 0);
  const average = total / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const lowerRange = sorted[Math.floor(sorted.length * 0.25)];
  const upperRange = sorted[Math.floor(sorted.length * 0.75)];

  return {
    metric,
    averageDays: average,
    lowerRange,
    upperRange,
  };
}

function buildStdDevPop(values: number[], average: number): number {
  if (values.length === 0) {
    return 0;
  }
  const variance = values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function buildProcessingHandlingTime(tasks: Task[]): CompletedProcessingHandlingPoint[] {
  const map = new Map<
    string,
    {
      tasks: number;
      handlingValues: number[];
      processingValues: number[];
    }
  >();

  tasks.forEach(task => {
    const key = dateKey(task.completedDate);
    if (!key) {
      return;
    }
    const entry = map.get(key) ?? { tasks: 0, handlingValues: [], processingValues: [] };
    entry.tasks += 1;
    if (typeof task.handlingTimeDays === 'number' && Number.isFinite(task.handlingTimeDays)) {
      entry.handlingValues.push(task.handlingTimeDays);
    }
    if (typeof task.processingTimeDays === 'number' && Number.isFinite(task.processingTimeDays)) {
      entry.processingValues.push(task.processingTimeDays);
    }
    map.set(key, entry);
  });

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, entry]) => {
      const handlingAverage =
        entry.handlingValues.length === 0
          ? 0
          : entry.handlingValues.reduce((sum, value) => sum + value, 0) / entry.handlingValues.length;
      const processingAverage =
        entry.processingValues.length === 0
          ? 0
          : entry.processingValues.reduce((sum, value) => sum + value, 0) / entry.processingValues.length;

      return {
        date,
        tasks: entry.tasks,
        handlingAverageDays: handlingAverage,
        handlingStdDevDays: buildStdDevPop(entry.handlingValues, handlingAverage),
        handlingSumDays: entry.handlingValues.reduce((sum, value) => sum + value, 0),
        handlingCount: entry.handlingValues.length,
        processingAverageDays: processingAverage,
        processingStdDevDays: buildStdDevPop(entry.processingValues, processingAverage),
        processingSumDays: entry.processingValues.reduce((sum, value) => sum + value, 0),
        processingCount: entry.processingValues.length,
      };
    });
}

class CompletedService {
  buildCompleted(tasks: Task[]): CompletedResponse {
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const today = formatDateKey(new Date());
    const completedTodayTasks = completedTasks.filter(task => dateKey(task.completedDate) === today);
    const completedToday = completedTodayTasks.length;

    const withinDueYes = completedTasks.filter(task => isWithinDue(task)).length;
    const withinDueNo = completedTasks.length - withinDueYes;
    const withinDueTodayYes = completedTodayTasks.filter(task => isWithinDue(task)).length;
    const withinDueTodayNo = completedTodayTasks.length - withinDueTodayYes;

    return {
      summary: {
        completedToday,
        completedInRange: completedTasks.length,
        withinDueYes,
        withinDueNo,
        withinDueTodayYes,
        withinDueTodayNo,
      },
      timeline: buildTimeline(completedTasks),
      completedByName: buildCompletedByName(completedTasks),
      handlingTimeStats: buildHandlingStats(completedTasks, 'handlingTime'),
      processingHandlingTime: buildProcessingHandlingTime(completedTasks),
    };
  }

  buildCompletedByRegionLocation(tasks: Task[]): {
    byLocation: CompletedByLocationRow[];
    byRegion: CompletedByRegionRow[];
  } {
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const locationMap = new Map<string, CompletedByLocationRow>();
    const regionMap = new Map<string, CompletedByRegionRow>();

    completedTasks.forEach(task => {
      const locationKey = `${task.location ?? 'Unknown'}|${task.region ?? 'Unknown'}`;
      const locationEntry = locationMap.get(locationKey) ?? {
        location: task.location ?? 'Unknown',
        region: task.region ?? 'Unknown',
        tasks: 0,
        withinDue: 0,
        beyondDue: 0,
      };
      locationEntry.tasks += 1;
      if (isWithinDue(task)) {
        locationEntry.withinDue += 1;
      } else {
        locationEntry.beyondDue += 1;
      }
      locationMap.set(locationKey, locationEntry);

      const regionKey = task.region ?? 'Unknown';
      const regionEntry = regionMap.get(regionKey) ?? {
        region: task.region ?? 'Unknown',
        tasks: 0,
        withinDue: 0,
        beyondDue: 0,
      };
      regionEntry.tasks += 1;
      if (isWithinDue(task)) {
        regionEntry.withinDue += 1;
      } else {
        regionEntry.beyondDue += 1;
      }
      regionMap.set(regionKey, regionEntry);
    });

    const byLocation = Array.from(locationMap.values()).sort((a, b) => {
      const locationCompare = a.location!.localeCompare(b.location!);
      if (locationCompare !== 0) {
        return locationCompare;
      }
      return a.region!.localeCompare(b.region!);
    });
    const byRegion = Array.from(regionMap.values()).sort((a, b) => a.region!.localeCompare(b.region!));

    return { byLocation, byRegion };
  }
}

export const completedService = new CompletedService();
export const __testing = { buildHandlingStats, buildProcessingHandlingTime };
