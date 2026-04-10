import Resolver from "@forge/resolver";
import { getDashboardAuditInsights } from "./resolvers/getDashboardAuditInsights";

const resolver = new Resolver();

resolver.define("getDashboardAuditInsights", async (request) => {
  return getDashboardAuditInsights(request.payload ?? {});
});

export const handler = resolver.getDefinitions();
