import { diffDays, isPastDate } from "./dateUtils";
import {
  type AuditInsightsResponse,
  type Insight,
  type InsightThresholds,
  type IssueLike,
  type QueueHealth
} from "../types/insights";

const DONE_STATUSES = new Set(["done", "closed", "resolved"]);

function isDoneStatus(status: string): boolean {
  return DONE_STATUSES.has(status.trim().toLowerCase());
}

function roundPercent(count: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round((count / total) * 100);
}

function buildInsight(input: {
  id: string;
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

  const totalIssues = issues.length;

  const insights = [
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
    })
  ];

  return {
    health: deriveHealth(insights),
    metrics: {
      totalIssues,
      overdueCount,
      staleCount,
      slaRiskCount,
      agingInStatusCount
    },
    insights
  };
}

