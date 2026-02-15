// ─── Audit Documentation Generator ─────────────────────────────────────────
// Produces structured audit documents from compliance pipeline outputs.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceCheckResult,
  ComplianceRiskReport,
  StandardMapping,
  AuditDocument,
  AuditFinding,
  ComplianceStandard,
} from "@/packages/types";

export class AuditDocumentGenerator {
  /**
   * Generate a full audit document from compliance results.
   */
  generate(params: {
    simulationId: string;
    organizationId: string;
    checkResults: ComplianceCheckResult[];
    standardMappings: StandardMapping[];
    riskReport: ComplianceRiskReport;
  }): AuditDocument {
    const findings = this.extractFindings(params.checkResults);
    const standards = this.collectStandards(params.standardMappings);
    const verdict = this.determineVerdict(findings, params.riskReport);

    return {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: this.generateTitle(standards, verdict),
      generatedAt: new Date().toISOString(),
      simulationId: params.simulationId,
      organizationId: params.organizationId,
      standards,
      findings,
      riskReport: params.riskReport,
      summary: this.generateSummary(findings, params.riskReport, verdict),
      signOffRequired: verdict !== "compliant",
      overallVerdict: verdict,
    };
  }

  private extractFindings(results: ComplianceCheckResult[]): AuditFinding[] {
    return results
      .filter((r) => !r.passed)
      .map((r, i) => ({
        id: `finding-${i + 1}`,
        standard: r.rule.standard,
        clause: r.rule.clause,
        description: r.rule.description,
        severity: r.severity,
        actualValue: `${r.actualValue.toFixed(2)} ${r.rule.unit}`,
        requiredValue: this.formatRequired(r),
        remediation: r.remediation ?? "Review and correct to meet regulatory requirements.",
        deadline: r.severity === "violation" ? "immediate" : r.severity === "warning" ? "30 days" : null,
      }));
  }

  private formatRequired(r: ComplianceCheckResult): string {
    const op = { lt: "<", lte: "≤", gt: ">", gte: "≥", eq: "=", between: "" }[r.rule.operator];
    if (r.rule.operator === "between") {
      return `${r.rule.threshold}–${r.rule.upperBound} ${r.rule.unit}`;
    }
    return `${op} ${r.rule.threshold} ${r.rule.unit}`;
  }

  private collectStandards(mappings: StandardMapping[]): ComplianceStandard[] {
    return [...new Set(mappings.map((m) => m.standard))];
  }

  private determineVerdict(
    findings: AuditFinding[],
    riskReport: ComplianceRiskReport
  ): AuditDocument["overallVerdict"] {
    const hasViolation = findings.some((f) => f.severity === "violation");
    if (hasViolation) return "non_compliant";
    if (riskReport.riskLevel === "high" || riskReport.riskLevel === "critical") return "non_compliant";
    if (findings.length > 0) return "conditionally_compliant";
    return "compliant";
  }

  private generateTitle(
    standards: ComplianceStandard[],
    verdict: AuditDocument["overallVerdict"]
  ): string {
    const standardStr = standards.slice(0, 3).join(", ");
    const suffix = standards.length > 3 ? ` +${standards.length - 3} more` : "";
    return `CFD Compliance Audit — ${standardStr}${suffix} — ${verdict.replace(/_/g, " ").toUpperCase()}`;
  }

  private generateSummary(
    findings: AuditFinding[],
    riskReport: ComplianceRiskReport,
    verdict: AuditDocument["overallVerdict"]
  ): string {
    if (verdict === "compliant") {
      return `All evaluated compliance checks passed. Overall risk level: ${riskReport.riskLevel}. No findings require remediation.`;
    }

    const violations = findings.filter((f) => f.severity === "violation").length;
    const warnings = findings.filter((f) => f.severity === "warning").length;
    const advisories = findings.filter((f) => f.severity === "advisory").length;

    const parts: string[] = [];
    parts.push(`Audit verdict: ${verdict.replace(/_/g, " ")}.`);
    parts.push(`Risk level: ${riskReport.riskLevel} (score ${riskReport.overallRiskScore}/${riskReport.maxPossibleScore}).`);

    if (violations > 0) parts.push(`${violations} violation(s) requiring immediate remediation.`);
    if (warnings > 0) parts.push(`${warnings} warning(s) to address within 30 days.`);
    if (advisories > 0) parts.push(`${advisories} advisory note(s).`);

    if (riskReport.topRisks.length > 0) {
      parts.push(`Top risk: ${riskReport.topRisks[0]}.`);
    }

    return parts.join(" ");
  }
}
