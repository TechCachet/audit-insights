import { useEffect, useState } from "react";
import { invoke, router, view } from "@forge/bridge";

type InsightCheckId =
  | "overdue"
  | "stale"
  | "sla-risk"
  | "aging-status"
  | "unassigned"
  | "missing-due-date"
  | "long-running-in-progress"
  | "missing-priority"
  | "priority-mismatch";

type GadgetConfig = {
  jql: string;
  limit: number;
  refresh?: number;
  displayLimit?: number;
  priorityOffset?: number;
  enabledChecks?: InsightCheckId[];
  thresholds: {
    staleAfterDays: number;
    agingInStatusDays: number;
    slaRiskMinutes: number;
    longRunningInProgressDays: number;
    highPriorityStaleDays: number;
  };
};

type InsightSeverity = "critical" | "warning" | "healthy";
type QueueHealth = "healthy" | "watchlist" | "at-risk";

type DashboardData = {
  health: QueueHealth;
  metrics: {
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
  insights: Array<{
    id: InsightCheckId;
    title: string;
    message: string;
    count: number;
    percent: number;
    severity: InsightSeverity;
    drillDownJql: string;
  }>;
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

type ViewContext = {
  siteUrl?: string;
  extension?: { gadgetConfiguration?: Partial<GadgetConfig> };
};

const DEFAULT_CONFIG: GadgetConfig = {
  jql: "project is not EMPTY ORDER BY updated DESC",
  limit: 50,
  refresh: 15,
  displayLimit: 4,
  priorityOffset: 0,
  enabledChecks: ["overdue", "stale", "sla-risk", "aging-status"],
  thresholds: {
    staleAfterDays: 5,
    agingInStatusDays: 7,
    slaRiskMinutes: 240,
    longRunningInProgressDays: 10,
    highPriorityStaleDays: 2
  }
};

const ACTION_GUIDANCE: Record<string, string> = {
  overdue: "Review overdue issues first and reassign or escalate anything blocked.",
  stale: "Check for blockers and confirm each item still has an active owner.",
  "sla-risk": "Prioritize the nearest SLA deadlines before they breach.",
  "aging-status": "Inspect this workflow step for bottlenecks, approvals, or queue buildup.",
  unassigned: "Assign ownership now so these issues do not sit in queue without accountability.",
  "missing-due-date": "Add due dates to work that needs deadline visibility and audit traceability.",
  "long-running-in-progress": "Check why these active issues have remained in progress for so long.",
  "missing-priority": "Set priorities so triage and reporting reflect the actual business impact.",
  "priority-mismatch": "Review neglected high-priority work immediately and escalate if ownership is unclear."
};

const SEVERITY_WEIGHT: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  healthy: 2
};

function sortInsights(insights: DashboardData["insights"]) {
  return [...insights].sort((left, right) => {
    const severityDelta = SEVERITY_WEIGHT[left.severity] - SEVERITY_WEIGHT[right.severity];

    if (severityDelta !== 0) {
      return severityDelta;
    }

    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return right.percent - left.percent;
  });
}

function mergeConfig(config?: Partial<GadgetConfig>): GadgetConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    thresholds: {
      ...DEFAULT_CONFIG.thresholds,
      ...config?.thresholds
    }
  };
}

function HealthBadge({ health }: { health: QueueHealth }) {
  return (
    <span className={`badge badge-${health}`}>
      Queue Health: {health.replace("-", " ")}
    </span>
  );
}

function MetricCard(props: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "critical";
}) {
  return (
    <section className={`metric-card metric-${props.tone ?? "neutral"}`}>
      <div className="metric-label">{props.label}</div>
      <div className="metric-value">{props.value}</div>
    </section>
  );
}

type MetricTone = "neutral" | "warning" | "critical";

