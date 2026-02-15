// ─── Compliance Engine ──────────────────────────────────────────────────────
// Unified engine: load rules, evaluate simulation metrics, return findings.
// Features: Zod validation, rule versioning, audit logging.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceRule,
  ComplianceFinding,
  AirflowComplianceDomain,
} from "@/packages/types";
import { RULE_LIBRARY, RULE_DOMAIN_MAP, resolveRemediation } from "@/packages/compliance-knowledge";
import {
  EvaluationRequestSchema,
  type EvaluationRequest,
  type ValidatedFinding,
  type VersionedRule,
} from "./schemas";
import { ComplianceAuditLogger } from "./audit-logger";
import { RuleVersionResolver } from "./rule-version-resolver";

// ── Config ──────────────────────────────────────────────────────────────────

export interface ComplianceEngineConfig {
  /** Custom static rules to merge with RULE_LIBRARY. */
  customRules?: ComplianceRule[];
  /** Versioned rules (takes priority when effective date is set). */
  versionedRules?: VersionedRule[];
  /** Enable audit logging (default: true). */
  enableAuditLog?: boolean;
  /** Max audit log entries (default: 10 000). */
  maxAuditEntries?: number;
}

// ── Engine ──────────────────────────────────────────────────────────────────

export class ComplianceEngine {
  private readonly staticRules: ComplianceRule[];
  private readonly versionResolver: RuleVersionResolver;
  readonly auditLog: ComplianceAuditLogger;
  private readonly auditEnabled: boolean;

  constructor(config?: ComplianceEngineConfig) {
    this.staticRules = [...RULE_LIBRARY, ...(config?.customRules ?? [])];
    this.versionResolver = new RuleVersionResolver();
    this.auditEnabled = config?.enableAuditLog !== false;
    this.auditLog = new ComplianceAuditLogger(config?.maxAuditEntries);

    if (config?.versionedRules?.length) {
      const { loaded, errors } = this.versionResolver.load(config.versionedRules);
      this.log("rules_loaded", {
        versionedRulesLoaded: loaded,
        staticRulesLoaded: this.staticRules.length,
        validationErrors: errors,
      });
    } else {
      this.log("rules_loaded", { staticRulesLoaded: this.staticRules.length, versionedRulesLoaded: 0 });
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Load additional rules at runtime.
   * Returns count of successfully loaded rules and any validation errors.
   */
  loadRules(rules: ComplianceRule[]): { loaded: number; errors: string[] } {
    const errors: string[] = [];
    let loaded = 0;

    for (const rule of rules) {
      if (!rule.id || !rule.metric || rule.threshold === undefined) {
        errors.push(`Invalid rule: missing required fields (id=${rule.id})`);
        continue;
      }
      this.staticRules.push(rule);
      loaded++;
    }

    this.log("rules_loaded", { additionalRulesLoaded: loaded, validationErrors: errors });
    return { loaded, errors };
  }

  /**
   * Load versioned rules for date-based resolution.
   */
  loadVersionedRules(rules: VersionedRule[]): { loaded: number; errors: string[] } {
    const result = this.versionResolver.load(rules);
    this.log("rules_loaded", { versionedRulesLoaded: result.loaded, validationErrors: result.errors });
    return result;
  }

  /**
   * Evaluate simulation metrics against compliance rules.
   * Input is validated with Zod before processing.
   */
  evaluate(request: EvaluationRequest): ValidatedFinding[] {
    // ── Validate input ────────────────────────────────────────────────────
    const parsed = EvaluationRequestSchema.safeParse(request);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      this.log("validation_error", { input: request, errors: msg });
      throw new Error(`Validation failed: ${msg}`);
    }

    const req = parsed.data;
    const ctx = { simulationId: req.simulationId, organizationId: req.organizationId };

    this.log("evaluation_started", {
      domain: req.domain,
      metricCount: Object.keys(req.metrics).length,
      region: req.region ?? null,
      industry: req.industry ?? null,
      effectiveDate: req.effectiveDate ?? null,
    }, ctx);

    // ── Resolve rules ─────────────────────────────────────────────────────
    const rules = this.resolveRules(req.domain, req.effectiveDate);

    this.log("rules_version_resolved", {
      totalRules: rules.length,
      effectiveDate: req.effectiveDate ?? "current",
    }, ctx);

    // ── Evaluate ──────────────────────────────────────────────────────────
    const findings: ValidatedFinding[] = [];

    for (const { rule, version } of rules) {
      const value = req.metrics[rule.metric];
      if (value === undefined) {
        this.log("rule_skipped", { ruleId: rule.id, reason: "metric_not_present", metric: rule.metric }, ctx);
        continue;
      }

      const passed = this.checkRule(rule, value);

      this.log("rule_matched", {
        ruleId: rule.id,
        ruleVersion: version ?? undefined,
        metric: rule.metric,
        value,
        threshold: rule.threshold,
        operator: rule.operator,
        passed,
      }, ctx);

      findings.push({
        ruleId: rule.id,
        ruleVersion: version ?? undefined,
        status: passed ? "Pass" : "Fail",
        measuredValue: value,
        threshold: rule.threshold,
        riskLevel: passed ? "Low" : rule.severity,
        recommendation: passed
          ? "No action required."
          : this.buildRecommendation(rule, value),
      });
    }

    this.log("evaluation_completed", {
      totalFindings: findings.length,
      violations: findings.filter((f) => f.status === "Fail").length,
      passes: findings.filter((f) => f.status === "Pass").length,
    }, ctx);

    return findings;
  }

  /**
   * Get all rules applicable to a domain (with optional date resolution).
   */
  getRules(domain?: AirflowComplianceDomain, asOf?: string): ComplianceRule[] {
    return this.resolveRules(domain ?? "general", asOf).map((r) => r.rule);
  }

  /**
   * Get the rule version resolver for advanced queries.
   */
  get versions(): RuleVersionResolver {
    return this.versionResolver;
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private resolveRules(
    domain: AirflowComplianceDomain,
    asOf?: string
  ): { rule: ComplianceRule; version: number | null }[] {
    // Try versioned rules first
    const versioned = this.versionResolver.resolveAll(asOf);
    const versionedIds = new Set(versioned.map((v) => v.id));

    const result: { rule: ComplianceRule; version: number | null }[] = [];

    // Add versioned rules that match domain
    for (const v of versioned) {
      const ruleDomain = RULE_DOMAIN_MAP[v.id];
      if (ruleDomain === domain || ruleDomain === "general" || domain === "general") {
        result.push({ rule: RuleVersionResolver.toBaseRule(v), version: v.version });
      }
    }

    // Add static rules not superseded by versioned rules
    for (const rule of this.staticRules) {
      if (versionedIds.has(rule.id)) continue;
      const ruleDomain = RULE_DOMAIN_MAP[rule.id];
      if (ruleDomain === domain || ruleDomain === "general" || domain === "general") {
        result.push({ rule, version: null });
      }
    }

    return result;
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

  private log(
    action: Parameters<ComplianceAuditLogger["record"]>[0],
    details: Record<string, unknown>,
    context?: { simulationId?: string; organizationId?: string }
  ): void {
    if (this.auditEnabled) {
      this.auditLog.record(action, details, context);
    }
  }
}
