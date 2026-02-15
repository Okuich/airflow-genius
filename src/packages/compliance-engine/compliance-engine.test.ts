import { describe, it, expect } from "vitest";
import { ComplianceOrchestrator } from "./compliance-orchestrator";
import { ComplianceRulesEngine } from "./compliance-rules-engine";
import { StandardMappingEngine } from "./standard-mapping-engine";
import { RiskScoringEngine } from "./risk-scoring-engine";
import { AuditDocumentGenerator } from "./audit-doc-generator";

describe("compliance-engine", () => {
  describe("ComplianceRulesEngine", () => {
    const engine = new ComplianceRulesEngine();

    it("returns rules filtered by domain", () => {
      const hvac = engine.getRules("hvac");
      expect(hvac.length).toBeGreaterThan(0);
      const cleanroom = engine.getRules("cleanroom");
      expect(cleanroom.length).toBeGreaterThan(0);
      expect(hvac.length).not.toBe(cleanroom.length);
    });

    it("evaluates passing metrics correctly", () => {
      const results = engine.evaluate({ outdoorAirRate: 5.0 }, "hvac");
      const oar = results.find((r) => r.ruleId === "ASHRAE-62.1-6.2");
      expect(oar?.passed).toBe(true);
      expect(oar?.severity).toBe("pass");
    });

    it("evaluates failing metrics with remediation", () => {
      const results = engine.evaluate({ captureVelocity: 0.2 }, "exhaust");
      const cv = results.find((r) => r.ruleId === "ACGIH-VS-10");
      expect(cv?.passed).toBe(false);
      expect(cv?.severity).toBe("Critical");
      expect(cv?.remediation).toBeTruthy();
    });
  });

  describe("StandardMappingEngine", () => {
    const mapper = new StandardMappingEngine();

    it("maps HVAC domain to ASHRAE standards", () => {
      const mappings = mapper.mapStandards("hvac");
      const standards = mappings.map((m) => m.standard);
      expect(standards).toContain("ASHRAE_62.1");
      expect(standards).toContain("ASHRAE_55");
    });

    it("identifies standards from metric names", () => {
      const standards = mapper.identifyFromMetrics(["rackInletTemp", "estimatedPUE"]);
      expect(standards).toContain("TIA_942");
      expect(standards).toContain("ASHRAE_90.4");
    });
  });

  describe("RiskScoringEngine", () => {
    const scorer = new RiskScoringEngine();
    const engine = new ComplianceRulesEngine();

    it("returns low risk for all-passing results", () => {
      const results = engine.evaluate({ outdoorAirRate: 5.0, operativeTemperature: 23 }, "hvac");
      const report = scorer.computeRisk(results);
      expect(report.riskLevel).toBe("low");
      expect(report.overallRiskScore).toBe(0);
    });

    it("returns elevated risk for critical failures", () => {
      const results = engine.evaluate({ captureVelocity: 0.1, peakConcentration: 80 }, "exhaust");
      const report = scorer.computeRisk(results);
      expect(report.overallRiskScore).toBeGreaterThan(0);
      expect(report.topRisks.length).toBeGreaterThan(0);
    });
  });

  describe("AuditDocumentGenerator", () => {
    const gen = new AuditDocumentGenerator();
    const engine = new ComplianceRulesEngine();
    const mapper = new StandardMappingEngine();
    const scorer = new RiskScoringEngine();

    it("generates compliant audit doc for passing results", () => {
      const checks = engine.evaluate({ outdoorAirRate: 5.0 }, "hvac");
      const mappings = mapper.mapStandards("hvac");
      const risk = scorer.computeRisk(checks);
      const doc = gen.generate({
        simulationId: "sim-t1",
        organizationId: "org-t1",
        checkResults: checks,
        standardMappings: mappings,
        riskReport: risk,
      });
      expect(doc.overallVerdict).toBe("compliant");
      expect(doc.findings).toHaveLength(0);
    });
  });

  describe("ComplianceOrchestrator", () => {
    const orchestrator = new ComplianceOrchestrator();

    it("runs full pipeline for HVAC domain", () => {
      const result = orchestrator.run({
        simulationId: "sim-001",
        organizationId: "org-001",
        domain: "hvac",
        metrics: { outdoorAirRate: 5.0, exhaustAirflow: 1.0, operativeTemperature: 23.0, maxAirSpeed: 0.3 },
      });
      expect(result.checkResults.every((c) => c.passed)).toBe(true);
      expect(result.auditDocument.overallVerdict).toBe("compliant");
    });

    it("flags violations for failing exhaust metrics", () => {
      const result = orchestrator.run({
        simulationId: "sim-002",
        organizationId: "org-001",
        domain: "exhaust",
        metrics: { captureVelocity: 0.2, peakConcentration: 80 },
      });
      expect(result.auditDocument.overallVerdict).toBe("non_compliant");
    });
  });
});
