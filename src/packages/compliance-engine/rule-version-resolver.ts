// ─── Rule Version Resolver ──────────────────────────────────────────────────
// Manages versioned compliance rules with effective date resolution.
// ──────────────────────────────────────────────────────────────────────────

import type { ComplianceRule } from "@/packages/types";
import { VersionedRuleSchema, type VersionedRule } from "./schemas";

export class RuleVersionResolver {
  private readonly versions: VersionedRule[] = [];

  /** Load versioned rules with Zod validation. */
  load(rules: VersionedRule[]): { loaded: number; errors: string[] } {
    const errors: string[] = [];
    let loaded = 0;

    for (const rule of rules) {
      const result = VersionedRuleSchema.safeParse(rule);
      if (!result.success) {
        errors.push(`Rule "${rule.id}" v${rule.version}: ${result.error.issues.map((i) => i.message).join(", ")}`);
        continue;
      }
      this.versions.push(result.data);
      loaded++;
    }

    // Sort by id then version descending for efficient lookup
    this.versions.sort((a, b) => a.id.localeCompare(b.id) || b.version - a.version);

    return { loaded, errors };
  }

  /**
   * Resolve the effective rule version for a given date.
   * Returns the highest version whose effectiveFrom ≤ date and
   * (effectiveTo is null or effectiveTo > date).
   */
  resolve(ruleId: string, asOf?: string): VersionedRule | null {
    const date = asOf ?? new Date().toISOString();

    const candidates = this.versions.filter(
      (v) => v.id === ruleId && v.effectiveFrom <= date && (v.effectiveTo === null || v.effectiveTo > date)
    );

    return candidates.length > 0 ? candidates[0] : null; // already sorted by version desc
  }

  /** Resolve all effective rules at a given date. */
  resolveAll(asOf?: string): VersionedRule[] {
    const date = asOf ?? new Date().toISOString();
    const seen = new Set<string>();
    const result: VersionedRule[] = [];

    for (const v of this.versions) {
      if (seen.has(v.id)) continue;
      if (v.effectiveFrom <= date && (v.effectiveTo === null || v.effectiveTo > date)) {
        result.push(v);
        seen.add(v.id);
      }
    }

    return result;
  }

  /** Convert a VersionedRule to the base ComplianceRule interface. */
  static toBaseRule(v: VersionedRule): ComplianceRule {
    return {
      id: v.id,
      authority: v.authority,
      standardCode: v.standardCode,
      metric: v.metric,
      threshold: v.threshold,
      operator: v.operator,
      severity: v.severity,
      description: v.description,
    };
  }

  /** Get the full version history for a rule. */
  getHistory(ruleId: string): VersionedRule[] {
    return this.versions.filter((v) => v.id === ruleId);
  }

  /** Total number of versioned rules loaded. */
  get count(): number {
    return this.versions.length;
  }
}
