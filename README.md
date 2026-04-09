# TechCachet Audit & Risk Insights for Jira

Insight-first Jira dashboard app for surfacing queue risk, SLA exposure, and workflow bottlenecks without manual analysis.

## Product direction

- Primary audience: Jira admins, service managers, and operations teams
- Core value: turn issue data into prioritized actions instead of charts
- Platform: Atlassian Forge for Jira Cloud

## Current project status

This repository is the initial design and application skeleton.

- Product and architecture docs are in [`docs/`](./docs)
- Core insight engine code is in [`src/`](./src)
- Forge CLI scaffolding has not been run yet

## Recommended repo setup

- Create a dedicated GitHub repository for this app
- Keep Marketplace assets and app code in the same repo at first
- Start with a single deployable app, not a monorepo

Suggested repo names:

- `techcachet-audit-insights`
- `jira-audit-risk-insights`
- `audit-insights-for-jira`

## Next steps

1. Create the GitHub repository and push this local repo
2. Install the Forge CLI
3. Run the Forge app scaffold in this folder
4. Wire the existing `src` logic into Forge resolvers and Custom UI

