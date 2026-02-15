import { describe, it, expect } from "vitest";
import { ComplianceOrchestrator } from "@/packages/compliance-engine";

describe("ComplianceOrchestrator", () => {
  const orchestrator = new ComplianceOrchestrator();

  it("runs full pipeline for HVAC domain and returns compliant verdict when all metrics pass", () => {
    const result = orchestrator.run({
      simulationId: "sim-001",
      organizationId: "org-001",
      domain: "hvac",
      metrics: {
        outdoorAirRate: 5.0,
        exhaustAirflow: 1.0,
        operativeTemperature: 23.0,
        maxAirSpeed: 0.3,
      },
    });

    expect(result.simulationId).toBe("sim-001");
    expect(result.checkResults.length).toBeGreaterThan(0);
    expect(result.checkResults.every((c) => c.passed)).toBe(true);
    expect(result.riskReport.riskLevel).toBe("low");
    expect(result.auditDocument.overallVerdict).toBe("compliant");
    expect(result.standardMappings.length).toBeGreaterThan(0);
  });

  it("flags violations for failing exhaust metrics", () => {
    const result = orchestrator.run({
      simulationId: "sim-002",
      organizationId: "org-001",
      domain: "exhaust",
      metrics: {
        captureVelocity: 0.2,
        peakConcentration: 80,
        twaConcentration: 10,
        faceVelocity: 0.5,
      },
    });

    const failures = result.checkResults.filter((c) => !c.passed);
    expect(failures.length).toBeGreaterThan(0);
    expect(result.auditDocument.overallVerdict).toBe("non_compliant");
    expect(result.auditDocument.findings.length).toBeGreaterThan(0);
    expect(result.riskReport.topRisks.length).toBeGreaterThan(0);
  });

  it("handles data-center domain with PUE and thermal checks", () => {
    const result = orchestrator.run({
      simulationId: "sim-003",
      organizationId: "org-002",
      domain: "data-center",
      metrics: {
        estimatedPUE: 1.7,
        rackInletTemp: 30,
      },
    });

    expect(result.checkResults.some((c) => !c.passed)).toBe(true);
    expect(result.auditDocument.overallVerdict).not.toBe("compliant");
  });

  it("produces conditionally compliant for only low-severity findings", () => {
    const result = orchestrator.run({
      simulationId: "sim-004",
      organizationId: "org-001",
      domain: "hvac",
      metrics: {
        outdoorAirRate: 5.0,
        exhaustAirflow: 1.0,
        operativeTemperature: 23.0,
        maxAirSpeed: 1.0, // exceeds 0.8 — Low severity
      },
    });

    expect(result.auditDocument.overallVerdict).toBe("conditionally_compliant");
  });

  it("includes remediation in findings for critical issues", () => {
    const result = orchestrator.run({
      simulationId: "sim-005",
      organizationId: "org-001",
      domain: "cleanroom",
      metrics: {
        airChangeRate: 100, // below 240 requirement
        laminarCoverage: 0.6, // below 0.80
      },
    });

    for (const finding of result.auditDocument.findings) {
      expect(finding.remediation).toBeTruthy();
    }
  });
});
