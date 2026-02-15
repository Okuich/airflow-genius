import { describe, it, expect } from "vitest";
import { RiskMatrixEngine } from "./risk-matrix-engine";
import { RiskTrendTracker } from "./risk-trend-tracker";
import { RemediationPlanner } from "./remediation-planner";
import type { ComplianceFinding } from "@/packages/types";

const SAMPLE_FINDINGS: ComplianceFinding[] = [
  { ruleId: "OSHA-PEL-1910.1000", status: "Fail", measuredValue: 65, threshold: 50, riskLevel: "Critical", recommendation: "Reduce concentration." },
  { ruleId: "ACGIH-VS-10", status: "Fail", measuredValue: 0.3, threshold: 0.5, riskLevel: "Critical", recommendation: "Increase capture velocity." },
  { ruleId: "NFPA-45-7.8b", status: "Pass", measuredValue: 0.35, threshold: 0.6, riskLevel: "Low", recommendation: "No action required." },
];

describe("RiskMatrixEngine", () => {
  const engine = new RiskMatrixEngine();

  it("builds a matrix from findings", () => {
    const result = engine.build(SAMPLE_FINDINGS);
    expect(result.entries).toHaveLength(3);
    expect(result.highRiskQuadrant.length).toBeGreaterThanOrEqual(1);
    expect(result.aggregateRisk).toBeGreaterThan(0);
  });

  it("returns empty matrix for no findings", () => {
    const result = engine.build([]);
    expect(result.entries).toHaveLength(0);
    expect(result.aggregateRisk).toBe(0);
  });
});

describe("RiskTrendTracker", () => {
  it("tracks and analyses trends", () => {
    const tracker = new RiskTrendTracker();
    tracker.record("org-1", 72, 3);
    tracker.record("org-1", 65, 2);
    tracker.record("org-1", 55, 1);

    const analysis = tracker.analyse("org-1");
    expect(analysis.trend).toBe("improving");
    expect(analysis.deltaScore).toBeLessThan(0);
    expect(analysis.points).toHaveLength(3);
  });

  it("returns stable for single point", () => {
    const tracker = new RiskTrendTracker();
    tracker.record("org-2", 50, 2);
    expect(tracker.analyse("org-2").trend).toBe("stable");
  });

  it("detects degrading trend", () => {
    const tracker = new RiskTrendTracker();
    tracker.record("org-3", 30, 1);
    tracker.record("org-3", 60, 4);
    expect(tracker.analyse("org-3").trend).toBe("degrading");
  });
});

describe("RemediationPlanner", () => {
  const planner = new RemediationPlanner();

  it("generates a prioritised plan", () => {
    const plan = planner.plan(SAMPLE_FINDINGS);
    expect(plan.priorities).toHaveLength(2); // only failures
    expect(plan.totalCost).toBe(50_000);
    expect(plan.priorities[0].costEffectiveness).toBeGreaterThan(0);
  });

  it("returns empty plan for all passing", () => {
    const plan = planner.plan([SAMPLE_FINDINGS[2]]);
    expect(plan.priorities).toHaveLength(0);
    expect(plan.totalCost).toBe(0);
  });

  it("accepts custom costs", () => {
    const custom = new RemediationPlanner({ Critical: 50_000 });
    const plan = custom.plan(SAMPLE_FINDINGS);
    expect(plan.totalCost).toBe(100_000);
  });
});
