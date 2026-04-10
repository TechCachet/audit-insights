import { useEffect, useState } from "react";
import { invoke, view } from "@forge/bridge";

type GadgetConfig = {
  jql: string;
  limit: number;
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
  refresh?: number;
};

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

type PreviewData = {
  health: "healthy" | "watchlist" | "at-risk";
  insights: Array<{
    id: InsightCheckId;
    title: string;
    count: number;
    severity: "critical" | "warning" | "healthy";
  }>;
};

const CHECK_OPTIONS: Array<{
  id: InsightCheckId;
  label: string;
  description: string;
}> = [
  {
    id: "overdue",
    label: "Overdue work",
    description: "Flag work past its due date."
  },
  {
    id: "stale",
    label: "Stale issues",
    description: "Flag unfinished work with no recent updates."
  },
  {
    id: "sla-risk",
    label: "SLA at risk",
    description: "Flag issues nearing an SLA breach when SLA data is available."
  },
  {
    id: "aging-status",
    label: "Aging in status",
    description: "Flag work sitting too long in the current status."
  },
  {
    id: "unassigned",
    label: "Unassigned issues",
    description: "Flag queue items that still have no owner."
  },
  {
    id: "missing-due-date",
    label: "Missing due dates",
    description: "Flag unfinished issues with no due date set."
  },
  {
    id: "long-running-in-progress",
    label: "Long-running in progress",
    description: "Flag issues stuck in In Progress beyond a threshold."
  },
  {
    id: "missing-priority",
    label: "Missing priority",
    description: "Flag unfinished issues missing a priority value."
  },
  {
    id: "priority-mismatch",
    label: "High priority neglected",
    description: "Flag high-priority issues that have not been touched recently."
  }
];

const DEFAULT_CONFIG: GadgetConfig = {
  jql: "project is not EMPTY ORDER BY updated DESC",
  limit: 50,
  displayLimit: 4,
  priorityOffset: 0,
  enabledChecks: ["overdue", "stale", "sla-risk", "aging-status"],
  thresholds: {
    staleAfterDays: 5,
    agingInStatusDays: 7,
    slaRiskMinutes: 240,
    longRunningInProgressDays: 10,
    highPriorityStaleDays: 2
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
    },
    enabledChecks: config?.enabledChecks?.length
      ? config.enabledChecks
      : DEFAULT_CONFIG.enabledChecks
  };
}

export function App() {
  const [formState, setFormState] = useState<GadgetConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const context = (await view.getContext()) as {
          extension?: { gadgetConfiguration?: Partial<GadgetConfig> };
        };

        if (!cancelled) {
          setFormState(mergeConfig(context.extension?.gadgetConfiguration));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load gadget configuration.");
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

  function updateField<Key extends keyof GadgetConfig>(key: Key, value: GadgetConfig[Key]) {
    setFormState((current) => ({ ...current, [key]: value }));
  }

  function updateThreshold(key: keyof GadgetConfig["thresholds"], value: number) {
    setFormState((current) => ({
      ...current,
      thresholds: {
        ...current.thresholds,
        [key]: value
      }
    }));
  }

  function toggleCheck(checkId: InsightCheckId) {
    setFormState((current) => {
      const enabledChecks = current.enabledChecks ?? [];
      const nextChecks = enabledChecks.includes(checkId)
        ? enabledChecks.filter((id) => id !== checkId)
        : [...enabledChecks, checkId];

      return {
        ...current,
        enabledChecks: nextChecks.length ? nextChecks : ["overdue"]
      };
    });
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

  async function handlePreview() {
    setPreviewing(true);
    setError(null);

    try {
      const result = await invoke<PreviewData>("getDashboardAuditInsights", formState);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to preview gadget configuration.");
    } finally {
      setPreviewing(false);
    }
  }

  if (loading) {
    return <div className="state-panel">Loading gadget configuration...</div>;
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

        <section className="config-section">
          <div className="section-header">
            <span>Display</span>
            <p>Control how many prioritized cards this gadget instance shows.</p>
          </div>
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
              <span>Visible findings</span>
              <input
                type="number"
                min={1}
                max={12}
                value={formState.displayLimit ?? 4}
                onChange={(event) => updateField("displayLimit", Number(event.target.value))}
              />
            </label>

            <label>
              <span>Start from finding #</span>
              <input
                type="number"
                min={1}
                value={(formState.priorityOffset ?? 0) + 1}
                onChange={(event) =>
                  updateField("priorityOffset", Math.max(0, Number(event.target.value) - 1))
                }
              />
              <small>Use with multiple gadgets to split findings across dashboard tiles.</small>
            </label>
          </div>
        </section>

        <section className="config-section">
          <div className="section-header">
            <span>Thresholds</span>
            <p>Tune how quickly the gadget considers work risky or neglected.</p>
          </div>
          <div className="form-grid">
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

            <label>
              <span>Long-running in progress days</span>
              <input
                type="number"
                min={1}
                value={formState.thresholds.longRunningInProgressDays}
                onChange={(event) =>
                  updateThreshold("longRunningInProgressDays", Number(event.target.value))
                }
              />
            </label>

            <label>
              <span>High priority stale days</span>
              <input
                type="number"
                min={1}
                value={formState.thresholds.highPriorityStaleDays}
                onChange={(event) =>
                  updateThreshold("highPriorityStaleDays", Number(event.target.value))
                }
              />
            </label>
          </div>
        </section>

        <section className="checks-panel">
          <div className="checks-header">
            <span>Enabled checks</span>
            <p>
              Add this gadget more than once on a dashboard with different checks, JQL, or
              skip/display settings to split the priority list across tiles.
            </p>
          </div>
          <div className="checks-grid">
            {CHECK_OPTIONS.map((check) => {
              const checked = (formState.enabledChecks ?? []).includes(check.id);

              return (
                <label key={check.id} className={`check-card ${checked ? "check-card-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCheck(check.id)}
                  />
                  <span>{check.label}</span>
                  <small>{check.description}</small>
                </label>
              );
            })}
          </div>
        </section>

        <section className="preview-panel">
          <div className="section-header">
            <span>Preview</span>
            <p>Run the current settings against live Jira data before saving.</p>
          </div>
          <div className="preview-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handlePreview()}
              disabled={previewing}
            >
              {previewing ? "Previewing..." : "Preview findings"}
            </button>
            {preview ? <span className="preview-health">Queue health: {preview.health}</span> : null}
          </div>
          {preview ? (
            <div className="preview-list">
              {preview.insights
                .filter((insight) => insight.count > 0)
                .slice(formState.priorityOffset ?? 0, (formState.priorityOffset ?? 0) + (formState.displayLimit ?? 4))
                .map((insight) => (
                  <div key={insight.id} className={`preview-card preview-${insight.severity}`}>
                    <strong>{insight.title}</strong>
                    <span>{insight.count} matching issues</span>
                  </div>
                ))}
              {preview.insights.filter((insight) => insight.count > 0).length === 0 ? (
                <div className="preview-empty">No active findings for this configuration.</div>
              ) : null}
            </div>
          ) : null}
        </section>

        {error ? <div className="state-panel error-panel">{error}</div> : null}

        <div className="action-row">
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving..." : "Save gadget"}
          </button>
        </div>
      </form>
    </main>
  );
}
