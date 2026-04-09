export type InsightSeverity = "critical" | "warning" | "healthy";

export type QueueHealth = "healthy" | "watchlist" | "at-risk";

export type IssueLike = {
  key: string;
  status: string;
  updatedAt: string;
  dueDate?: string | null;
  createdAt?: string | null;
  statusEnteredAt?: string | null;
  slaRemainingMinutes?: number | null;
};

export type InsightThresholds = {
  staleAfterDays: number;
  agingInStatusDays: number;
  slaRiskMinutes: number;
};

export type Insight = {
  id: string;
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
};

export type AuditInsightsResponse = {
  health: QueueHealth;
  metrics: InsightMetrics;
  insights: Insight[];
};

