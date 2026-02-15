// ─── Compliance Knowledge Package ──────────────────────────────────────────
// Shared regulatory knowledge base for CFD compliance:
//   • Standard Catalog (ASHRAE, ISO, OSHA, NFPA, ACGIH, TIA, NEBS, EN)
//   • Rule Library (metric → threshold → severity)
//   • Metric ↔ Standard Links
//   • Remediation Templates
// ──────────────────────────────────────────────────────────────────────────

export type {
  StandardDefinition,
  ClauseDefinition,
  MetricStandardLink,
  RemediationTemplate,
  ComplianceKnowledgeBundle,
} from "./types";

export { STANDARD_CATALOG } from "./standard-catalog";
export { RULE_LIBRARY } from "./rule-library";
export { METRIC_STANDARD_LINKS, getStandardsForMetric, getMetricsForStandard } from "./metric-links";
export { REMEDIATION_TEMPLATES, resolveRemediation } from "./remediation-templates";

// ── Convenience: full bundle ───────────────────────────────────────────────

import type { ComplianceKnowledgeBundle } from "./types";
import { STANDARD_CATALOG } from "./standard-catalog";
import { RULE_LIBRARY } from "./rule-library";
import { METRIC_STANDARD_LINKS } from "./metric-links";
import { REMEDIATION_TEMPLATES } from "./remediation-templates";

/** Get the entire compliance knowledge base as a single bundle. */
export function getComplianceKnowledgeBundle(): ComplianceKnowledgeBundle {
  return {
    standards: STANDARD_CATALOG,
    rules: RULE_LIBRARY,
    metricLinks: METRIC_STANDARD_LINKS,
    remediationTemplates: REMEDIATION_TEMPLATES,
  };
}
