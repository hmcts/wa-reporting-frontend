export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'open' | 'assigned' | 'completed';
export type PrioritySummary = {
  urgent: number;
  high: number;
  medium: number;
  low: number;
};

export interface AnalyticsFilters {
  service?: string[];
  roleCategory?: string[];
  region?: string[];
  location?: string[];
  taskName?: string[];
  user?: string[];
  completedFrom?: Date;
  completedTo?: Date;
  eventsFrom?: Date;
  eventsTo?: Date;
}

export interface TaskEventsByServiceRow {
  service: string;
  completed: number;
  cancelled: number;
  created: number;
}

export interface TaskEventsByServiceResponse {
  rows: TaskEventsByServiceRow[];
  totals: TaskEventsByServiceRow;
}

export interface Task {
  caseId: string;
  taskId: string;
  service: string;
  roleCategory: string;
  region: string;
  location: string;
  taskName: string;
  priority: TaskPriority;
  status?: TaskStatus;
  createdDate: string;
  assignedDate?: string;
  dueDate?: string;
  completedDate?: string;
  assigneeId?: string;
  assigneeName?: string;
  handlingTimeDays?: number;
  processingTimeDays?: number;
  totalAssignments?: number;
  withinSla?: boolean | null;
}

export interface ServiceOverviewRow {
  service: string;
  open: number;
  assigned: number;
  assignedPct: number;
  urgent: number;
  high: number;
  medium: number;
  low: number;
}

export interface OverviewResponse {
  serviceRows: ServiceOverviewRow[];
  totals: ServiceOverviewRow;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface PrioritySeriesPoint {
  date: string;
  urgent: number;
  high: number;
  medium: number;
  low: number;
}

export interface PriorityBreakdown {
  name: string;
  urgent: number;
  high: number;
  medium: number;
  low: number;
}

export interface CriticalTask {
  caseId: string;
  caseType: string;
  location: string;
  taskName: string;
  createdDate: string;
  dueDate?: string;
  priority: string;
  agentName: string;
}

export interface AssignmentSeriesPoint {
  date: string;
  open: number;
  assigned: number;
  unassigned: number;
  assignedPct: number;
  unassignedPct: number;
}

export interface WaitTimePoint {
  date: string;
  averageWaitDays: number;
  assignedCount: number;
  totalWaitDays: number;
}

export interface DueByDatePoint {
  date: string;
  totalDue: number;
  open: number;
  completed: number;
}

export interface OutstandingByLocationRow {
  location: string;
  region: string;
  open: number;
  urgent: number;
  high: number;
  medium: number;
  low: number;
}

export interface OutstandingByRegionRow {
  region: string;
  open: number;
  urgent: number;
  high: number;
  medium: number;
  low: number;
}

export interface CompletedByLocationRow {
  location: string | null;
  region: string | null;
  tasks: number;
  withinDue: number;
  beyondDue: number;
  handlingTimeDays?: number | null;
  processingTimeDays?: number | null;
}

export interface CompletedByRegionRow {
  region: string | null;
  tasks: number;
  withinDue: number;
  beyondDue: number;
  handlingTimeDays?: number | null;
  processingTimeDays?: number | null;
}

export interface OutstandingResponse {
  summary: {
    open: number;
    assigned: number;
    unassigned: number;
    assignedPct: number;
    unassignedPct: number;
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  timelines: {
    openByCreated: AssignmentSeriesPoint[];
    waitTimeByAssigned: WaitTimePoint[];
    dueByDate: DueByDatePoint[];
    tasksDueByPriority: PrioritySeriesPoint[];
  };
  openByName: PriorityBreakdown[];
  criticalTasks: CriticalTask[];
  outstandingByLocation: OutstandingByLocationRow[];
  outstandingByRegion: OutstandingByRegionRow[];
}

export interface CompletedPoint {
  date: string;
  completed: number;
  withinDue: number;
  beyondDue: number;
}

export type CompletedMetric = 'handlingTime' | 'processingTime';

export interface CompletedProcessingHandlingPoint {
  date: string;
  tasks: number;
  handlingAverageDays: number;
  handlingStdDevDays: number;
  handlingSumDays: number;
  handlingCount: number;
  processingAverageDays: number;
  processingStdDevDays: number;
  processingSumDays: number;
  processingCount: number;
}

export interface CompletedByName {
  taskName: string;
  tasks: number;
  withinDue: number;
  beyondDue: number;
}

export interface HandlingTimeStats {
  metric: 'handlingTime' | 'processingTime';
  averageDays: number;
  lowerRange: number;
  upperRange: number;
}

export interface TaskAuditRow {
  taskName: string;
  agentName: string;
  completedDate: string;
  totalAssignments: number;
  location: string;
  status: string;
}

export interface CompletedResponse {
  summary: {
    completedToday: number;
    completedInRange: number;
    withinDueYes: number;
    withinDueNo: number;
    withinDueTodayYes: number;
    withinDueTodayNo: number;
  };
  timeline: CompletedPoint[];
  completedByName: CompletedByName[];
  handlingTimeStats: HandlingTimeStats;
  processingHandlingTime: CompletedProcessingHandlingPoint[];
}

export interface TaskAuditResponse {
  caseId: string;
  tasks: TaskAuditRow[];
}

export interface UserTaskRow {
  caseId: string;
  taskName: string;
  createdDate: string;
  assignedDate?: string;
  dueDate?: string;
  completedDate?: string;
  handlingTimeDays?: number;
  withinDue?: boolean | null;
  priority: string;
  totalAssignments: number;
  assigneeName?: string;
  location: string;
  status: string;
}

export interface UserCompletedSummary {
  total: number;
  withinDueYes: number;
  withinDueNo: number;
}

export interface UserOverviewResponse {
  assigned: UserTaskRow[];
  completed: UserTaskRow[];
  prioritySummary: PrioritySummary;
  completedSummary: UserCompletedSummary;
}
