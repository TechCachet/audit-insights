const requiredEnvVars = [
  "JIRA_BASE_URL",
  "JIRA_EMAIL",
  "JIRA_API_TOKEN",
  "JIRA_PROJECT_KEY"
];

const SEEDED_LABEL = "techcachet-seed";
const INSIGHTS_LABEL = "audit-insights";

function getEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function daysFromNow(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildDescription(lines) {
  return {
    type: "doc",
    version: 1,
    content: lines.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }]
    }))
  };
}

async function jiraRequest(baseUrl, authHeader, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Jira request failed (${response.status}) for ${path}: ${message}`);
  }

  return response.json();
}

function createIssue(summary, options = {}) {
  const {
    issueType = "Task",
    priority,
    statusHint,
    dueDate,
    assigneeAccountId,
    labels = [],
    scenario
  } = options;

  const fields = {
    project: { key: getEnv("JIRA_PROJECT_KEY") },
    summary,
    issuetype: { name: issueType },
    labels,
    description: buildDescription([
      "Seeded by TechCachet Audit & Risk Insights test-data script.",
      `Scenario: ${scenario ?? "general"}${statusHint ? ` | Intended status: ${statusHint}` : ""}`
    ])
  };

  if (priority) {
    fields.priority = priority;
  }

  if (dueDate) {
    fields.duedate = dueDate;
  }

  if (assigneeAccountId) {
    fields.assignee = { accountId: assigneeAccountId };
  }

  return { fields };
}

function buildSeedIssues(priorityIds) {
  const assigneeAccountId = process.env.JIRA_ASSIGNEE_ACCOUNT_ID?.trim();
  const sharedLabels = [SEEDED_LABEL, INSIGHTS_LABEL];
  const priorityId = (name) => {
    const id = priorityIds.get(name.toLowerCase());

    if (!id) {
      throw new Error(
        `Could not find Jira priority "${name}" on this site. Available priorities: ${[
          ...priorityIds.keys()
        ].join(", ")}`
      );
    }

    return id;
  };

  return [
    createIssue("Seed overdue issue A", {
      scenario: "overdue",
      dueDate: daysFromNow(-14),
      priority: priorityId("High"),
      assigneeAccountId,
      labels: [...sharedLabels, "overdue"]
    }),
    createIssue("Seed overdue issue B", {
      scenario: "overdue",
      dueDate: daysFromNow(-5),
      priority: priorityId("Highest"),
      assigneeAccountId,
      labels: [...sharedLabels, "overdue"]
    }),
    createIssue("Seed missing due date A", {
      scenario: "missing-due-date",
      priority: priorityId("Medium"),
      assigneeAccountId,
      labels: [...sharedLabels, "missing-due-date"]
    }),
    createIssue("Seed missing due date B", {
      scenario: "missing-due-date",
      priority: priorityId("Low"),
      labels: [...sharedLabels, "missing-due-date"]
    }),
    createIssue("Seed unassigned issue A", {
      scenario: "unassigned",
      priority: priorityId("High"),
      dueDate: daysFromNow(3),
      labels: [...sharedLabels, "unassigned"]
    }),
    createIssue("Seed unassigned issue B", {
      scenario: "unassigned",
      priority: priorityId("Medium"),
      dueDate: daysFromNow(10),
      labels: [...sharedLabels, "unassigned"]
    }),
    createIssue("Seed missing priority A", {
      scenario: "missing-priority",
      dueDate: daysFromNow(7),
      assigneeAccountId,
      labels: [...sharedLabels, "missing-priority"]
    }),
    createIssue("Seed missing priority B", {
      scenario: "missing-priority",
      dueDate: daysFromNow(-2),
      labels: [...sharedLabels, "missing-priority"]
    }),
    createIssue("Seed backlog custom-check candidate A", {
      scenario: "custom-backlog",
      statusHint: "Backlog",
      priority: priorityId("Medium"),
      labels: [...sharedLabels, "backlog", "custom-check"]
    }),
    createIssue("Seed backlog custom-check candidate B", {
      scenario: "custom-backlog",
      statusHint: "Backlog",
      priority: priorityId("Low"),
      labels: [...sharedLabels, "backlog", "custom-check"]
    }),
    createIssue("Seed healthy issue A", {
      scenario: "healthy",
      priority: priorityId("Medium"),
      dueDate: daysFromNow(14),
      assigneeAccountId,
      labels: [...sharedLabels, "healthy"]
    }),
    createIssue("Seed healthy issue B", {
      scenario: "healthy",
      priority: priorityId("Low"),
      dueDate: daysFromNow(21),
      assigneeAccountId,
      labels: [...sharedLabels, "healthy"]
    })
  ];
}

async function fetchPriorities(baseUrl, authHeader) {
  const result = await jiraRequest(baseUrl, authHeader, "/rest/api/3/priority/search?maxResults=100");
  const values = Array.isArray(result?.values) ? result.values : [];
  const priorityIds = new Map();

  for (const priority of values) {
    if (priority?.name && priority?.id) {
      priorityIds.set(priority.name.toLowerCase(), String(priority.id));
    }
  }

  if (!priorityIds.size) {
    throw new Error("No Jira priorities were returned for this site.");
  }

  return priorityIds;
}

async function fetchExistingSeedSummaries(baseUrl, authHeader) {
  const projectKey = getEnv("JIRA_PROJECT_KEY");
  const searchResult = await jiraRequest(baseUrl, authHeader, "/rest/api/3/search", {
    method: "POST",
    body: JSON.stringify({
      jql: `project = "${projectKey}" AND labels = "${SEEDED_LABEL}" ORDER BY created DESC`,
      fields: ["summary"],
      maxResults: 100
    })
  });

  return new Set((searchResult.issues ?? []).map((issue) => issue.fields?.summary).filter(Boolean));
}

async function createIssues(baseUrl, authHeader, issueUpdates) {
  return jiraRequest(baseUrl, authHeader, "/rest/api/3/issue/bulk", {
    method: "POST",
    body: JSON.stringify({ issueUpdates })
  });
}

async function main() {
  for (const name of requiredEnvVars) {
    getEnv(name);
  }

  const baseUrl = getEnv("JIRA_BASE_URL").replace(/\/$/, "");
  const email = getEnv("JIRA_EMAIL");
  const apiToken = getEnv("JIRA_API_TOKEN");
  const authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
  const skipExisting = process.env.JIRA_SKIP_EXISTING?.trim().toLowerCase() !== "false";
  const priorityIds = await fetchPriorities(baseUrl, authHeader);
  const allIssueUpdates = buildSeedIssues(priorityIds);
  const existingSummaries = skipExisting ? await fetchExistingSeedSummaries(baseUrl, authHeader) : new Set();
  const issueUpdates = allIssueUpdates.filter(
    (issueUpdate) => !existingSummaries.has(issueUpdate.fields.summary)
  );

  if (!issueUpdates.length) {
    console.log(
      `No new seeded issues to create in ${getEnv("JIRA_PROJECT_KEY")} (all summaries already exist).`
    );
    console.log("Set JIRA_SKIP_EXISTING=false if you want to force duplicate seed data.");
    return;
  }

  const result = await createIssues(baseUrl, authHeader, issueUpdates);

  console.log(`Created ${result.issues?.length ?? 0} issues in ${getEnv("JIRA_PROJECT_KEY")}.`);

  for (const issue of result.issues ?? []) {
    console.log(`- ${issue.key}`);
  }

  if (result.errors?.length) {
    console.log("Some issues failed to create:");
    for (const error of result.errors) {
      console.log(JSON.stringify(error));
    }
  }

  console.log("");
  console.log("Notes:");
  console.log(`- Existing seeded summaries are ${skipExisting ? "skipped" : "not skipped"} on reruns.`);
  console.log("- This script is best for due dates, assignment, priority, and custom-check coverage.");
  console.log("- Fresh API-created issues cannot realistically simulate old 'updated' timestamps.");
  console.log("- Signals like stale, long-running, and neglected high-priority need either time to pass,");
  console.log("  manual workflow manipulation over time, or a different import strategy such as CSV.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
