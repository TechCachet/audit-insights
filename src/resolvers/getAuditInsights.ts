import { analyzeIssues } from "../lib/analyzeIssues";
import { type InsightThresholds, type IssueLike } from "../types/insights";

type GetAuditInsightsParams = {
  issues: IssueLike[];
  thresholds?: Partial<InsightThresholds>;
};

const DEFAULT_THRESHOLDS: InsightThresholds = {
  staleAfterDays: 5,
  agingInStatusDays: 7,
  slaRiskMinutes: 240
};

export async function getAuditInsights(params: GetAuditInsightsParams) {
  const thresholds: InsightThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...params.thresholds
  };

  return analyzeIssues(params.issues, thresholds);
}
