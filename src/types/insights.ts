export type InsightSeverity = "critical" | "warning" | "healthy";

export type QueueHealth = "healthy" | "watchlist" | "at-risk";

export type InsightCheckId =
  | "overdue"
  | "stale"
  | "sla-risk"
  | "aging-status"
  | "unassigned"
  | "missing-due-date"
  | "long-running-in-progress"
  | "missing-priority"
  | "priority-mismatch";

export type IssueLike = {
  key: string;
  status: string;
  updatedAt: string;
  assigneeAccountId?: string | null;
  priorityName?: string | null;
  dueDate?: string | null;
  createdAt?: string | null;
  statusEnteredAt?: string | null;
  slaRemainingMinutes?: number | null;
};

export type InsightThresholds = {
  staleAfterDays: number;
  agingInStatusDays: number;
  slaRiskMinutes: number;
  longRunningInProgressDays: number;
  highPriorityStaleDays: number;
};

export type Insight = {
  id: InsightCheckId;
  severity: InsightSeverity;
  title: string;
  message: string;
  count: number;
  percent: number;
  drillDownJql: string;
};

export type InsightMetrics = {
  totalIssues: number;
  overdueCount: number;
  staleCount: number;
  slaRiskCount: number;
  agingInStatusCount: number;
  unassignedCount: number;
  missingDueDateCount: number;
  longRunningInProgressCount: number;
  missingPriorityCount: number;
  priorityMismatchCount: number;
};

export type AuditInsightsResponse = {
  health: QueueHealth;
  metrics: InsightMetrics;
  insights: Insight[];
};
