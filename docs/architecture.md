# Architecture

## v1 shape

- Jira dashboard gadget UI
- Forge Custom UI frontend
- Forge resolver backend
- Jira REST Search API for issue retrieval
- Pure analysis layer for insight generation

## Request flow

1. User opens the dashboard gadget
2. Gadget passes configuration such as JQL and thresholds
3. Resolver fetches matching issues from Jira
4. Analysis engine computes metrics and prioritized insights
5. UI renders health summary, insight feed, and drill-down links

## Design principles

- Keep the analysis engine pure and testable
- Keep Forge-specific code thin
- Return normalized data to the frontend
- Cap issue volume for predictable performance

## Initial modules

- `src/types/insights.ts`: shared types
- `src/lib/analyzeIssues.ts`: core insight detection and summary logic
- `src/lib/dateUtils.ts`: date helpers used by the engine
- `src/resolvers/getAuditInsights.ts`: backend entry point

