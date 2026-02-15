// ─── Risk Scoring Engine ────────────────────────────────────────────────────
// Converts compliance findings into a weighted risk report.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceFinding,
  ComplianceRiskReport,
} from "@/packages/types";
import { RULE_LIBRARY } from "@/packages/compliance-knowledge";

const RISK_WEIGHT: Record<ComplianceFinding["riskLevel"], number> = {
  Low: 1,
  Medium: 3,
  High: 4,
  Critical: 5,
};

/** Estimated average remediation cost per risk level (USD). */
const REMEDIATION_COST: Record<ComplianceFinding["riskLevel"], number> = {
  Low: 500,
  Medium: 2_500,
  High: 10_000,
  Critical: 25_000,
};

export class RiskScoringEngine {
  /**
   * Compute a risk report from compliance findings.
   *
   * - `overallScore` — 0-100 normalised risk score (0 = no risk, 100 = maximum).
   * - `highRiskCount` — number of findings with riskLevel High or Critical.
   * - `projectedRemediationCost` — estimated USD cost to remediate all failures.
   * - `complianceProbability` — 0-1 likelihood the system is compliant.
   */
  computeRisk(findings: ComplianceFinding[]): ComplianceRiskReport {
    if (findings.length === 0) {
      return { overallScore: 0, highRiskCount: 0, projectedRemediationCost: 0, complianceProbability: 1 };
    }

    const failures = findings.filter((f) => f.status === "Fail");

    // ── Overall score (0-100) ──────────────────────────────────────────────
    const totalWeight = failures.reduce((sum, f) => sum + RISK_WEIGHT[f.riskLevel], 0);
    const maxWeight = findings.length * RISK_WEIGHT.Critical;
    const overallScore = maxWeight > 0 ? Math.round((totalWeight / maxWeight) * 100) : 0;

    // ── High risk count ────────────────────────────────────────────────────
    const highRiskCount = failures.filter(
      (f) => f.riskLevel === "High" || f.riskLevel === "Critical"
    ).length;

    // ── Projected remediation cost ─────────────────────────────────────────
    const projectedRemediationCost = failures.reduce(
      (sum, f) => sum + REMEDIATION_COST[f.riskLevel],
      0
    );

    // ── Compliance probability ─────────────────────────────────────────────
    // Based on pass rate, weighted by severity.
    const passWeight = findings
      .filter((f) => f.status === "Pass")
      .reduce((sum, f) => sum + RISK_WEIGHT[f.riskLevel], 0);
    const complianceProbability =
      maxWeight > 0
        ? Math.round((passWeight / maxWeight) * 100) / 100
        : 1;

    return {
      overallScore,
      highRiskCount,
      projectedRemediationCost,
      complianceProbability,
    };
  }
}
