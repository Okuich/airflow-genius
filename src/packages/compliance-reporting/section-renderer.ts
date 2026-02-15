// ─── Section Renderer ───────────────────────────────────────────────────────
// Renders individual report sections from an AuditDocument.
// ──────────────────────────────────────────────────────────────────────────

import type { AuditDocument, AuditFinding, ComplianceRiskReport } from "@/packages/types";
import type { ReportSectionId } from "./types";

/** Render a section to Markdown. */
export function renderSection(section: ReportSectionId, doc: AuditDocument): string {
  switch (section) {
    case "header":
      return renderHeader(doc);
    case "verdict_summary":
      return renderVerdictSummary(doc);
    case "risk_overview":
      return renderRiskOverview(doc.riskReport);
    case "findings_table":
      return renderFindingsTable(doc.findings);
    case "standards_referenced":
      return renderStandards(doc);
    case "remediation_actions":
      return renderRemediationActions(doc.findings);
    case "cost_breakdown":
      return renderCostBreakdown(doc.riskReport);
    case "sign_off":
      return renderSignOff(doc);
    case "appendix_rules":
      return renderAppendixRules();
    case "appendix_methodology":
      return renderAppendixMethodology();
    default:
      return "";
  }
}

function renderHeader(doc: AuditDocument): string {
  return [
    `# ${doc.title}`,
    "",
    `**Document ID:** ${doc.id}  `,
    `**Simulation:** ${doc.simulationId}  `,
    `**Organization:** ${doc.organizationId}  `,
    `**Generated:** ${doc.generatedAt}  `,
    "",
  ].join("\n");
}

function renderVerdictSummary(doc: AuditDocument): string {
  const verdict = doc.overallVerdict.replace(/_/g, " ").toUpperCase();
  return [
    "## Verdict Summary",
    "",
    `**Overall Verdict:** ${verdict}  `,
    `**Sign-Off Required:** ${doc.signOffRequired ? "Yes" : "No"}  `,
    "",
    doc.summary,
    "",
  ].join("\n");
}

function renderRiskOverview(risk: ComplianceRiskReport): string {
  return [
    "## Risk Overview",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Overall Risk Score | ${risk.overallScore}/100 |`,
    `| High-Risk Findings | ${risk.highRiskCount} |`,
    `| Compliance Probability | ${(risk.complianceProbability * 100).toFixed(0)}% |`,
    `| Projected Remediation Cost | $${risk.projectedRemediationCost.toLocaleString()} |`,
    "",
  ].join("\n");
}

function renderFindingsTable(findings: AuditFinding[]): string {
  if (findings.length === 0) {
    return "## Findings\n\nNo findings to report.\n";
  }

  const rows = findings.map(
    (f) =>
      `| ${f.id} | ${f.authority} ${f.standardCode} | ${f.severity} | ${f.actualValue} | ${f.requiredValue} | ${f.deadline ?? "—"} |`
  );

  return [
    "## Findings",
    "",
    "| ID | Standard | Severity | Actual | Required | Deadline |",
    "|----|----------|----------|--------|----------|----------|",
    ...rows,
    "",
    ...findings.map((f) => `**${f.id}:** ${f.description}  \n${f.remediation}\n`),
    "",
  ].join("\n");
}

function renderStandards(doc: AuditDocument): string {
  if (doc.standards.length === 0) return "";
  return [
    "## Standards Referenced",
    "",
    ...doc.standards.map((s) => `- ${s}`),
    "",
  ].join("\n");
}

function renderRemediationActions(findings: AuditFinding[]): string {
  const actionable = findings.filter((f) => f.deadline);
  if (actionable.length === 0) return "## Remediation Actions\n\nNo remediation actions required.\n";

  return [
    "## Remediation Actions",
    "",
    "| Priority | Finding | Action | Deadline |",
    "|----------|---------|--------|----------|",
    ...actionable.map(
      (f) => `| ${f.severity} | ${f.id} | ${f.remediation} | ${f.deadline} |`
    ),
    "",
  ].join("\n");
}

function renderCostBreakdown(risk: ComplianceRiskReport): string {
  return [
    "## Cost Breakdown",
    "",
    `**Total Projected Remediation Cost:** $${risk.projectedRemediationCost.toLocaleString()}`,
    "",
  ].join("\n");
}

function renderSignOff(doc: AuditDocument): string {
  if (!doc.signOffRequired) return "";
  return [
    "## Sign-Off",
    "",
    "This report requires management sign-off before compliance status can be confirmed.",
    "",
    "| Role | Name | Signature | Date |",
    "|------|------|-----------|------|",
    "| Compliance Officer | __________ | __________ | __________ |",
    "| Engineering Lead | __________ | __________ | __________ |",
    "",
  ].join("\n");
}

function renderAppendixRules(): string {
  return [
    "## Appendix A: Rule Library",
    "",
    "The compliance evaluation uses a curated rule library derived from regulatory standards",
    "including ASHRAE 62.1, ASHRAE 55, ISO 14644, OSHA PEL, NFPA 45, ACGIH TLV, ASHRAE 90.4,",
    "TIA 942, and NEBS GR-3028. Each rule maps a CFD simulation metric to a regulatory threshold.",
    "",
  ].join("\n");
}

function renderAppendixMethodology(): string {
  return [
    "## Appendix B: Methodology",
    "",
    "1. **Rules Evaluation** — Simulation metrics are evaluated against applicable regulatory rules.",
    "2. **Standard Mapping** — Relevant standards are identified based on domain and context.",
    "3. **Risk Scoring** — Findings are weighted by severity to produce a 0-100 risk score.",
    "4. **Audit Generation** — A structured audit document is produced with verdict and remediation plan.",
    "",
  ].join("\n");
}
