import { analyzeIssues } from "../lib/analyzeIssues";
import { type InsightCheckId, type InsightThresholds, type IssueLike } from "../types/insights";

type GetAuditInsightsParams = {
  issues: IssueLike[];
  thresholds?: Partial<InsightThresholds>;
  enabledChecks?: InsightCheckId[];
};

const DEFAULT_THRESHOLDS: InsightThresholds = {
  staleAfterDays: 5,
  agingInStatusDays: 7,
  slaRiskMinutes: 240,
  longRunningInProgressDays: 10,
  highPriorityStaleDays: 2
};

const DEFAULT_ENABLED_CHECKS: InsightCheckId[] = [
  "overdue",
  "stale",
  "sla-risk",
  "aging-status"
];

export async function getAuditInsights(params: GetAuditInsightsParams) {
  const thresholds: InsightThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...params.thresholds
  };

  return analyzeIssues(params.issues, thresholds, params.enabledChecks ?? DEFAULT_ENABLED_CHECKS);
}
