# TechCachet Audit & Risk Insights for Jira

Insight-first Jira dashboard app for surfacing queue risk, SLA exposure, and workflow bottlenecks without manual analysis.

## Product direction

- Primary audience: Jira admins, service managers, and operations teams
- Core value: turn issue data into prioritized actions instead of charts
- Platform: Atlassian Forge for Jira Cloud

## Current project status

This repository now contains the initial Forge MVP structure in addition to the product docs and insight engine.

- Product and architecture docs are in [`docs/`](./docs)
- Marketplace readiness checklist is in [`docs/marketplace-readiness-checklist.md`](./docs/marketplace-readiness-checklist.md)
- Test-data seeding guide is in [`docs/seed-test-data.md`](./docs/seed-test-data.md)
- Forge backend code is in [`src/`](./src)
- Custom UI gadget frontends are in [`static/audit-insights-view/`](./static/audit-insights-view) and [`static/audit-insights-edit/`](./static/audit-insights-edit)
- Forge manifest is in [`manifest.yml`](./manifest.yml)
- Forge app is registered and deployable to the configured Forge environments

## Recommended repo setup

- Create a dedicated GitHub repository for this app
- Keep Marketplace assets and app code in the same repo at first
- Start with a single deployable app, not a monorepo

Suggested repo names:

- `techcachet-audit-insights`
- `jira-audit-risk-insights`
- `audit-insights-for-jira`

## MVP structure

- `manifest.yml`: Jira dashboard gadget module, resolver function, Custom UI resource
- `src/index.ts`: Forge resolver entrypoint
- `src/resolvers/getDashboardAuditInsights.ts`: Jira search integration plus insight engine wiring
- `src/lib/analyzeIssues.ts`: pure audit insight logic
- `static/audit-insights-ui/`: React + Vite gadget UI for both view and edit states

## Useful commands

- `npm.cmd install`
- `npm.cmd run typecheck`
- `npm.cmd run build:ui`
- `powershell -Command "& \"$env:APPDATA\\npm\\forge.cmd\" lint"`

## Next steps

1. Refresh Forge login with a valid Atlassian API token
2. Run `forge register` to generate and write the app `id`
3. Run `forge lint`
4. Deploy and install the app into a Jira Cloud site for gadget testing
