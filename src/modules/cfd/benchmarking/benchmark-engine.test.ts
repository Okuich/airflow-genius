import { describe, it, expect, beforeEach } from "vitest";
import {
  BenchmarkEngine,
  type BenchmarkEntry,
  type GeometryCluster,
} from "./benchmark-engine";
import type {
  SimulationConfig,
  FeatureVector,
  MeshStats,
} from "@/packages/types";
import { FlowType, TurbulenceType, BoundaryType } from "@/packages/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<SimulationConfig>): SimulationConfig {
  return {
    id: "sim-1",
    name: "Test",
    description: "",
    flowType: FlowType.Steady,
    turbulenceModel: {
      type: TurbulenceType.KEpsilon,
      wallFunction: true,
      turbulentIntensity: 0.05,
      turbulentViscosityRatio: 10,
      kInitial: 0.1,
      epsilonInitial: 0.01,
    },
    meshSettings: {
      baseSize: 0.01, minSize: 0.001, maxSize: 0.1, refinementLevels: 3,
      boundaryLayerCount: 5, boundaryLayerGrowthRate: 1.2,
      targetCellCount: 500000, featureAngle: 30, qualityThreshold: 0.7,
    },
    solverSettings: {
      flowType: FlowType.Steady, maxIterations: 2000,
      convergenceCriteria: 1e-6, relaxationPressure: 0.3,
      relaxationVelocity: 0.7, relaxationTurbulence: 0.8,
    },
    boundaryConditions: [
      { id: "bc-1", name: "Inlet", type: BoundaryType.VelocityInlet, surfaceIds: ["s1"], velocity: { x: 10, y: 0, z: 0 } },
      { id: "bc-2", name: "Outlet", type: BoundaryType.PressureOutlet, surfaceIds: ["s2"], pressure: 0 },
      { id: "bc-3", name: "Wall", type: BoundaryType.Wall, surfaceIds: ["s3"] },
      { id: "bc-4", name: "Wall2", type: BoundaryType.Wall, surfaceIds: ["s4"] },
      { id: "bc-5", name: "Wall3", type: BoundaryType.Wall, surfaceIds: ["s5"] },
    ],
    fluidDensity: 1.225,
    fluidViscosity: 1.7894e-5,
    enableHeatTransfer: false,
    referencePressure: 101325,
    ...overrides,
  };
}

function makeFeatures(overrides?: Partial<FeatureVector>): FeatureVector {
  return {
    reynoldsNumber: 50000,
    turbulenceIntensity: 0.05,
    pressureDrop: 245,
    efficiency: 0.67,
    meshQualityScore: 0.85,
    convergenceSpeed: 0.7,
    ...overrides,
  };
}

function makeMeshStats(): MeshStats {
  return {
    cellCount: 500000, avgOrthogonality: 0.85, maxSkewness: 0.4,
    maxAspectRatio: 15, minVolume: 1e-12, nonOrthogonalCellPercent: 5, avgYPlus: 35,
  };
}

