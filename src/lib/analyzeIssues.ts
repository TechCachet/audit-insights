import { diffDays, isPastDate } from "./dateUtils";
import {
  type AuditInsightsResponse,
  type InsightCheckId,
  type Insight,
  type InsightThresholds,
  type IssueLike,
  type QueueHealth
} from "../types/insights";

const DONE_STATUSES = new Set(["done", "closed", "resolved"]);
const IN_PROGRESS_STATUSES = new Set(["in progress", "in-progress", "doing"]);
const HIGH_PRIORITY_NAMES = new Set(["highest", "high", "critical", "blocker"]);

function isDoneStatus(status: string): boolean {
  return DONE_STATUSES.has(status.trim().toLowerCase());
}

function isInProgressStatus(status: string): boolean {
  return IN_PROGRESS_STATUSES.has(status.trim().toLowerCase());
}

function isHighPriority(priorityName?: string | null): boolean {
  if (!priorityName) {
    return false;
  }

  return HIGH_PRIORITY_NAMES.has(priorityName.trim().toLowerCase());
}

function roundPercent(count: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round((count / total) * 100);
}

function buildInsight(input: {
  id: InsightCheckId;
  severity: Insight["severity"];
  title: string;
  count: number;
  total: number;
  drillDownJql: string;
}): Insight {
  const percent = roundPercent(input.count, input.total);

  return {
    id: input.id,
    severity: input.severity,
    title: input.title,
    count: input.count,
    percent,
    drillDownJql: input.drillDownJql,
    message: `${input.count} issues (${percent}%) match this condition.`
  };
}

function deriveHealth(insights: Insight[]): QueueHealth {
  if (insights.some((insight) => insight.severity === "critical" && insight.count > 0)) {
    return "at-risk";
  }

  if (insights.some((insight) => insight.severity === "warning" && insight.count > 0)) {
    return "watchlist";
  }

  return "healthy";
}

export function analyzeIssues(
  issues: IssueLike[],
  thresholds: InsightThresholds,
  enabledChecks: InsightCheckId[],
  now: Date = new Date()
): AuditInsightsResponse {
  const overdueCount = issues.filter((issue) => {
    if (!issue.dueDate || isDoneStatus(issue.status)) {
      return false;
    }

    return isPastDate(issue.dueDate, now);
  }).length;

  const staleCount = issues.filter((issue) => {
    if (isDoneStatus(issue.status)) {
      return false;
    }

    return diffDays(issue.updatedAt, now) >= thresholds.staleAfterDays;
  }).length;

  const slaRiskCount = issues.filter((issue) => {
    if (isDoneStatus(issue.status) || issue.slaRemainingMinutes == null) {
      return false;
    }

    return issue.slaRemainingMinutes <= thresholds.slaRiskMinutes;
  }).length;

  const agingInStatusCount = issues.filter((issue) => {
    if (isDoneStatus(issue.status) || !issue.statusEnteredAt) {
      return false;
    }

    return diffDays(issue.statusEnteredAt, now) >= thresholds.agingInStatusDays;
  }).length;

  const unassignedCount = issues.filter((issue) => {
    if (isDoneStatus(issue.status)) {
      return false;
    }

    return !issue.assigneeAccountId;
  }).length;

  const missingDueDateCount = issues.filter((issue) => {
    if (isDoneStatus(issue.status)) {
      return false;
    }

    return !issue.dueDate;
  }).length;

  const longRunningInProgressCount = issues.filter((issue) => {
    if (isDoneStatus(issue.status) || !issue.statusEnteredAt || !isInProgressStatus(issue.status)) {
      return false;
    }

    return diffDays(issue.statusEnteredAt, now) >= thresholds.longRunningInProgressDays;
  }).length;

  const missingPriorityCount = issues.filter((issue) => {
    if (isDoneStatus(issue.status)) {
      return false;
    }

    return !issue.priorityName;
  }).length;

  const priorityMismatchCount = issues.filter((issue) => {
    if (isDoneStatus(issue.status) || !isHighPriority(issue.priorityName)) {
      return false;
    }

    return diffDays(issue.updatedAt, now) >= thresholds.highPriorityStaleDays;
  }).length;

  const totalIssues = issues.length;

  const allInsights = [
    buildInsight({
      id: "overdue",
      severity: overdueCount > 0 ? "critical" : "healthy",
      title: "Overdue work",
      count: overdueCount,
      total: totalIssues,
      drillDownJql: "duedate < now() AND statusCategory != Done"
    }),
    buildInsight({
      id: "stale",
      severity: staleCount > 0 ? "warning" : "healthy",
      title: "Stale in-progress work",
      count: staleCount,
      total: totalIssues,
      drillDownJql: `statusCategory != Done AND updated <= -${thresholds.staleAfterDays}d`
    }),
    buildInsight({
      id: "sla-risk",
      severity: slaRiskCount > 0 ? "critical" : "healthy",
      title: "SLA at risk",
      count: slaRiskCount,
      total: totalIssues,
      drillDownJql: ""
    }),
    buildInsight({
      id: "aging-status",
      severity: agingInStatusCount > 0 ? "warning" : "healthy",
      title: "Aging in status",
      count: agingInStatusCount,
      total: totalIssues,
      drillDownJql: ""
    }),
    buildInsight({
      id: "unassigned",
      severity: unassignedCount > 0 ? "critical" : "healthy",
      title: "Unassigned issues",
      count: unassignedCount,
      total: totalIssues,
      drillDownJql: "assignee is EMPTY AND statusCategory != Done"
    }),
    buildInsight({
      id: "missing-due-date",
      severity: missingDueDateCount > 0 ? "warning" : "healthy",
      title: "Missing due dates",
      count: missingDueDateCount,
      total: totalIssues,
      drillDownJql: "duedate is EMPTY AND statusCategory != Done"
    }),
    buildInsight({
      id: "long-running-in-progress",
      severity: longRunningInProgressCount > 0 ? "warning" : "healthy",
      title: "Long-running in progress",
      count: longRunningInProgressCount,
      total: totalIssues,
      drillDownJql: ""
    }),
    buildInsight({
      id: "missing-priority",
      severity: missingPriorityCount > 0 ? "warning" : "healthy",
      title: "Missing priority",
      count: missingPriorityCount,
      total: totalIssues,
      drillDownJql: "priority is EMPTY AND statusCategory != Done"
    }),
    buildInsight({
      id: "priority-mismatch",
      severity: priorityMismatchCount > 0 ? "critical" : "healthy",
      title: "High priority neglected",
      count: priorityMismatchCount,
      total: totalIssues,
      drillDownJql: ""
    })
  ];
  const insights = allInsights.filter((insight) => enabledChecks.includes(insight.id));

  return {
    health: deriveHealth(insights),
    metrics: {
      totalIssues,
      overdueCount,
      staleCount,
      slaRiskCount,
      agingInStatusCount,
      unassignedCount,
      missingDueDateCount,
      longRunningInProgressCount,
      missingPriorityCount,
      priorityMismatchCount
    },
    insights
  };
}
