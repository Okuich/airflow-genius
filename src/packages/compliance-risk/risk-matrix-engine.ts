// ─── Risk Matrix Engine ─────────────────────────────────────────────────────
// Maps compliance findings onto a likelihood × impact risk matrix.
// ──────────────────────────────────────────────────────────────────────────

import type { ComplianceFinding, AirflowComplianceDomain } from "@/packages/types";
import type { RiskMatrixEntry, RiskMatrixResult } from "./types";
import { RULE_LIBRARY, RULE_DOMAIN_MAP } from "@/packages/compliance-knowledge";

const SEVERITY_IMPACT: Record<string, number> = { Low: 0.2, Medium: 0.5, High: 0.8, Critical: 1.0 };

export class RiskMatrixEngine {
  /**
   * Build a risk matrix from compliance findings.
   * Likelihood is derived from how far a metric deviates from its threshold.
   */
  build(findings: ComplianceFinding[]): RiskMatrixResult {
    const entries: RiskMatrixEntry[] = findings.map((f) => {
      const rule = RULE_LIBRARY.find((r) => r.id === f.ruleId);
      const domain = (rule ? RULE_DOMAIN_MAP[rule.id] : "general") as AirflowComplianceDomain;

      const likelihood = f.status === "Fail"
        ? Math.min(1, Math.abs(f.measuredValue - f.threshold) / Math.max(f.threshold, 1) + 0.3)
        : 0.1;

      const impact = SEVERITY_IMPACT[f.riskLevel] ?? 0.5;

      return { ruleId: f.ruleId, likelihood: round2(likelihood), impact: round2(impact), riskLevel: f.riskLevel, domain };
    });

    const highRiskQuadrant = entries.filter((e) => e.likelihood >= 0.5 && e.impact >= 0.5);
    const aggregateRisk = entries.length > 0
      ? round2(entries.reduce((s, e) => s + e.likelihood * e.impact, 0) / entries.length)
      : 0;

    return { entries, highRiskQuadrant, aggregateRisk };
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
