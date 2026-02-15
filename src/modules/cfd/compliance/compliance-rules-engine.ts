// ─── Compliance Rules Engine ────────────────────────────────────────────────
// Evaluates simulation results against regulatory rules and standards.
// Rules sourced from packages/compliance-knowledge.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceRule,
  ComplianceCheckResult,
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
      case ">": return value > rule.threshold;
      case "<": return value < rule.threshold;
      case ">=": return value >= rule.threshold;
      case "<=": return value <= rule.threshold;
      default: return false;
    }
  }

  private formatDetail(rule: ComplianceRule, value: number, passed: boolean): string {
    const status = passed ? "PASS" : rule.severity.toUpperCase();
    return `[${status}] ${rule.description}: actual ${value.toFixed(2)}, required ${rule.operator} ${rule.threshold} (${rule.authority} ${rule.standardCode})`;
  }

  private buildRemediation(rule: ComplianceRule, value: number): string {
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
