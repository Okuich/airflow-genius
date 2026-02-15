// ─── Report Templates ───────────────────────────────────────────────────────
// Predefined compliance report templates.
// ──────────────────────────────────────────────────────────────────────────

import type { ReportTemplate } from "./types";

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "executive_summary",
    name: "Executive Summary",
    description: "High-level compliance overview for leadership and stakeholders.",
    sections: ["header", "verdict_summary", "risk_overview", "cost_breakdown", "sign_off"],
  },
  {
    id: "detailed_technical",
    name: "Detailed Technical Report",
    description: "Full technical compliance report with all findings and methodology.",
    sections: [
      "header",
      "verdict_summary",
      "risk_overview",
      "findings_table",
      "standards_referenced",
      "remediation_actions",
      "cost_breakdown",
      "sign_off",
      "appendix_rules",
      "appendix_methodology",
    ],
  },
  {
    id: "regulatory_submission",
    name: "Regulatory Submission",
    description: "Formatted for regulatory authority submission with standards mapping.",
    sections: [
      "header",
      "verdict_summary",
      "standards_referenced",
      "findings_table",
      "remediation_actions",
      "sign_off",
    ],
  },
  {
    id: "remediation_plan",
    name: "Remediation Plan",
    description: "Focused on actionable remediation steps with cost and timeline.",
    sections: ["header", "verdict_summary", "findings_table", "remediation_actions", "cost_breakdown"],
  },
];

export function getTemplate(id: string): ReportTemplate | undefined {
  return REPORT_TEMPLATES.find((t) => t.id === id);
}
