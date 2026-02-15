import { describe, it, expect } from "vitest";
import { ComplianceRiskEngine, type HistoricalSnapshot } from "./compliance-risk-engine";
import type { ComplianceFinding } from "@/packages/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

const PASS: ComplianceFinding = {
  ruleId: "ASHRAE-62.1-6.2",
  status: "Pass",
  measuredValue: 3.0,
  threshold: 2.5,
  riskLevel: "Low",
  recommendation: "No action required.",
};

const FAIL_MEDIUM: ComplianceFinding = {
  ruleId: "ASHRAE-62.1-6.4",
  status: "Fail",
  measuredValue: 0.3,
  threshold: 0.5,
  riskLevel: "Medium",
  recommendation: "Increase exhaust rate.",
};

const FAIL_CRITICAL: ComplianceFinding = {
  ruleId: "OSHA-PEL-1910.1000",
  status: "Fail",
  measuredValue: 65,
  threshold: 50,
  riskLevel: "Critical",
  recommendation: "Improve capture efficiency or reduce source emission rate. Peak exceeds PEL.",
};

const FAIL_HIGH: ComplianceFinding = {
  ruleId: "ISO-14644-B.4",
  status: "Fail",
  measuredValue: 0.6,
  threshold: 0.8,
  riskLevel: "High",
  recommendation: "Improve unidirectional flow coverage.",
};

const HISTORY: HistoricalSnapshot[] = [
  {
    evaluatedAt: "2025-12-01T00:00:00.000Z",
    overallScore: 40,
    violationCount: 2,
    failedRuleIds: ["OSHA-PEL-1910.1000", "ASHRAE-62.1-6.4"],
  },
  {
    evaluatedAt: "2025-06-01T00:00:00.000Z",
    overallScore: 30,
    violationCount: 1,
    failedRuleIds: ["OSHA-PEL-1910.1000"],
  },
];

// ── Tests ───────────────────────────────────────────────────────────────────

describe("ComplianceRiskEngine", () => {
  it("returns zero risk for no findings", () => {
    const engine = new ComplianceRiskEngine();
    const report = engine.computeRisk([]);
    expect(report).toEqual({
      overallScore: 0,
      highRiskCount: 0,
      projectedRemediationCost: 0,
      complianceProbability: 1,
    });
  });

  it("returns zero risk for all-pass findings", () => {
    const engine = new ComplianceRiskEngine();
    const report = engine.computeRisk([PASS]);
    expect(report.overallScore).toBe(0);
    expect(report.highRiskCount).toBe(0);
    expect(report.projectedRemediationCost).toBe(0);
    expect(report.complianceProbability).toBeGreaterThan(0);
  });

  it("computes weighted risk score for mixed findings", () => {
    const engine = new ComplianceRiskEngine();
    const report = engine.computeRisk([PASS, FAIL_MEDIUM, FAIL_CRITICAL]);
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.highRiskCount).toBe(1); // only FAIL_CRITICAL
    expect(report.projectedRemediationCost).toBe(2_500 + 25_000);
  });

  it("applies repeat violation multiplier from history", () => {
    const engine = new ComplianceRiskEngine();
    const withoutHistory = engine.computeRisk([FAIL_CRITICAL]);
    const withHistory = engine.computeRisk([FAIL_CRITICAL], HISTORY);

    // Repeat violation should increase the score
    expect(withHistory.overallScore).toBeGreaterThanOrEqual(withoutHistory.overallScore);
    // Repeat remediation cost should be higher
    expect(withHistory.projectedRemediationCost).toBeGreaterThan(withoutHistory.projectedRemediationCost);
  });

  it("applies escalation multiplier when violations increase", () => {
    const engine = new ComplianceRiskEngine();
    // 3 failures > latest history violationCount of 2 → escalation
    const findings = [FAIL_MEDIUM, FAIL_CRITICAL, FAIL_HIGH];
    const report = engine.computeRisk(findings, HISTORY);

    // Should produce a higher score than without history
    const baseline = engine.computeRisk(findings);
    expect(report.overallScore).toBeGreaterThanOrEqual(baseline.overallScore);
  });

  it("respects custom weight configuration", () => {
    const heavy = new ComplianceRiskEngine({ weights: { Low: 1, Medium: 10, High: 10, Critical: 10 } });
    const light = new ComplianceRiskEngine({ weights: { Low: 1, Medium: 2, High: 3, Critical: 10 } });

    // With Critical max the same but Medium weight higher in heavy → higher score
    const heavyReport = heavy.computeRisk([PASS, FAIL_MEDIUM]);
    const lightReport = light.computeRisk([PASS, FAIL_MEDIUM]);

    expect(heavyReport.overallScore).toBeGreaterThan(lightReport.overallScore);
  });

  it("respects custom remediation cost configuration", () => {
    const engine = new ComplianceRiskEngine({ costs: { Low: 100, Medium: 200, High: 300, Critical: 400 } });
    const report = engine.computeRisk([FAIL_MEDIUM, FAIL_CRITICAL]);
    expect(report.projectedRemediationCost).toBe(200 + 400);
  });

  it("computes risk breakdown by category", () => {
    const engine = new ComplianceRiskEngine();
    const breakdown = engine.computeBreakdown([PASS, FAIL_MEDIUM, FAIL_CRITICAL, FAIL_HIGH]);

    expect(breakdown).toHaveLength(4);
    const regulatory = breakdown.find((b) => b.category === "regulatory");
    expect(regulatory).toBeDefined();
    expect(regulatory!.findingCount).toBeGreaterThan(0);
  });

  it("calculates severity multiplier for a finding", () => {
    const engine = new ComplianceRiskEngine();

    const noHistory = engine.getSeverityMultiplier(FAIL_CRITICAL);
    expect(noHistory).toBe(1);

    const withRepeat = engine.getSeverityMultiplier(FAIL_CRITICAL, HISTORY);
    expect(withRepeat).toBeGreaterThan(1);
  });

  it("caps overall score at 100", () => {
    const engine = new ComplianceRiskEngine({
      weights: { Low: 100, Medium: 100, High: 100, Critical: 100 },
      repeatViolationMultiplier: 5,
      escalationMultiplier: 5,
    });
    const report = engine.computeRisk(
      [FAIL_MEDIUM, FAIL_CRITICAL, FAIL_HIGH],
      HISTORY
    );
    expect(report.overallScore).toBeLessThanOrEqual(100);
  });

  it("enforces compliance probability floor", () => {
    const engine = new ComplianceRiskEngine({ complianceProbabilityFloor: 0.05 });
    const report = engine.computeRisk([FAIL_CRITICAL, FAIL_HIGH, FAIL_MEDIUM]);
    expect(report.complianceProbability).toBeGreaterThanOrEqual(0.05);
  });
});
