# Marketplace Readiness Checklist

Working checklist for moving TechCachet Audit & Risk Insights for Jira from a functional Forge MVP to a public Atlassian Marketplace release.

## Current readiness

Current state: private beta / pilot-ready, not yet public Marketplace-ready.

What is already in place:

- Forge app registered and deployable
- Jira dashboard gadget implemented with Custom UI
- Resolver-backed Jira search flow in place
- Configurable built-in checks and one custom check
- Drill-down links into Jira issue search
- Multi-gadget slicing with display limit and starting priority index

What still needs hardening:

- Custom JQL persistence and encoding edge cases
- Broader cross-project QA
- SLA signal completeness for JSM scenarios
- Marketplace trust, docs, assets, and support materials

## 1. Product Readiness

- Define the launch scope for v1 and explicitly list which checks are considered production-supported.
- Decide whether `SLA at risk` stays visible in v1 or is hidden until real SLA field support is implemented.
- Decide whether the custom check stays limited to one per gadget for launch.
- Confirm the primary audience and positioning for the listing:
  Jira admins, service managers, operations leads, compliance-minded teams.
- Finalize the product promise in one short Marketplace sentence and one short in-product sentence.

## 2. Functional Hardening

- Test gadget save/load behavior across multiple edit cycles for:
  base JQL, custom check JQL, thresholds, enabled checks, display settings.
- Test encoded and special-character JQL cases:
  `<`, `>`, `<=`, `>=`, `AND`, quoted values, parentheses, copied HTML-encoded text.
- Test click-through drill-downs for every supported built-in insight.
- Test the custom check end-to-end:
  preview, save, reload, display, and click-through.
- Validate small gadget, medium gadget, and full-width gadget layouts.
- Validate multi-gadget dashboards using different `Visible findings` and `Start from finding #` values.
- Test empty states:
  no matching issues, all checks healthy, no active findings in preview.
- Test error states:
  invalid JQL, insufficient scopes, Jira API failures, malformed custom check input.

## 3. Data and Signal Quality

- Review each built-in check for naming, description clarity, and action guidance quality.
- Confirm the following checks behave correctly across real Jira data:
  `Overdue work`
  `Stale issues`
  `Aging in status`
  `Unassigned issues`
  `Missing due dates`
  `Long-running in progress`
  `Missing priority`
  `High priority neglected`
- Decide whether status-name assumptions such as `"In Progress"` need to become configurable or more tolerant.
- Add test cases or fixtures for signal logic so regressions are easier to catch.
- Revisit whether high-priority detection should be customizable for org-specific priority schemes.

## 4. Jira and Forge QA

- Test in multiple Jira Cloud sites, not just one development tenant.
- Test with different project types:
  company-managed software, team-managed software, service projects if supported.
- Test with different permission levels:
  admin, project lead, regular user with dashboard access.
- Confirm gadget behavior when Jira API returns partial or unexpected field data.
- Verify Forge scopes are minimal and sufficient.
- Review whether any additional scopes are needed before Marketplace submission.
- Confirm the app behaves correctly after redeploys and after gadget reconfiguration.

## 5. UX and Admin Experience

- Tighten labels and help text in the config panel based on pilot feedback.
- Decide whether to add inline validation for custom JQL before save.
- Improve preview messaging where needed:
  active checks vs. enabled checks, no-result states, custom check clarity.
- Review whether the metric strip should collapse further on narrow gadgets.
- Decide whether to add a visible `View issues` affordance on clickable cards.
- Review the copy for consistency:
  `stale`, `aging`, `neglected`, `at risk`, `queue health`.

## 6. Reliability and Supportability

- Add structured logging around resolver failures and invalid JQL cases.
- Decide what support diagnostics should be visible to admins versus hidden in logs.
- Document common failure modes and recovery steps:
  invalid JQL, saved config issues, permission problems, missing expected fields.
- Confirm that app upgrades do not break previously saved gadget configurations.
- Decide whether telemetry or internal usage analytics are needed before launch.

## 7. Security, Privacy, and Compliance

- Create a privacy policy appropriate for Marketplace distribution.
- Create support/contact documentation.
- Create security/contact documentation if required by Marketplace listing.
- Review whether any customer data is stored, cached, logged, or exported.
- Document exactly which Jira issue fields are read by the app.
- Confirm the app does not request unnecessary scopes or external network access.

## 8. Marketplace Listing Assets

- Finalize the app name for public listing.
- Write listing copy:
  short description, long description, key benefits, target audience.
- Create listing screenshots using realistic dashboard examples.
- Create app icon and any required brand assets.
- Prepare onboarding copy for first-time users:
  how to add the gadget, configure checks, and use multiple gadgets.
- Prepare release notes for the first public version.

## 9. Release Gates

Before public submission, all of the following should be true:

- No known blocker bugs in gadget save/load behavior
- No known blocker bugs in drill-down navigation
- Custom check works reliably after save and reload
- Listing copy and assets are complete
- Privacy and support documentation are published
- At least one full QA pass has been completed on more than one Jira site
- A decision has been made on incomplete or partially-supported signals

## 10. Suggested Next Sequence

Recommended next work order:

1. Stabilize config persistence and custom JQL edge cases.
2. Add targeted test coverage for signal logic and config serialization.
3. Run structured multi-site QA and document findings.
4. Decide final v1 signal set and hide anything not truly production-ready.
5. Produce Marketplace docs, screenshots, icon, and listing copy.
6. Do one final release-candidate pass before submission.
