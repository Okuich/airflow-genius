// ─── Remediation Planner ────────────────────────────────────────────────────
// Generates a prioritised remediation plan from compliance findings.
// ──────────────────────────────────────────────────────────────────────────

import type { ComplianceFinding } from "@/packages/types";
import type { RemediationPriority, RemediationPlan, RemediationCostConfig } from "./types";
import { RULE_LIBRARY } from "@/packages/compliance-knowledge";

const DEFAULT_COSTS: RemediationCostConfig = { Low: 500, Medium: 2_500, High: 10_000, Critical: 25_000 };
const RISK_REDUCTION: Record<string, number> = { Low: 2, Medium: 6, High: 12, Critical: 20 };
const TIMELINE_DAYS: Record<string, number> = { Low: 90, Medium: 30, High: 7, Critical: 1 };

export class RemediationPlanner {
  private readonly costs: RemediationCostConfig;

  constructor(costs?: Partial<RemediationCostConfig>) {
    this.costs = { ...DEFAULT_COSTS, ...costs };
  }

  /**
   * Generate a prioritised remediation plan from failed findings.
   * Items are sorted by cost-effectiveness (risk reduction / cost).
   */
  plan(findings: ComplianceFinding[]): RemediationPlan {
    const failures = findings.filter((f) => f.status === "Fail");

    const priorities: RemediationPriority[] = failures.map((f) => {
      const rule = RULE_LIBRARY.find((r) => r.id === f.ruleId);
      const cost = this.costs[f.riskLevel];
      const reduction = RISK_REDUCTION[f.riskLevel] ?? 5;
      const effectiveness = cost > 0 ? round2(reduction / (cost / 1000)) : 0;
      const days = TIMELINE_DAYS[f.riskLevel] ?? 30;

      return {
        ruleId: f.ruleId,
        description: rule?.description ?? f.ruleId,
        severity: f.riskLevel,
        estimatedCost: cost,
        riskReduction: reduction,
        costEffectiveness: effectiveness,
        deadline: f.riskLevel === "Critical" ? "immediate" : f.riskLevel === "High" ? `${days} days` : `${days} days`,
      };
    });

    priorities.sort((a, b) => b.costEffectiveness - a.costEffectiveness);

    const totalCost = priorities.reduce((s, p) => s + p.estimatedCost, 0);
    const estimatedRiskReduction = priorities.reduce((s, p) => s + p.riskReduction, 0);
    const estimatedTimelineDays = Math.max(0, ...priorities.map((p) => TIMELINE_DAYS[p.severity] ?? 30));

    return { priorities, totalCost, estimatedRiskReduction, estimatedTimelineDays };
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
