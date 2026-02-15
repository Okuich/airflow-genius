// ─── Compliance Rules Engine ────────────────────────────────────────────────
// Evaluates simulation results against regulatory rules and standards.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceRule,
  ComplianceCheckResult,
  ComplianceSeverity,
  AirflowComplianceDomain,
} from "@/packages/types";

// ── Built-in Rule Library ──────────────────────────────────────────────────

const BUILT_IN_RULES: ComplianceRule[] = [
  // ASHRAE 62.1 — Ventilation
  { id: "ASHRAE-62.1-6.2", standard: "ASHRAE_62.1", clause: "6.2", description: "Minimum outdoor air rate for breathing zone", metric: "outdoorAirRate", threshold: 2.5, operator: "gte", unit: "L/s/person", severity: "violation", domain: "hvac" },
  { id: "ASHRAE-62.1-6.4", standard: "ASHRAE_62.1", clause: "6.4", description: "Exhaust airflow for occupied spaces", metric: "exhaustAirflow", threshold: 0.5, operator: "gte", unit: "L/s/m²", severity: "warning", domain: "hvac" },

  // ASHRAE 55 — Thermal comfort
  { id: "ASHRAE-55-5.3.1", standard: "ASHRAE_55", clause: "5.3.1", description: "Operative temperature in cooling season", metric: "operativeTemperature", threshold: 19.5, operator: "between", upperBound: 27.5, unit: "°C", severity: "warning", domain: "hvac" },
  { id: "ASHRAE-55-5.3.3", standard: "ASHRAE_55", clause: "5.3.3", description: "Air speed limit for thermal comfort", metric: "maxAirSpeed", threshold: 0.8, operator: "lte", unit: "m/s", severity: "advisory", domain: "hvac" },

  // ISO 14644 — Cleanroom
  { id: "ISO-14644-4.3", standard: "ISO_14644", clause: "4.3", description: "Air change rate for ISO 5 cleanroom", metric: "airChangeRate", threshold: 240, operator: "gte", unit: "ACH", severity: "violation", domain: "cleanroom" },
  { id: "ISO-14644-B.4", standard: "ISO_14644", clause: "B.4", description: "Unidirectional flow coverage", metric: "laminarCoverage", threshold: 0.80, operator: "gte", unit: "fraction", severity: "violation", domain: "cleanroom" },
  { id: "ISO-14644-4.4", standard: "ISO_14644", clause: "4.4", description: "Recovery time to ISO class (99% removal)", metric: "recoveryTime", threshold: 1200, operator: "lte", unit: "s", severity: "warning", domain: "cleanroom" },

  // OSHA PEL — Industrial exhaust
  { id: "OSHA-PEL-1910.1000", standard: "OSHA_PEL", clause: "1910.1000", description: "Permissible exposure limit for airborne contaminants", metric: "peakConcentration", threshold: 50, operator: "lte", unit: "ppm", severity: "violation", domain: "exhaust" },
  { id: "OSHA-Z1-T1", standard: "OSHA_PEL", clause: "Z-1 Table", description: "8-hour TWA concentration", metric: "twaConcentration", threshold: 25, operator: "lte", unit: "ppm", severity: "violation", domain: "exhaust" },

  // ACGIH TLV — Hood capture
  { id: "ACGIH-VS-10", standard: "ACGIH_TLV", clause: "VS-10", description: "Minimum hood capture velocity", metric: "captureVelocity", threshold: 0.5, operator: "gte", unit: "m/s", severity: "violation", domain: "exhaust" },

  // NFPA 45 — Fume hood
  { id: "NFPA-45-7.8", standard: "NFPA_45", clause: "7.8", description: "Fume hood face velocity range", metric: "faceVelocity", threshold: 0.4, operator: "between", upperBound: 0.6, unit: "m/s", severity: "warning", domain: "exhaust" },

  // Agriculture — ammonia
  { id: "OSHA-NH3-PEL", standard: "OSHA_PEL", clause: "1910.1000", description: "Ammonia 8-hr TWA exposure limit", metric: "ammoniaConcentration", threshold: 25, operator: "lte", unit: "ppm", severity: "violation", domain: "agriculture" },
  { id: "ACGIH-NH3-TLV", standard: "ACGIH_TLV", clause: "TLV-TWA", description: "Ammonia TLV-TWA", metric: "ammoniaConcentration", threshold: 25, operator: "lte", unit: "ppm", severity: "warning", domain: "agriculture" },

  // ASHRAE 90.4 — Data center energy
  { id: "ASHRAE-90.4-6.3", standard: "ASHRAE_90.4", clause: "6.3", description: "Maximum mechanical PUE for data center", metric: "estimatedPUE", threshold: 1.4, operator: "lte", unit: "ratio", severity: "warning", domain: "data-center" },

  // TIA 942 — Data center thermal
  { id: "TIA-942-5.3", standard: "TIA_942", clause: "5.3.4", description: "Allowable inlet temperature range", metric: "rackInletTemp", threshold: 18, operator: "between", upperBound: 27, unit: "°C", severity: "violation", domain: "data-center" },

  // NEBS — Telco equipment
  { id: "NEBS-GR3028-3.1", standard: "NEBS_GR_3028", clause: "3.1", description: "Equipment inlet temperature limit", metric: "rackInletTemp", threshold: 40, operator: "lte", unit: "°C", severity: "violation", domain: "data-center" },
];

// ── Engine ─────────────────────────────────────────────────────────────────

export class ComplianceRulesEngine {
  private readonly rules: ComplianceRule[];

  constructor(customRules?: ComplianceRule[]) {
    this.rules = [...BUILT_IN_RULES, ...(customRules ?? [])];
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
      if (value === undefined) continue; // metric not provided

      const passed = this.checkRule(rule, value);
      results.push({
        ruleId: rule.id,
        rule,
        actualValue: value,
        passed,
        severity: passed ? "pass" : rule.severity,
        detail: this.formatDetail(rule, value, passed),
        remediation: passed ? null : this.suggestRemediation(rule, value),
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

  private suggestRemediation(rule: ComplianceRule, value: number): string {
    const gap = Math.abs(value - rule.threshold);
    const pct = rule.threshold > 0 ? ((gap / rule.threshold) * 100).toFixed(0) : "N/A";

    const remediations: Record<string, string> = {
      outdoorAirRate: `Increase outdoor air supply by at least ${pct}% to meet ${rule.standard} §${rule.clause}.`,
      captureVelocity: `Increase exhaust fan capacity or reduce hood opening area. Current deficit: ${gap.toFixed(2)} m/s.`,
      airChangeRate: `Increase HEPA supply to achieve at least ${rule.threshold} ACH. Consider adding fan filter units.`,
      laminarCoverage: `Improve unidirectional flow coverage by reducing obstructions and optimising diffuser placement.`,
      ammoniaConcentration: `Increase ventilation rate or reduce ammonia source. Current level ${pct}% above limit.`,
      estimatedPUE: `Reduce cooling overhead — optimise containment, raise supply temperature, or use economiser modes.`,
      rackInletTemp: `Adjust CRAC supply temperature or improve airflow containment to bring inlet temp within range.`,
      peakConcentration: `Improve capture efficiency or reduce source emission rate. Peak exceeds PEL by ${pct}%.`,
    };

    return remediations[rule.metric] ?? `Adjust ${rule.metric} to meet ${rule.standard} §${rule.clause} (gap: ${gap.toFixed(2)} ${rule.unit}).`;
  }
}