function makeEntry(i: number, overrides?: Partial<BenchmarkEntry>): BenchmarkEntry {
  return {
    id: `entry-${i}`,
    organizationId: "org-anon",
    config: makeConfig(),
    features: makeFeatures({
      efficiency: 0.3 + (i / 20) * 0.6,
      convergenceSpeed: 0.2 + (i / 20) * 0.7,
      meshQualityScore: 0.5 + (i / 20) * 0.4,
      pressureDrop: 100 + i * 50,
    }),
    meshStats: makeMeshStats(),
    pressureDrop: 100 + i * 50,
    efficiencyRating: "Good",
    converged: true,
    totalIterations: 500 + i * 50,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("BenchmarkEngine", () => {
  let engine: BenchmarkEngine;

  beforeEach(() => {
    engine = new BenchmarkEngine();
    // Load 20 internal-flow entries
    for (let i = 0; i < 20; i++) engine.addEntry(makeEntry(i));
  });

  // ── Geometry Clustering ───────────────────────────────────────────

  describe("classifyGeometry", () => {
    it("classifies internal flow (high wall ratio)", () => {
      expect(engine.classifyGeometry(makeConfig())).toBe("internal-flow");
    });

    it("classifies rotating machinery", () => {
      const config = makeConfig({
        rotatingFrame: { enabled: true, rotationSpeed: 1500, rotationAxis: { x: 0, y: 0, z: 1 }, origin: { x: 0, y: 0, z: 0 }, zoneId: "z1" },
      });
      expect(engine.classifyGeometry(config)).toBe("rotating-machinery");
    });

    it("classifies external flow with symmetry", () => {
      const config = makeConfig({
        boundaryConditions: [
          { id: "1", name: "Inlet", type: BoundaryType.VelocityInlet, surfaceIds: ["s1"], velocity: { x: 10, y: 0, z: 0 } },
          { id: "2", name: "Outlet", type: BoundaryType.PressureOutlet, surfaceIds: ["s2"], pressure: 0 },
          { id: "3", name: "Sym", type: BoundaryType.Symmetry, surfaceIds: ["s3"] },
        ],
      });
      expect(engine.classifyGeometry(config)).toBe("external-flow");
    });

    it("classifies heat exchanger", () => {
      const config = makeConfig({
        enableHeatTransfer: true,
        boundaryConditions: [
          { id: "1", name: "Hot In", type: BoundaryType.VelocityInlet, surfaceIds: ["s1"], velocity: { x: 5, y: 0, z: 0 } },
          { id: "2", name: "Cold In", type: BoundaryType.VelocityInlet, surfaceIds: ["s2"], velocity: { x: 3, y: 0, z: 0 } },
          { id: "3", name: "Out", type: BoundaryType.PressureOutlet, surfaceIds: ["s3"], pressure: 0 },
        ],
      });
      expect(engine.classifyGeometry(config)).toBe("heat-exchanger");
    });
  });

  // ── Percentile Rankings ───────────────────────────────────────────

  describe("report", () => {
    it("returns valid BenchmarkReport shape", () => {
      const r = engine.report(makeConfig(), makeFeatures());
      expect(r).toHaveProperty("percentileRank");
      expect(r).toHaveProperty("industryAverage");
      expect(r).toHaveProperty("improvementPotential");
    });

    it("percentile is between 0 and 100", () => {
      const r = engine.report(makeConfig(), makeFeatures());
      expect(r.percentileRank).toBeGreaterThanOrEqual(0);
      expect(r.percentileRank).toBeLessThanOrEqual(100);
    });

    it("top performer gets high percentile", () => {
      const top = makeFeatures({ efficiency: 1, convergenceSpeed: 1, meshQualityScore: 1, pressureDrop: 10 });
      const r = engine.report(makeConfig(), top);
      expect(r.percentileRank).toBeGreaterThanOrEqual(80);
    });

    it("poor performer gets low percentile", () => {
      const poor = makeFeatures({ efficiency: 0.05, convergenceSpeed: 0.05, meshQualityScore: 0.1, pressureDrop: 4000 });
      const r = engine.report(makeConfig(), poor);
      expect(r.percentileRank).toBeLessThanOrEqual(30);
    });

    it("returns 50th percentile for empty cluster", () => {
      const emptyEngine = new BenchmarkEngine();
      const r = emptyEngine.report(makeConfig(), makeFeatures());
      expect(r.percentileRank).toBe(50);
    });

    it("improvement potential >= 0", () => {
      const r = engine.report(makeConfig(), makeFeatures());
      expect(r.improvementPotential).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Detailed Report ───────────────────────────────────────────────

  describe("detailedReport", () => {
    it("includes comparisons for all 4 metrics", () => {
      const r = engine.detailedReport(makeConfig(), makeFeatures(), makeMeshStats());
      expect(r.comparisons).toHaveLength(4);
      expect(r.comparisons.map((c) => c.metric)).toEqual(
        expect.arrayContaining(["Efficiency", "Convergence Speed", "Mesh Quality", "Pressure Drop"])
      );
    });

    it("each comparison has a valid rating", () => {
      const r = engine.detailedReport(makeConfig(), makeFeatures(), makeMeshStats());
      const validRatings = ["below-average", "average", "above-average", "top-tier"];
      for (const c of r.comparisons) {
        expect(validRatings).toContain(c.rating);
      }
    });

    it("includes geometry cluster and sample size", () => {
      const r = engine.detailedReport(makeConfig(), makeFeatures(), makeMeshStats());
      expect(r.geometryCluster).toBe("internal-flow");
      expect(r.sampleSize).toBe(20);
    });

    it("insights are sorted by relevance descending", () => {
      const poor = makeFeatures({ efficiency: 0.1, convergenceSpeed: 0.1, meshQualityScore: 0.2 });
      const r = engine.detailedReport(makeConfig(), poor, makeMeshStats());
      for (let i = 1; i < r.insights.length; i++) {
        expect(r.insights[i].relevance).toBeLessThanOrEqual(r.insights[i - 1].relevance);
      }
    });
  });

  // ── Determinism ───────────────────────────────────────────────────

  describe("determinism", () => {
    it("produces identical reports for identical inputs", () => {
      const features = makeFeatures();
      const config = makeConfig();
      const r1 = engine.report(config, features);
      const r2 = engine.report(config, features);
      expect(r1).toEqual(r2);
    });
  });
});
