// ─── Risk Scoring Engine ────────────────────────────────────────────────────
// Converts compliance check results into a weighted risk report.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceCheckResult,
  ComplianceRiskReport,
  ComplianceSeverity,
  RiskScore,
} from "@/packages/types";

const SEVERITY_WEIGHT: Record<ComplianceSeverity, number> = {
  pass: 0,
  advisory: 1,
  warning: 3,
  violation: 5,
};

const CATEGORY_LABELS: Record<string, string> = {
  ventilation: "Ventilation & Air Quality",
  thermal: "Thermal Comfort & Safety",
  containment: "Contaminant Containment",
  energy: "Energy Efficiency",
  structural: "Equipment & Infrastructure",
};

export class RiskScoringEngine {
  /**
   * Compute a comprehensive risk report from compliance check results.
   */
  computeRisk(results: ComplianceCheckResult[]): ComplianceRiskReport {
    const categories = this.categoriseResults(results);
    const categoryScores: RiskScore[] = [];
    let totalScore = 0;
    let totalMax = 0;

    for (const [category, checks] of Object.entries(categories)) {
      const score = checks.reduce(
        (sum, c) => sum + (c.passed ? 0 : SEVERITY_WEIGHT[c.severity]),
        0
      );
      const maxScore = checks.length * SEVERITY_WEIGHT.violation;
      totalScore += score;
      totalMax += maxScore;

      const factors = checks
        .filter((c) => !c.passed)
        .map((c) => `${c.rule.standard} §${c.rule.clause}: ${c.detail}`);

      categoryScores.push({
        category: CATEGORY_LABELS[category] ?? category,
        score,
        maxScore,
        severity: this.scoreSeverity(score, maxScore),
        contributingFactors: factors,
      });
    }

    const topRisks = results
      .filter((r) => !r.passed)
      .sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity])
      .slice(0, 5)
      .map((r) => `[${r.severity.toUpperCase()}] ${r.rule.description} (${r.rule.standard} §${r.rule.clause})`);

    return {
      overallRiskScore: totalScore,
      maxPossibleScore: totalMax,
      riskLevel: this.classifyRiskLevel(totalScore, totalMax),
      categories: categoryScores,
      topRisks,
    };
  }

  private categoriseResults(
    results: ComplianceCheckResult[]
  ): Record<string, ComplianceCheckResult[]> {
    const categories: Record<string, ComplianceCheckResult[]> = {};

    const metricCategoryMap: Record<string, string> = {
      outdoorAirRate: "ventilation",
      exhaustAirflow: "ventilation",
      airChangeRate: "ventilation",
      captureVelocity: "containment",
      faceVelocity: "containment",
      peakConcentration: "containment",
      twaConcentration: "containment",
      ammoniaConcentration: "containment",
      laminarCoverage: "containment",
      recoveryTime: "containment",
      operativeTemperature: "thermal",
      maxAirSpeed: "thermal",
      rackInletTemp: "thermal",
      estimatedPUE: "energy",
    };

    for (const result of results) {
      const cat = metricCategoryMap[result.rule.metric] ?? "structural";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(result);
    }

    return categories;
  }

  private scoreSeverity(score: number, maxScore: number): ComplianceSeverity {
    if (maxScore === 0) return "pass";
    const ratio = score / maxScore;
    if (ratio === 0) return "pass";
    if (ratio < 0.2) return "advisory";
    if (ratio < 0.5) return "warning";
    return "violation";
  }

  private classifyRiskLevel(score: number, max: number): ComplianceRiskReport["riskLevel"] {
    if (max === 0) return "low";
    const ratio = score / max;
    if (ratio === 0) return "low";
    if (ratio < 0.2) return "low";
    if (ratio < 0.45) return "medium";
    if (ratio < 0.7) return "high";
    return "critical";
  }
}
