# Atlassian Marketplace: Security & Compliance Answers
## Product: Audit & Risk Insights

### Authentication & Authorization

**1. Does your Forge app functionality include user interactions?**
Yes.

**1.a. Where applicable, does your app use `asUser()` method for actions performed by the user?**
Yes. The app uses `api.asUser().requestJira()` to ensure all data fetching respects the current user's Jira permissions.

**2. Does your app use Forge remote?**
No.

**3. Before invoking calls using `asApp()` on actions that require user-specific permissions, do you ensure that the user has the necessary permissions by calling the permissions REST APIs?**
Not Applicable. The app uses `asUser()` for Jira interactions and does not utilize `asApp()` for permission-sensitive actions.

**4. Does your Forge app use web triggers?**
No.

**5. Does your app use display conditions?**
No.

### Data Security

**6. Does your Forge app egress data to external hosts?**
No.

**7. Does your Forge app adhere to the principle of least privilege by ensuring that the app's scope is limited to only the permissions necessary for its functionality?**
Yes. The app only requests the `read:jira-work` scope.

**8. Does your app log sensitive information (such as PII, credentials, access tokens, or API keys) in Forge logs?**
No.

### Application Security

**9. Have you implemented controls in the app to validate and sanitize all user inputs in order to mitigate vulnerabilities related to injection attacks?**
Yes.

**9.a. Please explain the input validations implemented on user inputs / URLs if applicable**
The application implements a multi-layer validation strategy: it uses a `normalizeJqlText` function to sanitize JQL input by resolving HTML-encoded entities, employs strict normalization functions to clamp all numeric configurations to safe predefined ranges (preventing resource exhaustion), and utilizes the Forge `route` tagged template literal for all Jira API requests to provide built-in protection against URI injection.

**10. Did you review the app’s 3rd party dependencies for vulnerabilities using automated tools? and, do you plan to keep these dependencies up to date?**
Yes.

### Secrets Management

**11. Does your app collect Atlassian account credentials, such as passwords or API tokens?**
No.

**12. Does your app collect any 3rd party service's credentials or tokens?**
No.

**13. Does your Forge app expose any secrets in plain text in easily accessible locations like URLs, source code, or code repositories?**
No.

### Vulnerability Management

**14. Do you perform vulnerability scans and review results?**
Yes.

**14.a. Please select the type of scans performed**
* SAST - Static Analysis (Code) Scans
* SCA - Dependency / Open-Source (Library) Scans

**15. Have you read our Marketplace security bug fix policy?**
Yes.

**16. Do you plan to notify customers and Atlassian in case of a security incident or a critical vulnerability on your app?**
Yes.

**17. Have you read our security incident notification guide?**
Yes.

**18. Have you identified a security contact for the app and had them create an account on ecosystem.atlassian.net?**
Yes.
