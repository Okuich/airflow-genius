// ─── Compliance Risk Engine ─────────────────────────────────────────────────
// Converts ComplianceFinding[] + historical data into a ComplianceRiskReport.
//
// Features:
//   • Configurable weighted scoring model
//   • Severity multiplier (repeat/escalating violations)
//   • Remediation cost estimator with domain-aware adjustments
//   • Historical compliance data integration for trend-aware scoring
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceFinding,
  ComplianceRiskReport,
} from "@/packages/types";
import type {
  RiskWeightConfig,
  RemediationCostConfig,
  RiskBreakdown,
  RiskCategory,
} from "./types";

// ── Configuration ──────────────────────────────────────────────────────────

export interface HistoricalSnapshot {
  /** ISO timestamp of the evaluation. */
  evaluatedAt: string;
  /** Overall risk score from that evaluation. */
  overallScore: number;
  /** Number of failed findings. */
  violationCount: number;
  /** Rule IDs that failed. */
  failedRuleIds: string[];
}

export interface ComplianceRiskEngineConfig {
  /** Custom severity weights (default: Low=1, Medium=3, High=4, Critical=5). */
  weights?: Partial<RiskWeightConfig>;
  /** Custom remediation cost per severity (USD). */
  costs?: Partial<RemediationCostConfig>;
  /** Severity multiplier for repeat violations found in history. */
  repeatViolationMultiplier?: number;
  /** Severity multiplier for escalating violations (worse than last snapshot). */
  escalationMultiplier?: number;
  /** Floor for compliance probability (default: 0). */
  complianceProbabilityFloor?: number;
}

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: RiskWeightConfig = { Low: 1, Medium: 3, High: 4, Critical: 5 };

const DEFAULT_COSTS: RemediationCostConfig = {
  Low: 500,
  Medium: 2_500,
  High: 10_000,
  Critical: 25_000,
};

const CATEGORY_KEYWORDS: Record<RiskCategory, string[]> = {
  regulatory: ["PEL", "TWA", "CFR", "OSHA", "EPA", "NFPA"],
  operational: ["velocity", "airflow", "temperature", "ACH", "PUE"],
  financial: ["cost", "energy", "PUE", "efficiency"],
  reputational: ["cleanroom", "ISO", "containment", "audit"],
};

// ── Engine ──────────────────────────────────────────────────────────────────

export class ComplianceRiskEngine {
  private readonly weights: RiskWeightConfig;
  private readonly costs: RemediationCostConfig;
  private readonly repeatMultiplier: number;
  private readonly escalationMultiplier: number;
  private readonly probabilityFloor: number;

