import api, { route } from "@forge/api";
import { getAuditInsights } from "./getAuditInsights";
import {
  type CustomInsightConfig,
  type InsightCheckId,
  type InsightThresholds,
  type IssueLike
} from "../types/insights";

type DashboardConfig = {
  jql?: string;
  limit?: number;
  displayLimit?: number;
  priorityOffset?: number;
  enabledChecks?: InsightCheckId[];
  customCheck?: CustomInsightConfig;
  thresholds?: Partial<InsightThresholds>;
};

type JiraSearchResponse = {
  issues?: JiraIssue[];
  total?: number;
};

type JiraIssue = {
  key: string;
  fields: {
    status?: {
      name?: string;
    };
    assignee?: {
      accountId?: string;
    } | null;
    priority?: {
      name?: string;
    } | null;
    updated?: string;
    created?: string;
    duedate?: string | null;
    statuscategorychangedate?: string | null;
    summary?: string;
  };
};

type DashboardAuditInsightsResult = Awaited<ReturnType<typeof getAuditInsights>> & {
  query: {
    jql: string;
    issueCount: number;
    sampleSize: number;
    totalAvailable: number;
    displayLimit: number;
    priorityOffset: number;
    enabledChecks: InsightCheckId[];
  };
};

const DEFAULT_JQL = "project is not EMPTY ORDER BY updated DESC";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_DISPLAY_LIMIT = 4;
const DEFAULT_ENABLED_CHECKS: InsightCheckId[] = [
  "overdue",
  "stale",
  "sla-risk",
  "aging-status"
];

function normalizeJqlText(value: string): string {
  let normalized = value;

  for (let i = 0; i < 3; i += 1) {
    const nextValue = normalized
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, "&");

    if (nextValue === normalized) {
      break;
    }

    normalized = nextValue;
  }

  return normalized;
}

function splitOrderByClause(jql: string): { filterJql: string; orderByClause: string } {
  const match = jql.match(/^(.*?)(\s+ORDER\s+BY\s+.+)$/i);

  if (!match) {
    return {
      filterJql: jql.trim(),
      orderByClause: ""
    };
  }

  return {
    filterJql: match[1].trim(),
    orderByClause: match[2].trim()
  };
}

function withBaseJql(baseJql: string, condition: string): string {
  const { filterJql, orderByClause } = splitOrderByClause(baseJql);
  const combined = `(${filterJql}) AND ${condition}`;

  return orderByClause ? `${combined} ${orderByClause}` : combined;
}

function buildDrillDownJqls(baseJql: string, thresholds: InsightThresholds) {
  return {
    overdue: withBaseJql(baseJql, "duedate < now() AND statusCategory != Done"),
    stale: withBaseJql(
      baseJql,
      `statusCategory != Done AND updated <= -${thresholds.staleAfterDays}d`
    ),
    "sla-risk": "",
    "aging-status": withBaseJql(
      baseJql,
      `statusCategory != Done AND statusCategoryChangedDate <= -${thresholds.agingInStatusDays}d`
    ),
    unassigned: withBaseJql(baseJql, "assignee is EMPTY AND statusCategory != Done"),
    "missing-due-date": withBaseJql(baseJql, "duedate is EMPTY AND statusCategory != Done"),
    "long-running-in-progress": withBaseJql(
      baseJql,
      `status = "In Progress" AND statusCategory != Done AND statusCategoryChangedDate <= -${thresholds.longRunningInProgressDays}d`
    ),
    "missing-priority": withBaseJql(baseJql, "priority is EMPTY AND statusCategory != Done"),
    "priority-mismatch": withBaseJql(
      baseJql,
      `priority in (Highest, High, Critical, Blocker) AND statusCategory != Done AND updated <= -${thresholds.highPriorityStaleDays}d`
    ),
    custom: ""
  };
}

function normalizeCustomCheck(customCheck?: Partial<CustomInsightConfig>): CustomInsightConfig {
  return {
    enabled: Boolean(customCheck?.enabled),
    title: customCheck?.title?.trim() || "Custom check",
    jqlCondition: normalizeJqlText(customCheck?.jqlCondition?.trim() || ""),
    severity: customCheck?.severity === "warning" ? "warning" : "critical",
    actionText:
      customCheck?.actionText?.trim() ||
      "Review the matching issues for this custom risk condition."
  };
}

function normalizeDisplayLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_DISPLAY_LIMIT;
  }

  return Math.max(1, Math.min(12, Math.floor(limit)));
}

function normalizePriorityOffset(offset?: number): number {
  if (offset == null || Number.isNaN(offset)) {
    return 0;
  }

  return Math.max(0, Math.floor(offset));
}

function normalizeLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

function mapIssue(issue: JiraIssue): IssueLike {
  return {
    key: issue.key,
    status: issue.fields.status?.name ?? "Unknown",
    updatedAt: issue.fields.updated ?? new Date(0).toISOString(),
    assigneeAccountId: issue.fields.assignee?.accountId ?? null,
    priorityName: issue.fields.priority?.name ?? null,
    createdAt: issue.fields.created ?? null,
    dueDate: issue.fields.duedate ?? null,
    // Jira search exposes statuscategorychangedate, which is a reasonable MVP proxy
    // for "entered current status" without requiring changelog expansion.
    statusEnteredAt: issue.fields.statuscategorychangedate ?? null,
    slaRemainingMinutes: null
  };
}

async function searchIssues(jql: string, maxResults: number): Promise<JiraSearchResponse> {
  const response = await api
    .asUser()
    .requestJira(
      route`/rest/api/3/search/jql?jql=${jql}&maxResults=${maxResults}&fields=status,assignee,priority,updated,created,duedate,statuscategorychangedate`
    );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Jira search failed (${response.status}): ${message}`);
  }

  return (await response.json()) as JiraSearchResponse;
}

export async function getDashboardAuditInsights(
  config: DashboardConfig
): Promise<DashboardAuditInsightsResult> {
  const jql = normalizeJqlText(config.jql?.trim() || DEFAULT_JQL);
  const maxResults = normalizeLimit(config.limit);
  const displayLimit = normalizeDisplayLimit(config.displayLimit);
  const priorityOffset = normalizePriorityOffset(config.priorityOffset);
  const enabledChecks =
    config.enabledChecks?.length ? config.enabledChecks : DEFAULT_ENABLED_CHECKS;
  const customCheck = normalizeCustomCheck(config.customCheck);
  const thresholds: InsightThresholds = {
    staleAfterDays: 5,
    agingInStatusDays: 7,
    slaRiskMinutes: 240,
    longRunningInProgressDays: 10,
    highPriorityStaleDays: 2,
    ...config.thresholds
  };
  const searchResult = await searchIssues(jql, maxResults);
  const issues = (searchResult.issues ?? []).map(mapIssue);
  const insights = await getAuditInsights({
    issues,
    thresholds,
    enabledChecks
  });
  const drillDownJqls = buildDrillDownJqls(jql, thresholds);
  const allInsights = insights.insights.map((insight) => ({
    ...insight,
    drillDownJql: drillDownJqls[insight.id as keyof typeof drillDownJqls] ?? insight.drillDownJql
  }));

  if (customCheck.enabled && customCheck.jqlCondition) {
    const customJql = withBaseJql(jql, customCheck.jqlCondition);
    const customSearch = await searchIssues(customJql, maxResults);
    const customCount = (customSearch.issues ?? []).length;
    const totalIssues = insights.metrics.totalIssues;
    const customPercent = totalIssues === 0 ? 0 : Math.round((customCount / totalIssues) * 100);

    allInsights.push({
      id: "custom",
      severity: customCount > 0 ? customCheck.severity : "healthy",
      title: customCheck.title,
      message: `${customCount} issues (${customPercent}%) match this custom condition.`,
      count: customCount,
      percent: customPercent,
      drillDownJql: customJql,
      actionText: customCheck.actionText
    });
  }

  return {
    ...insights,
    insights: allInsights,
    query: {
      jql,
      issueCount: issues.length,
      sampleSize: maxResults,
      totalAvailable: searchResult.total ?? issues.length,
      displayLimit,
      priorityOffset,
      enabledChecks
    }
  };
}
