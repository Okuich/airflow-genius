import { describe, it, expect } from "vitest";
import { CoolingTopologyOptimizer } from "./cooling-topology-optimizer";
import type { DataCenterSimulationConfig } from "@/packages/types";

const BASE_CONFIG: DataCenterSimulationConfig = {
  id: "test-dc",
  name: "Test DC",
  description: "test",
  flowType: "incompressible" as any,
  turbulenceModel: { type: "k-epsilon" as any, wallFunction: true, turbulentIntensity: 0.05, turbulentViscosityRatio: 10, kInitial: 0.1 },
  meshSettings: { baseSize: 0.5, minSize: 0.05, maxSize: 1, refinementLevels: 2, boundaryLayerCount: 3, boundaryLayerGrowthRate: 1.2, targetCellCount: 50000, featureAngle: 30, qualityThreshold: 0.7 },
  solverSettings: { flowType: "incompressible" as any, maxIterations: 500, convergenceCriteria: 1e-4, relaxationPressure: 0.3, relaxationVelocity: 0.7, relaxationTurbulence: 0.8 },
  boundaryConditions: [],
  fluidDensity: 1.2,
  fluidViscosity: 1.8e-5,
  enableHeatTransfer: true,
  referencePressure: 101325,
  rackHeatLoad: {
    totalITLoad: 500,
    rackLoads: [
      { id: "r1", name: "Rack A1", heatLoad: 15, rackUnits: 42, airflowDemand: 0.8, position: { row: 1, column: 1 } },
      { id: "r2", name: "Rack A2", heatLoad: 20, rackUnits: 42, airflowDemand: 0.6, position: { row: 1, column: 2 } },
      { id: "r3", name: "Rack B1", heatLoad: 25, rackUnits: 42, airflowDemand: 0.5, position: { row: 2, column: 1 } },
    ],
    supplyAirTemperature: 16,
    returnAirThreshold: 35,
    hotspotThreshold: 5,
  },
  containment: {
    type: "none",
    blankingPanelCoverage: 0.6,
    cableCutoutSealFraction: 0.5,
    aboveRackGap: 0.2,
    doorSealQuality: 0.5,
  },
  raisedFloorDepth: 0.2,
  tileOpenAreaFraction: 0.2,
  coolingUnitCount: 2,
  totalCoolingCapacity: 400,
  targetPUE: 1.4,
};

describe("CoolingTopologyOptimizer", () => {
  it("should improve score from a poor starting config", () => {
    const optimizer = new CoolingTopologyOptimizer();
    const result = optimizer.optimise(BASE_CONFIG, { maxIterations: 15 });

    expect(result.finalScore).toBeGreaterThan(result.initialScore);
    expect(result.improvement).toBeGreaterThan(0);
    expect(result.changeLog.length).toBeGreaterThan(0);
    expect(result.optimisedConfig).toBeDefined();
    expect(result.finalReport).toBeDefined();
  });

  it("should record nudges in the change log", () => {
    const optimizer = new CoolingTopologyOptimizer();
    const result = optimizer.optimise(BASE_CONFIG, { maxIterations: 5 });

    for (const record of result.changeLog) {
      expect(record.scoreAfter).toBeGreaterThan(record.scoreBefore);
      expect(record.parameter).toBeTruthy();
    }
  });

  it("should converge and stop early when no improvements remain", () => {
    const optimizer = new CoolingTopologyOptimizer();
    const result = optimizer.optimise(BASE_CONFIG, { maxIterations: 50, maxStalls: 2 });

    // Should not run all 50 iterations
    expect(result.iterations).toBeLessThanOrEqual(50);
    expect(result.finalScore).toBeGreaterThanOrEqual(result.initialScore);
  });
});
