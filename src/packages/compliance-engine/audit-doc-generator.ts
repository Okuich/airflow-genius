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
        authority: r.rule.authority,
        standardCode: r.rule.standardCode,
        description: r.rule.description,
        severity: r.severity,
        actualValue: `${r.actualValue.toFixed(2)}`,
        requiredValue: `${r.rule.operator} ${r.rule.threshold}`,
        remediation: r.remediation ?? "Review and correct to meet regulatory requirements.",
        deadline: r.severity === "Critical" ? "immediate" : r.severity === "High" ? "7 days" : r.severity === "Medium" ? "30 days" : null,
      }));
  }

  private collectStandards(mappings: StandardMapping[]): ComplianceStandard[] {
    return [...new Set(mappings.map((m) => m.standard))];
  }

  private determineVerdict(
    findings: AuditFinding[],
    riskReport: ComplianceRiskReport
  ): AuditDocument["overallVerdict"] {
    const hasCritical = findings.some((f) => f.severity === "Critical" || f.severity === "High");
    if (hasCritical) return "non_compliant";
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

    const critical = findings.filter((f) => f.severity === "Critical").length;
    const high = findings.filter((f) => f.severity === "High").length;
    const medium = findings.filter((f) => f.severity === "Medium").length;
    const low = findings.filter((f) => f.severity === "Low").length;

    const parts: string[] = [];
    parts.push(`Audit verdict: ${verdict.replace(/_/g, " ")}.`);
    parts.push(`Risk level: ${riskReport.riskLevel} (score ${riskReport.overallRiskScore}/${riskReport.maxPossibleScore}).`);

    if (critical > 0) parts.push(`${critical} critical finding(s) requiring immediate remediation.`);
    if (high > 0) parts.push(`${high} high-severity finding(s) to address within 7 days.`);
    if (medium > 0) parts.push(`${medium} medium finding(s) to address within 30 days.`);
    if (low > 0) parts.push(`${low} advisory note(s).`);

    if (riskReport.topRisks.length > 0) {
      parts.push(`Top risk: ${riskReport.topRisks[0]}.`);
    }

    return parts.join(" ");
  }
}