  constructor(config?: ComplianceRiskEngineConfig) {
    this.weights = { ...DEFAULT_WEIGHTS, ...config?.weights };
    this.costs = { ...DEFAULT_COSTS, ...config?.costs };
    this.repeatMultiplier = config?.repeatViolationMultiplier ?? 1.5;
    this.escalationMultiplier = config?.escalationMultiplier ?? 1.3;
    this.probabilityFloor = config?.complianceProbabilityFloor ?? 0;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Compute a ComplianceRiskReport from findings and optional history.
   *
   * - `overallScore` — 0-100 normalised risk score (0 = no risk, 100 = maximum).
   * - `highRiskCount` — number of findings with riskLevel High or Critical.
   * - `projectedRemediationCost` — USD estimate to remediate all failures.
   * - `complianceProbability` — 0-1 likelihood the system is compliant.
   */
  computeRisk(
    findings: ComplianceFinding[],
    history?: HistoricalSnapshot[]
  ): ComplianceRiskReport {
    if (findings.length === 0) {
      return {
        overallScore: 0,
        highRiskCount: 0,
        projectedRemediationCost: 0,
        complianceProbability: 1,
      };
    }

    const failures = findings.filter((f) => f.status === "Fail");

    // ── Determine multipliers from history ──────────────────────────────
    const repeatIds = this.detectRepeatViolations(failures, history);
    const isEscalating = this.detectEscalation(failures, history);

    // ── Weighted score ──────────────────────────────────────────────────
    let totalWeight = 0;
    for (const f of failures) {
      let w = this.weights[f.riskLevel];
      if (repeatIds.has(f.ruleId)) w *= this.repeatMultiplier;
      if (isEscalating) w *= this.escalationMultiplier;
      totalWeight += w;
    }

    const maxWeight = findings.length * this.weights.Critical;
    const overallScore = maxWeight > 0
      ? Math.min(100, Math.round((totalWeight / maxWeight) * 100))
      : 0;

    // ── High risk count ─────────────────────────────────────────────────
    const highRiskCount = failures.filter(
      (f) => f.riskLevel === "High" || f.riskLevel === "Critical"
    ).length;

    // ── Remediation cost ────────────────────────────────────────────────
    const projectedRemediationCost = this.estimateRemediationCost(failures, repeatIds);

    // ── Compliance probability ──────────────────────────────────────────
    const passWeight = findings
      .filter((f) => f.status === "Pass")
      .reduce((sum, f) => sum + this.weights[f.riskLevel], 0);
    const rawProbability = maxWeight > 0
      ? Math.round((passWeight / maxWeight) * 100) / 100
      : 1;
    const complianceProbability = Math.max(this.probabilityFloor, rawProbability);

    return { overallScore, highRiskCount, projectedRemediationCost, complianceProbability };
  }

  /**
   * Break down risk by category (regulatory, operational, financial, reputational).
   */
  computeBreakdown(findings: ComplianceFinding[]): RiskBreakdown[] {
    const categories: RiskCategory[] = ["regulatory", "operational", "financial", "reputational"];

    return categories.map((category) => {
      const keywords = CATEGORY_KEYWORDS[category];
      const matched = findings.filter((f) =>
        keywords.some((kw) => f.ruleId.toUpperCase().includes(kw) || f.recommendation.toUpperCase().includes(kw))
      );
      const failures = matched.filter((f) => f.status === "Fail");

      const score = failures.reduce((s, f) => s + this.weights[f.riskLevel], 0);

      return {
        category,
        score,
        findingCount: matched.length,
        topFindings: failures.slice(0, 5).map((f) => f.ruleId),
      };
    });
  }

  /**
   * Estimate the severity multiplier applied to a specific finding,
   * considering historical repeat violations.
   */
  getSeverityMultiplier(
    finding: ComplianceFinding,
    history?: HistoricalSnapshot[]
  ): number {
    let multiplier = 1;

    const repeatIds = this.detectRepeatViolations(
      [finding],
      history
    );
    if (repeatIds.has(finding.ruleId)) {
      multiplier *= this.repeatMultiplier;
    }

    if (this.detectEscalation([finding], history)) {
      multiplier *= this.escalationMultiplier;
    }

    return round2(multiplier);
  }

  // ── Internals ─────────────────────────────────────────────────────────

  /**
   * Detect rule IDs that failed in the current set AND in at least one
   * historical snapshot.
   */
  private detectRepeatViolations(
    failures: ComplianceFinding[],
    history?: HistoricalSnapshot[]
  ): Set<string> {
    const repeats = new Set<string>();
    if (!history || history.length === 0) return repeats;

    const historicalFailedIds = new Set(
      history.flatMap((h) => h.failedRuleIds)
    );

    for (const f of failures) {
      if (historicalFailedIds.has(f.ruleId)) {
        repeats.add(f.ruleId);
      }
    }

    return repeats;
  }

  /**
   * Detect whether the current violation count exceeds the most recent
   * historical snapshot (i.e. the situation is getting worse).
   */
  private detectEscalation(
    failures: ComplianceFinding[],
    history?: HistoricalSnapshot[]
  ): boolean {
    if (!history || history.length === 0) return false;

    const sorted = [...history].sort(
      (a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime()
    );
    const latest = sorted[0];

    return failures.length > latest.violationCount;
  }

  /**
   * Estimate remediation cost, adding a surcharge for repeat violations.
   */
  private estimateRemediationCost(
    failures: ComplianceFinding[],
    repeatIds: Set<string>
  ): number {
    let total = 0;

    for (const f of failures) {
      let cost = this.costs[f.riskLevel];
      // Repeat violations cost more to fix (process / systemic issues)
      if (repeatIds.has(f.ruleId)) {
        cost *= 1.25;
      }
      total += cost;
    }

    return Math.round(total);
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
