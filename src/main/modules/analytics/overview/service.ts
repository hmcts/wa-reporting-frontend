import { OverviewResponse, ServiceOverviewRow, Task } from '../shared/types';

function emptyRow(service: string): ServiceOverviewRow {
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

function addTaskToRow(row: ServiceOverviewRow, task: Task): void {
  if (task.status === 'open') {
    row.open += 1;
  }
  if (task.status === 'assigned') {
    row.assigned += 1;
  }

  switch (task.priority) {
    case 'urgent':
      row.urgent += 1;
      break;
    case 'high':
      row.high += 1;
      break;
    case 'medium':
      row.medium += 1;
      break;
    case 'low':
      row.low += 1;
      break;
    default:
      break;
  }
}

function finaliseRow(row: ServiceOverviewRow): void {
  const total = row.open + row.assigned;
  row.assignedPct = total === 0 ? 0 : (row.assigned / total) * 100;
}

class OverviewService {
  buildOverview(tasks: Task[]): OverviewResponse {
    const activeTasks = tasks.filter(task => task.status !== 'completed');
    const rowsByService = new Map<string, ServiceOverviewRow>();

    activeTasks.forEach(task => {
      const row = rowsByService.get(task.service) ?? emptyRow(task.service);
      addTaskToRow(row, task);
      rowsByService.set(task.service, row);
    });

    const serviceRows = Array.from(rowsByService.values()).map(row => {
      finaliseRow(row);
      return row;
    });

    const totals = serviceRows.reduce((acc, row) => {
      acc.open += row.open;
      acc.assigned += row.assigned;
      acc.urgent += row.urgent;
      acc.high += row.high;
      acc.medium += row.medium;
      acc.low += row.low;
      return acc;
    }, emptyRow('Total'));

    finaliseRow(totals);

    return {
      serviceRows,
      totals,
    };
  }
}

export const overviewService = new OverviewService();
