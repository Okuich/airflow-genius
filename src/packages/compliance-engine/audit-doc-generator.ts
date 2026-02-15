// ─── Audit Documentation Generator ─────────────────────────────────────────
// Produces structured audit documents from compliance findings.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceFinding,
  ComplianceRiskReport,
  StandardMapping,
  AuditDocument,
  AuditFinding,
  ComplianceStandard,
  ComplianceRule,
} from "@/packages/types";
import { RULE_LIBRARY } from "@/packages/compliance-knowledge";

export class AuditDocumentGenerator {
  /**
   * Generate a full audit document from compliance findings.
   */
  generate(params: {
    simulationId: string;
    organizationId: string;
    findings: ComplianceFinding[];
    standardMappings: StandardMapping[];
    riskReport: ComplianceRiskReport;
  }): AuditDocument {
    const auditFindings = this.extractFindings(params.findings);
    const standards = this.collectStandards(params.standardMappings);
    const verdict = this.determineVerdict(auditFindings, params.riskReport);

    return {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: this.generateTitle(standards, verdict),
      generatedAt: new Date().toISOString(),
      simulationId: params.simulationId,
      organizationId: params.organizationId,
      standards,
      findings: auditFindings,
      riskReport: params.riskReport,
      summary: this.generateSummary(auditFindings, params.riskReport, verdict),
      signOffRequired: verdict !== "compliant",
      overallVerdict: verdict,
    };
  }

  private findRule(ruleId: string): ComplianceRule | undefined {
    return RULE_LIBRARY.find((r) => r.id === ruleId);
  }

  private extractFindings(findings: ComplianceFinding[]): AuditFinding[] {
    return findings
      .filter((f) => f.status === "Fail")
      .map((f, i) => {
        const rule = this.findRule(f.ruleId);
        return {
          id: `finding-${i + 1}`,
          authority: rule?.authority ?? "OSHA",
          standardCode: rule?.standardCode ?? f.ruleId,
          description: rule?.description ?? f.ruleId,
          severity: f.riskLevel,
          actualValue: `${f.measuredValue.toFixed(2)}`,
          requiredValue: rule ? `${rule.operator} ${f.threshold}` : `${f.threshold}`,
          remediation: f.recommendation,
          deadline: f.riskLevel === "Critical" ? "immediate" : f.riskLevel === "High" ? "7 days" : f.riskLevel === "Medium" ? "30 days" : null,
        };
      });
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
