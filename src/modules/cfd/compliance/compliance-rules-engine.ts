// ─── Compliance Rules Engine ────────────────────────────────────────────────
// Evaluates simulation results against regulatory rules and standards.
// Rules sourced from packages/compliance-knowledge.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceRule,
  ComplianceCheckResult,
  AirflowComplianceDomain,
} from "@/packages/types";
import { RULE_LIBRARY, resolveRemediation } from "@/packages/compliance-knowledge";

// ── Engine ─────────────────────────────────────────────────────────────────

export class ComplianceRulesEngine {
  private readonly rules: ComplianceRule[];

  constructor(customRules?: ComplianceRule[]) {
    this.rules = [...RULE_LIBRARY, ...(customRules ?? [])];
  }

  /** Get all rules, optionally filtered by domain. */
  getRules(domain?: AirflowComplianceDomain): ComplianceRule[] {
    return domain ? this.rules.filter((r) => r.domain === domain || r.domain === "general") : this.rules;
  }

  /**
   * Evaluate metrics against all applicable rules for a given domain.
   * @param metrics  Key-value map of metric name → numeric value.
   * @param domain   Airflow domain to filter rules.
   */
  evaluate(
    metrics: Record<string, number>,
    domain: AirflowComplianceDomain
  ): ComplianceCheckResult[] {
    const applicableRules = this.getRules(domain);
    const results: ComplianceCheckResult[] = [];

    for (const rule of applicableRules) {
      const value = metrics[rule.metric];
      if (value === undefined) continue;

      const passed = this.checkRule(rule, value);
      results.push({
        ruleId: rule.id,
        rule,
        actualValue: value,
        passed,
        severity: passed ? "pass" : rule.severity,
        detail: this.formatDetail(rule, value, passed),
        remediation: passed ? null : this.buildRemediation(rule, value),
      });
    }

    return results;
  }

  private checkRule(rule: ComplianceRule, value: number): boolean {
    switch (rule.operator) {
      case "lt": return value < rule.threshold;
      case "lte": return value <= rule.threshold;
      case "gt": return value > rule.threshold;
      case "gte": return value >= rule.threshold;
      case "eq": return Math.abs(value - rule.threshold) < 1e-9;
      case "between": return value >= rule.threshold && value <= (rule.upperBound ?? Infinity);
      default: return false;
    }
  }

  private formatDetail(rule: ComplianceRule, value: number, passed: boolean): string {
    const status = passed ? "PASS" : rule.severity.toUpperCase();
    if (rule.operator === "between") {
      return `[${status}] ${rule.description}: actual ${value.toFixed(2)} ${rule.unit}, required ${rule.threshold}–${rule.upperBound} ${rule.unit} (${rule.standard} §${rule.clause})`;
    }
    const opStr = { lt: "<", lte: "≤", gt: ">", gte: "≥", eq: "=", between: "" }[rule.operator];
    return `[${status}] ${rule.description}: actual ${value.toFixed(2)} ${rule.unit}, required ${opStr} ${rule.threshold} ${rule.unit} (${rule.standard} §${rule.clause})`;
  }

  private buildRemediation(rule: ComplianceRule, value: number): string {
    const gap = Math.abs(value - rule.threshold);
    const pct = rule.threshold > 0 ? ((gap / rule.threshold) * 100).toFixed(0) : "N/A";

    return resolveRemediation(rule.metric, {
      gap,
      pct,
      standard: rule.standard,
      clause: rule.clause,
      threshold: rule.threshold,
      upperBound: rule.upperBound,
      unit: rule.unit,
    });
  }
}
