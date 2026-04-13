# Seed Test Data

Use the repo-owned seeding script to create a repeatable Jira dataset for testing TechCachet Audit & Risk Insights.

## Script

Run:

```powershell
npm.cmd run seed:jira
```

The script lives at [`scripts/seed-jira-data.mjs`](../scripts/seed-jira-data.mjs).

## Required environment variables

Set these before running:

```powershell
$env:JIRA_BASE_URL="https://techcachet.atlassian.net"
$env:JIRA_EMAIL="you@example.com"
$env:JIRA_API_TOKEN="your-api-token"
$env:JIRA_PROJECT_KEY="YOURPROJECT"
```

Optional:

```powershell
$env:JIRA_ASSIGNEE_ACCOUNT_ID="atlassian-account-id"
```

Optional rerun control:

```powershell
$env:JIRA_SKIP_EXISTING="false"
```

If `JIRA_ASSIGNEE_ACCOUNT_ID` is omitted, the script still creates useful unassigned and missing-field cases.
If `JIRA_SKIP_EXISTING` is omitted, the script skips creating issues whose seeded summaries already exist in the target project.

## Rerun behavior

By default, the script:

- fetches the site's actual Jira priorities and uses their real IDs
- looks for existing issues labeled `techcachet-seed` in the target project
- skips any seed issue whose summary already exists

That makes it safe to rerun on the same dev project without duplicating the standard dataset.

If you intentionally want duplicate seed issues, set:

```powershell
$env:JIRA_SKIP_EXISTING="false"
```

## What it creates well

- overdue issues
- missing due dates
- unassigned issues
- missing priority issues
- healthy comparison issues
- backlog/custom-check candidates

## Current limitations

The Jira REST API can create issues with due dates, priorities, and assignees, but it does not naturally let us create believable historical `updated` timestamps through normal create calls.

That means the script is not enough by itself for:

- stale issues based on `updated <= -Xd`
- long-running in-progress issues based on old status-entry timing
- high-priority neglected issues based on old `updated` dates

For those, use one of these approaches:

- let seeded issues age naturally on the dev site
- manually transition a few issues into the target statuses and revisit later
- use a separate CSV/import-style strategy if you need historical timestamps immediately

## Suggested workflow

1. Create or choose a Jira project on `techcachet.atlassian.net`.
2. Set the environment variables.
3. Run `npm.cmd run seed:jira`.
4. Configure the gadget against that project with a simple JQL such as:

```jql
project = YOURPROJECT ORDER BY updated DESC
```

5. Validate the immediately-testable checks first:
   `Overdue`, `Unassigned`, `Missing due dates`, `Missing priority`, and custom JQL checks.
