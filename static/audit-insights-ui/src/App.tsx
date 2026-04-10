import { useEffect, useState } from "react";
import { invoke, view } from "@forge/bridge";

type GadgetContext = {
  extension: {
    entryPoint?: "edit" | "view";
    gadgetConfiguration?: GadgetConfig;
  };
};

type GadgetConfig = {
  jql: string;
  limit: number;
  thresholds: {
    staleAfterDays: number;
    agingInStatusDays: number;
    slaRiskMinutes: number;
  };
  refresh?: number;
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
  };
  insights: Array<{
    id: string;
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
  };
};

const DEFAULT_CONFIG: GadgetConfig = {
  jql: "project is not EMPTY ORDER BY updated DESC",
  limit: 50,
  thresholds: {
    staleAfterDays: 5,
    agingInStatusDays: 7,
    slaRiskMinutes: 240
  },
  refresh: 15
};

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
  return <span className={`badge badge-${health}`}>{health.replace("-", " ")}</span>;
}

function MetricCard(props: { label: string; value: number }) {
  return (
    <section className="metric-card">
      <div className="metric-label">{props.label}</div>
      <div className="metric-value">{props.value}</div>
    </section>
  );
}

function InsightsView({ config }: { config: GadgetConfig }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke<DashboardData>("getDashboardAuditInsights", config);

        if (!cancelled) {
          setData(result);
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

    void load();

    return () => {
      cancelled = true;
    };
  }, [config]);

  if (loading) {
    return <div className="state-panel">Loading audit insights…</div>;
  }

  if (error) {
    return <div className="state-panel error-panel">{error}</div>;
  }

  if (!data) {
    return <div className="state-panel">No insight data returned.</div>;
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Queue health</p>
          <h1>Audit & Risk Insights</h1>
          <p className="hero-copy">
            Prioritized operational risks from your latest Jira issue sample.
          </p>
        </div>
        <HealthBadge health={data.health} />
      </section>

      <section className="query-bar">
        <div>
          <span className="query-label">JQL</span>
          <code>{data.query.jql}</code>
        </div>
        <div className="query-meta">
          {data.query.issueCount} analyzed of {data.query.totalAvailable} matching issues
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="Total issues" value={data.metrics.totalIssues} />
        <MetricCard label="Overdue" value={data.metrics.overdueCount} />
        <MetricCard label="Stale" value={data.metrics.staleCount} />
        <MetricCard label="SLA at risk" value={data.metrics.slaRiskCount} />
        <MetricCard label="Aging in status" value={data.metrics.agingInStatusCount} />
      </section>

      <section className="insights-list">
        {data.insights.map((insight) => (
          <article key={insight.id} className={`insight-card insight-${insight.severity}`}>
            <div className="insight-header">
              <h2>{insight.title}</h2>
              <span className={`badge badge-${insight.severity}`}>{insight.severity}</span>
            </div>
            <p>{insight.message}</p>
            <div className="insight-footer">
              <strong>{insight.count}</strong>
              <span>{insight.percent}% of analyzed issues</span>
            </div>
            {insight.drillDownJql ? (
              <code className="drilldown">{insight.drillDownJql}</code>
            ) : (
              <span className="drilldown muted">Drill-down JQL will be refined for this signal.</span>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}

function EditView({ config }: { config: GadgetConfig }) {
  const [formState, setFormState] = useState<GadgetConfig>(config);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<Key extends keyof GadgetConfig>(key: Key, value: GadgetConfig[Key]) {
    setFormState((current) => ({ ...current, [key]: value }));
  }

  function updateThreshold(
    key: keyof GadgetConfig["thresholds"],
    value: number
  ) {
    setFormState((current) => ({
      ...current,
      thresholds: {
        ...current.thresholds,
        [key]: value
      }
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await view.submit(formState);
      await view.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save gadget configuration.");
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Configure gadget</p>
          <h1>Audit & Risk Insights</h1>
          <p className="hero-copy">
            Choose the issue slice and thresholds that should drive the dashboard signal.
          </p>
        </div>
      </section>

      <form className="config-form" onSubmit={handleSubmit}>
        <label>
          <span>JQL query</span>
          <textarea
            rows={4}
            value={formState.jql}
            onChange={(event) => updateField("jql", event.target.value)}
          />
        </label>

        <div className="form-grid">
          <label>
            <span>Issue sample size</span>
            <input
              type="number"
              min={1}
              max={100}
              value={formState.limit}
              onChange={(event) => updateField("limit", Number(event.target.value))}
            />
          </label>

          <label>
            <span>Refresh interval (minutes)</span>
            <input
              type="number"
              min={1}
              value={formState.refresh ?? 15}
              onChange={(event) => updateField("refresh", Number(event.target.value))}
            />
          </label>

          <label>
            <span>Stale after days</span>
            <input
              type="number"
              min={1}
              value={formState.thresholds.staleAfterDays}
              onChange={(event) => updateThreshold("staleAfterDays", Number(event.target.value))}
            />
          </label>

          <label>
            <span>Aging in status days</span>
            <input
              type="number"
              min={1}
              value={formState.thresholds.agingInStatusDays}
              onChange={(event) => updateThreshold("agingInStatusDays", Number(event.target.value))}
            />
          </label>

          <label>
            <span>SLA risk minutes</span>
            <input
              type="number"
              min={1}
              value={formState.thresholds.slaRiskMinutes}
              onChange={(event) => updateThreshold("slaRiskMinutes", Number(event.target.value))}
            />
          </label>
        </div>

        {error ? <div className="state-panel error-panel">{error}</div> : null}

        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? "Saving…" : "Save gadget"}
        </button>
      </form>
    </main>
  );
}

export function App() {
  const [context, setContext] = useState<GadgetContext | null>(null);

  useEffect(() => {
    view.getContext().then((value) => setContext(value as GadgetContext));
  }, []);

  if (!context) {
    return <div className="state-panel">Loading gadget context…</div>;
  }

  const config = mergeConfig(context.extension.gadgetConfiguration);

  return context.extension.entryPoint === "edit" ? (
    <EditView config={config} />
  ) : (
    <InsightsView config={config} />
  );
}