export function App() {
  const [config, setConfig] = useState<GadgetConfig | null>(null);
  const [siteUrl, setSiteUrl] = useState<string>("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeTick, setTimeTick] = useState<number>(Date.now());

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const context = (await view.getContext()) as ViewContext;
        const resolvedConfig = mergeConfig(context.extension?.gadgetConfiguration);

        if (!cancelled) {
          setConfig(resolvedConfig);
          setSiteUrl(context.siteUrl ?? "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load audit insights.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config) {
      return;
    }

    const currentConfig = config;
    let cancelled = false;

    async function loadInsights(isManualRefresh = false) {
      if (isManualRefresh) {
        setRefreshing(true);
      } else if (!data) {
        setLoading(true);
      }

      try {
        const result = await invoke<DashboardData>("getDashboardAuditInsights", currentConfig);

        if (!cancelled) {
          setData(result);
          setError(null);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load audit insights.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void loadInsights();

    const refreshMinutes = currentConfig.refresh ?? DEFAULT_CONFIG.refresh ?? 15;
    const refreshMs = refreshMinutes > 0 ? refreshMinutes * 60 * 1000 : 0;
    const refreshInterval = refreshMs
      ? setInterval(() => {
          void loadInsights();
        }, refreshMs)
      : null;

    return () => {
      cancelled = true;

      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [config]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeTick(Date.now());
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  async function handleRefresh() {
    if (!config) {
      return;
    }

    const currentConfig = config;
    setRefreshing(true);

    try {
      const result = await invoke<DashboardData>("getDashboardAuditInsights", currentConfig);
      setData(result);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load audit insights.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function formatLastUpdated(timestamp: Date | null): string {
    if (!timestamp) {
      return "Updating now";
    }

    const elapsedSeconds = Math.max(0, Math.floor((timeTick - timestamp.getTime()) / 1000));

    if (elapsedSeconds < 60) {
      return "Updated just now";
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);

    if (elapsedMinutes < 60) {
      return `Updated ${elapsedMinutes} min ago`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    return `Updated ${elapsedHours}h ago`;
  }

  if (loading) {
    return <div className="state-panel">Loading audit insights...</div>;
  }

  if (error) {
    return <div className="state-panel error-panel">{error}</div>;
  }

  if (!data || !config) {
    return <div className="state-panel">No insight data returned.</div>;
  }

  const orderedInsights = sortInsights(data.insights);
  const visibleInsights = orderedInsights.slice(
    data.query.priorityOffset,
    data.query.priorityOffset + data.query.displayLimit
  );

  const summaryMetrics: Array<{ id: string; label: string; value: number; tone: MetricTone }> = [
    { id: "total", label: "Total issues", value: data.metrics.totalIssues, tone: "neutral" as const },
    {
      id: "overdue",
      label: "Overdue",
      value: data.metrics.overdueCount,
      tone: data.metrics.overdueCount > 0 ? ("critical" as const) : ("neutral" as const)
    },
    {
      id: "stale",
      label: "Stale",
      value: data.metrics.staleCount,
      tone: data.metrics.staleCount > 0 ? ("warning" as const) : ("neutral" as const)
    },
    {
      id: "sla-risk",
      label: "SLA at risk",
      value: data.metrics.slaRiskCount,
      tone: data.metrics.slaRiskCount > 0 ? ("critical" as const) : ("neutral" as const)
    },
    {
      id: "aging-status",
      label: "Aging in status",
      value: data.metrics.agingInStatusCount,
      tone: data.metrics.agingInStatusCount > 0 ? ("warning" as const) : ("neutral" as const)
    },
    {
      id: "unassigned",
      label: "Unassigned",
      value: data.metrics.unassignedCount,
      tone: data.metrics.unassignedCount > 0 ? ("critical" as const) : ("neutral" as const)
    },
    {
      id: "missing-due-date",
      label: "Missing due dates",
      value: data.metrics.missingDueDateCount,
      tone: data.metrics.missingDueDateCount > 0 ? ("warning" as const) : ("neutral" as const)
    },
    {
      id: "long-running-in-progress",
      label: "Long-running",
      value: data.metrics.longRunningInProgressCount,
      tone:
        data.metrics.longRunningInProgressCount > 0
          ? ("warning" as const)
          : ("neutral" as const)
    },
    {
      id: "missing-priority",
      label: "Missing priority",
      value: data.metrics.missingPriorityCount,
      tone: data.metrics.missingPriorityCount > 0 ? ("warning" as const) : ("neutral" as const)
    },
    {
      id: "priority-mismatch",
      label: "Neglected high priority",
      value: data.metrics.priorityMismatchCount,
      tone:
        data.metrics.priorityMismatchCount > 0
          ? ("critical" as const)
          : ("neutral" as const)
    }
  ].filter((metric) => metric.id === "total" || data.query.enabledChecks.includes(metric.id as InsightCheckId));

  async function openDrillDown(insightJql: string) {
    if (!insightJql) {
      return;
    }

    const baseUrl = siteUrl || "";
    const searchUrl = `${baseUrl}/issues/?jql=${encodeURIComponent(insightJql)}`;
    await router.open(searchUrl);
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy-block">
          <p className="eyebrow">Queue health</p>
          <div className="hero-title-row">
            <h1>Audit & Risk Insights</h1>
            <HealthBadge health={data.health} />
          </div>
          <p className="hero-copy">
            Prioritized operational risks from your latest Jira issue sample.
          </p>
        </div>
      </section>

      <section className="query-bar">
        <div>
          <span className="query-label">JQL</span>
          <code>{data.query.jql}</code>
        </div>
        <div className="query-side">
          <div className="query-meta">
            {data.query.issueCount} analyzed of {data.query.totalAvailable} matching issues
          </div>
          <div className="refresh-row">
            <span className="refresh-meta">
              {formatLastUpdated(lastUpdated)} · refresh {config.refresh ?? DEFAULT_CONFIG.refresh}m
            </span>
            <button
              type="button"
              className="refresh-button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div className="range-meta">
            Showing priorities {data.query.priorityOffset + 1}-
            {Math.min(data.query.priorityOffset + data.query.displayLimit, orderedInsights.length)} of{" "}
            {orderedInsights.length}
          </div>
        </div>
      </section>

      <section className="metrics-grid">
        {summaryMetrics.map((metric) => (
          <MetricCard key={metric.id} label={metric.label} value={metric.value} tone={metric.tone} />
        ))}
      </section>

      <section className="insights-list">
        {visibleInsights.map((insight) => (
          <button
            key={insight.id}
            type="button"
            className={`insight-card insight-${insight.severity} ${
              insight.count > 0 && insight.drillDownJql ? "insight-clickable" : "insight-static"
            }`}
            onClick={() => void openDrillDown(insight.drillDownJql)}
            disabled={!(insight.count > 0 && insight.drillDownJql)}
          >
            <div className="insight-header">
              <h2>{insight.title}</h2>
              <span className={`badge badge-${insight.severity}`}>{insight.severity}</span>
            </div>
            <p>{insight.message}</p>
            <div className="insight-footer">
              <strong>{insight.count}</strong>
              <span>{insight.percent}% of analyzed issues</span>
            </div>
            <p className="risk-note">
              {ACTION_GUIDANCE[insight.id] ??
                "Review the affected issues now so small delays do not become broader operational risk."}
            </p>
            {insight.count > 0 && insight.drillDownJql ? (
              <span className="card-action">Open matching issues</span>
            ) : null}
          </button>
        ))}
      </section>
    </main>
  );
}
