import { describe, it, expect } from "vitest";
import {
  STANDARD_CATALOG,
  RULE_LIBRARY,
  RULE_DOMAIN_MAP,
  METRIC_STANDARD_LINKS,
  REMEDIATION_TEMPLATES,
  getStandardsForMetric,
  getMetricsForStandard,
  resolveRemediation,
  getComplianceKnowledgeBundle,
} from "./index";

describe("compliance-knowledge", () => {
  describe("STANDARD_CATALOG", () => {
    it("contains all 10 standards", () => {
      expect(STANDARD_CATALOG).toHaveLength(10);
    });

    it("each standard has at least one clause", () => {
      for (const std of STANDARD_CATALOG) {
        expect(std.clauses.length).toBeGreaterThan(0);
      }
    });

    it("each standard has authority assigned", () => {
      for (const std of STANDARD_CATALOG) {
        expect(["ASHRAE", "ISO", "OSHA", "EPA"]).toContain(std.authority);
      }
    });

    it("ASHRAE 62.1 has ventilation clauses", () => {
      const ashrae = STANDARD_CATALOG.find((s) => s.standard === "ASHRAE_62.1")!;
      expect(ashrae.clauses.map((c) => c.clauseId)).toContain("6.2");
    });
  });

  describe("RULE_LIBRARY", () => {
    it("contains at least 15 rules", () => {
      expect(RULE_LIBRARY.length).toBeGreaterThanOrEqual(15);
    });

    it("every rule has a valid operator", () => {
      const ops = [">", "<", ">=", "<="];
      for (const rule of RULE_LIBRARY) {
        expect(ops).toContain(rule.operator);
      }
    });

    it("every rule has a valid severity", () => {
      const sev = ["Low", "Medium", "High", "Critical"];
      for (const rule of RULE_LIBRARY) {
        expect(sev).toContain(rule.severity);
      }
    });

    it("every rule has a valid authority", () => {
      const auth = ["ASHRAE", "ISO", "OSHA", "EPA"];
      for (const rule of RULE_LIBRARY) {
        expect(auth).toContain(rule.authority);
      }
    });

    it("every rule has a domain mapping", () => {
      for (const rule of RULE_LIBRARY) {
        expect(RULE_DOMAIN_MAP[rule.id]).toBeDefined();
      }
    });
  });

  describe("METRIC_STANDARD_LINKS", () => {
    it("contains links for all key metrics", () => {
      const metrics = METRIC_STANDARD_LINKS.map((l) => l.metric);
      expect(metrics).toContain("captureVelocity");
      expect(metrics).toContain("estimatedPUE");
      expect(metrics).toContain("ammoniaConcentration");
    });

    it("getStandardsForMetric returns correct standards", () => {
      const link = getStandardsForMetric("rackInletTemp");
      expect(link).toBeDefined();
      expect(link!.standards).toContain("TIA_942");
      expect(link!.standards).toContain("NEBS_GR_3028");
    });

    it("getMetricsForStandard returns correct metrics", () => {
      const metrics = getMetricsForStandard("ISO_14644");
      expect(metrics).toContain("airChangeRate");
      expect(metrics).toContain("laminarCoverage");
      expect(metrics).toContain("recoveryTime");
    });

    it("returns undefined for unknown metric", () => {
      expect(getStandardsForMetric("unknownMetric")).toBeUndefined();
    });
  });

  describe("REMEDIATION_TEMPLATES", () => {
    it("has a template for every metric in the rule library", () => {
      const ruleMetrics = [...new Set(RULE_LIBRARY.map((r) => r.metric))];
      const templateMetrics = REMEDIATION_TEMPLATES.map((t) => t.metric);
      for (const metric of ruleMetrics) {
        expect(templateMetrics).toContain(metric);
      }
    });

    it("resolveRemediation fills placeholders", () => {
      const result = resolveRemediation("captureVelocity", {
        gap: 0.3,
        pct: "60",
        standardCode: "OSHA ACGIH VS-10",
        threshold: 0.5,
      });
      expect(result).toContain("0.30");
      expect(result).toContain("m/s");
    });

    it("resolveRemediation returns fallback for unknown metric", () => {
      const result = resolveRemediation("unknownMetric", {
        gap: 1,
        pct: "10",
        standardCode: "X §1",
        threshold: 5,
      });
      expect(result).toContain("unknownMetric");
    });
  });

  describe("getComplianceKnowledgeBundle", () => {
    it("returns all four knowledge sections", () => {
      const bundle = getComplianceKnowledgeBundle();
      expect(bundle.standards.length).toBeGreaterThan(0);
      expect(bundle.rules.length).toBeGreaterThan(0);
      expect(bundle.metricLinks.length).toBeGreaterThan(0);
      expect(bundle.remediationTemplates.length).toBeGreaterThan(0);
    });
  });
});
