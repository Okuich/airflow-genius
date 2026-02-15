// ─── Compliance Rules Engine ────────────────────────────────────────────────
// Evaluates simulation results against regulatory rules and standards.
// Rules sourced from packages/compliance-knowledge.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceRule,
  ComplianceFinding,
  AirflowComplianceDomain,
} from "@/packages/types";
import { RULE_LIBRARY, RULE_DOMAIN_MAP, resolveRemediation } from "@/packages/compliance-knowledge";

// ── Engine ─────────────────────────────────────────────────────────────────

export class ComplianceRulesEngine {
  private readonly rules: ComplianceRule[];

  constructor(customRules?: ComplianceRule[]) {
    this.rules = [...RULE_LIBRARY, ...(customRules ?? [])];
  }

  /** Get all rules, optionally filtered by domain. */
  getRules(domain?: AirflowComplianceDomain): ComplianceRule[] {
    if (!domain) return this.rules;
    return this.rules.filter((r) => {
      const ruleDomain = RULE_DOMAIN_MAP[r.id];
      return ruleDomain === domain || ruleDomain === "general";
    });
  }

  /**
   * Evaluate metrics against all applicable rules for a given domain.
   * @param metrics  Key-value map of metric name → numeric value.
   * @param domain   Airflow domain to filter rules.
   */
  evaluate(
    metrics: Record<string, number>,
    domain: AirflowComplianceDomain
  ): ComplianceFinding[] {
    const applicableRules = this.getRules(domain);
    const results: ComplianceFinding[] = [];

    for (const rule of applicableRules) {
      const value = metrics[rule.metric];
      if (value === undefined) continue;

      const passed = this.checkRule(rule, value);
      results.push({
        ruleId: rule.id,
        status: passed ? "Pass" : "Fail",
        measuredValue: value,
        threshold: rule.threshold,
        riskLevel: passed ? "Low" : rule.severity,
        recommendation: passed
          ? "No action required."
          : this.buildRecommendation(rule, value),
      });
    }

    return results;
  }

  private checkRule(rule: ComplianceRule, value: number): boolean {
    switch (rule.operator) {
      case ">": return value > rule.threshold;
      case "<": return value < rule.threshold;
      case ">=": return value >= rule.threshold;
      case "<=": return value <= rule.threshold;
      default: return false;
    }
  }

  private buildRecommendation(rule: ComplianceRule, value: number): string {
    const gap = Math.abs(value - rule.threshold);
    const pct = rule.threshold > 0 ? ((gap / rule.threshold) * 100).toFixed(0) : "N/A";

    return resolveRemediation(rule.metric, {
      gap,
      pct,
      standardCode: `${rule.authority} ${rule.standardCode}`,
      threshold: rule.threshold,
    });
  }
}
