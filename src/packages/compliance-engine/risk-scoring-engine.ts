// ─── Risk Scoring Engine ────────────────────────────────────────────────────
// Converts compliance findings into a weighted risk report.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceFinding,
  ComplianceRiskReport,
  ComplianceSeverity,
  ComplianceRule,
  RiskScore,
} from "@/packages/types";
import { RULE_LIBRARY } from "@/packages/compliance-knowledge";

const RISK_WEIGHT: Record<ComplianceFinding["riskLevel"], number> = {
  Low: 1,
  Medium: 3,
  High: 4,
  Critical: 5,
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
   * Compute a comprehensive risk report from compliance findings.
   */
  computeRisk(findings: ComplianceFinding[]): ComplianceRiskReport {
    const categories = this.categoriseFindings(findings);
    const categoryScores: RiskScore[] = [];
    let totalScore = 0;
    let totalMax = 0;

    for (const [category, items] of Object.entries(categories)) {
      const score = items.reduce(
        (sum, f) => sum + (f.status === "Pass" ? 0 : RISK_WEIGHT[f.riskLevel]),
        0
      );
      const maxScore = items.length * RISK_WEIGHT.Critical;
      totalScore += score;
      totalMax += maxScore;

      const factors = items
        .filter((f) => f.status === "Fail")
        .map((f) => {
          const rule = this.findRule(f.ruleId);
          return rule
            ? `${rule.authority} ${rule.standardCode}: ${rule.description}`
            : f.ruleId;
        });

      categoryScores.push({
        category: CATEGORY_LABELS[category] ?? category,
        score,
        maxScore,
        severity: this.scoreSeverity(score, maxScore),
        contributingFactors: factors,
      });
    }

    const topRisks = findings
      .filter((f) => f.status === "Fail")
      .sort((a, b) => RISK_WEIGHT[b.riskLevel] - RISK_WEIGHT[a.riskLevel])
      .slice(0, 5)
      .map((f) => {
        const rule = this.findRule(f.ruleId);
        return rule
          ? `[${f.riskLevel.toUpperCase()}] ${rule.description} (${rule.authority} ${rule.standardCode})`
          : `[${f.riskLevel.toUpperCase()}] ${f.ruleId}`;
      });

    return {
      overallRiskScore: totalScore,
      maxPossibleScore: totalMax,
      riskLevel: this.classifyRiskLevel(totalScore, totalMax),
      categories: categoryScores,
      topRisks,
    };
  }

  private findRule(ruleId: string): ComplianceRule | undefined {
    return RULE_LIBRARY.find((r) => r.id === ruleId);
  }

  private categoriseFindings(
    findings: ComplianceFinding[]
  ): Record<string, ComplianceFinding[]> {
    const categories: Record<string, ComplianceFinding[]> = {};

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

    for (const finding of findings) {
      const rule = this.findRule(finding.ruleId);
      const cat = rule ? (metricCategoryMap[rule.metric] ?? "structural") : "structural";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(finding);
    }

    return categories;
  }

  private scoreSeverity(score: number, maxScore: number): ComplianceSeverity {
    if (maxScore === 0) return "pass";
    const ratio = score / maxScore;
    if (ratio === 0) return "pass";
    if (ratio < 0.2) return "Low";
    if (ratio < 0.5) return "Medium";
    if (ratio < 0.7) return "High";
    return "Critical";
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
