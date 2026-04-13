import { useEffect, useState } from "react";
import { invoke, view } from "@forge/bridge";

type ConfigurableInsightSeverity = "critical" | "warning";

type GadgetConfig = {
  jql: string;
  limit: number;
  displayLimit?: number;
  priorityOffset?: number;
  enabledChecks?: InsightCheckId[];
  customCheck?: {
    enabled: boolean;
    title: string;
    jqlCondition: string;
    severity: ConfigurableInsightSeverity;
    actionText: string;
  };
  thresholds: {
    staleAfterDays: number;
    agingInStatusDays: number;
    slaRiskMinutes: number;
    longRunningInProgressDays: number;
    highPriorityStaleDays: number;
  };
  refresh?: number;
};

type CustomCheckConfig = NonNullable<GadgetConfig["customCheck"]>;
const DEFAULT_CUSTOM_CHECK: CustomCheckConfig = {
  enabled: false,
  title: "Custom check",
  jqlCondition: "",
  severity: "critical",
  actionText: "Review the matching issues for this custom risk condition."
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
  | "priority-mismatch"
  | "custom";

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
  customCheck: DEFAULT_CUSTOM_CHECK,
  thresholds: {
    staleAfterDays: 5,
    agingInStatusDays: 7,
    slaRiskMinutes: 240,
    longRunningInProgressDays: 10,
    highPriorityStaleDays: 2
  },
  refresh: 15
};

function normalizeJqlText(value: string): string {
  let normalized = value;

  for (let i = 0; i < 3; i += 1) {
    const nextValue = normalized
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;/gi, "'");

    if (nextValue === normalized) {
      break;
    }

    normalized = nextValue;
  }

  return normalized;
}

function mergeConfig(config?: Partial<GadgetConfig>): GadgetConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    jql: normalizeJqlText(config?.jql ?? DEFAULT_CONFIG.jql),
    thresholds: {
      ...DEFAULT_CONFIG.thresholds,
      ...config?.thresholds
    },
    customCheck: {
      ...DEFAULT_CUSTOM_CHECK,
      ...config?.customCheck,
      jqlCondition: normalizeJqlText(
        config?.customCheck?.jqlCondition ?? DEFAULT_CUSTOM_CHECK.jqlCondition
      )
    } as CustomCheckConfig,
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
    setFormState((current) => ({
      ...current,
      [key]:
        key === "jql" && typeof value === "string"
          ? (normalizeJqlText(value) as GadgetConfig[Key])
          : value
    }));
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

  function updateCustomCheck<Key extends keyof CustomCheckConfig>(
    key: Key,
    value: CustomCheckConfig[Key]
  ) {
    setFormState((current) => ({
      ...current,
      customCheck: {
        ...DEFAULT_CUSTOM_CHECK,
        ...current.customCheck,
        [key]:
          key === "jqlCondition" && typeof value === "string"
            ? normalizeJqlText(value)
            : value
      } as CustomCheckConfig
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const configToSave = {
      title: formState.title,
      jql: formState.jql,
      limit: formState.limit,
      displayLimit: formState.displayLimit,
      priorityOffset: formState.priorityOffset,
      enabledChecks: formState.enabledChecks,
      customCheck: formState.customCheck,
      thresholds: formState.thresholds,
      refresh: formState.refresh
    };

    try {
      await view.submit(configToSave);
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

  const previewInsights = preview
    ? preview.insights.slice(
        formState.priorityOffset ?? 0,
        (formState.priorityOffset ?? 0) + (formState.displayLimit ?? 4)
      )
    : [];
  const activePreviewCount = preview
    ? preview.insights.filter((insight) => insight.count > 0).length
    : 0;
  const enabledPreviewCount = formState.enabledChecks?.length ?? 0;

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
          <span>Dashboard Title</span>
          <input
            type="text"
            placeholder="e.g. Audit & Risk Insights"
            value={formState.title ?? ""}
            onChange={(event) => updateField("title", event.target.value)}
          />
          <small>Display name shown under 'Queue Health' on your dashboard.</small>
        </label>
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

        <section className="config-section">
          <div className="section-header">
            <span>Custom check</span>
            <p>
              Add one org-specific JQL condition to monitor a risk pattern that is not built in.
            </p>
          </div>
          <label className={`check-card ${formState.customCheck?.enabled ? "check-card-on" : ""}`}>
            <input
              type="checkbox"
              checked={Boolean(formState.customCheck?.enabled)}
              onChange={(event) => updateCustomCheck("enabled", event.target.checked)}
            />
            <span>Enable custom check</span>
            <small>Use your base JQL plus one extra condition to create a custom insight card.</small>
          </label>

          {formState.customCheck?.enabled ? (
            <div className="form-grid">
              <label>
                <span>Custom card title</span>
                <input
                  type="text"
                  value={formState.customCheck.title}
                  onChange={(event) => updateCustomCheck("title", event.target.value)}
                />
              </label>

              <label>
                <span>Severity</span>
                <select
                  value={formState.customCheck.severity}
                  onChange={(event) =>
                    updateCustomCheck("severity", event.target.value as ConfigurableInsightSeverity)
                  }
                >
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                </select>
              </label>

              <label className="full-width">
                <span>Additional JQL condition</span>
                <textarea
                  rows={3}
                  value={formState.customCheck.jqlCondition}
                  onChange={(event) => updateCustomCheck("jqlCondition", event.target.value)}
                />
                <small>
                  This gets appended to the base JQL as an additional filter condition.
                </small>
              </label>

              <label className="full-width">
                <span>Action guidance</span>
                <textarea
                  rows={2}
                  value={formState.customCheck.actionText}
                  onChange={(event) => updateCustomCheck("actionText", event.target.value)}
                />
              </label>
            </div>
          ) : null}
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
            {preview ? (
              <span className="preview-summary">
                {activePreviewCount} of {enabledPreviewCount} enabled checks currently active
              </span>
            ) : null}
          </div>
          {preview ? (
            <div className="preview-list">
              {previewInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={`preview-card preview-${insight.severity} ${
                    insight.count === 0 ? "preview-muted" : ""
                  }`}
                >
                  <div className="preview-card-copy">
                    <strong>{insight.title}</strong>
                    <span>
                      {insight.count > 0 ? `${insight.count} matching issues` : "0 matching issues"}
                    </span>
                  </div>
                </div>
              ))}
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
