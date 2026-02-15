import { describe, it, expect } from "vitest";
import { FeatureExtractor } from "./feature-extractor";
import type {
  SimulationResults,
  SimulationConfig,
  MeshStats,
  ResidualData,
  FeatureVector,
} from "@/packages/types";
import { FlowType, TurbulenceType, BoundaryType } from "@/packages/types";

// ── Fixtures ────────────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<SimulationConfig>): SimulationConfig {
  return {
    id: "sim-1",
    name: "Test Sim",
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
      baseSize: 0.01,
      minSize: 0.001,
      maxSize: 0.1,
      refinementLevels: 3,
      boundaryLayerCount: 5,
      boundaryLayerGrowthRate: 1.2,
      targetCellCount: 500000,
      featureAngle: 30,
      qualityThreshold: 0.7,
    },
    solverSettings: {
      flowType: FlowType.Steady,
      maxIterations: 2000,
      convergenceCriteria: 1e-6,
      relaxationPressure: 0.3,
      relaxationVelocity: 0.7,
      relaxationTurbulence: 0.8,
    },
    boundaryConditions: [
      {
        id: "bc-1",
        name: "Inlet",
        type: BoundaryType.VelocityInlet,
        surfaceIds: ["s1"],
        velocity: { x: 10, y: 0, z: 0 },
        turbulentIntensity: 0.05,
      },
      {
        id: "bc-2",
        name: "Outlet",
        type: BoundaryType.PressureOutlet,
        surfaceIds: ["s2"],
        pressure: 0,
      },
      {
        id: "bc-3",
        name: "Wall",
        type: BoundaryType.Wall,
        surfaceIds: ["s3"],
      },
    ],
    fluidDensity: 1.225,
    fluidViscosity: 1.7894e-5,
    enableHeatTransfer: false,
    referencePressure: 101325,
    ...overrides,
  };
}

function makeMeshStats(overrides?: Partial<MeshStats>): MeshStats {
  return {
    cellCount: 500000,
    avgOrthogonality: 0.85,
    maxSkewness: 0.4,
    maxAspectRatio: 15,
    minVolume: 1e-12,
    nonOrthogonalCellPercent: 5,
    avgYPlus: 35,
    ...overrides,
  };
}

function makeResiduals(count: number, converging = true): ResidualData[] {
  return Array.from({ length: count }, (_, i) => ({
    iteration: i + 1,
    continuity: converging ? 1e-2 * Math.pow(0.95, i) : 1e-2 * Math.pow(1.05, i),
    xMomentum: 1e-3 * Math.pow(0.96, i),
    yMomentum: 1e-3 * Math.pow(0.96, i),
    zMomentum: 1e-3 * Math.pow(0.96, i),
    kTurbulent: 1e-4,
    epsilonOrOmega: 1e-4,
  }));
}

function makeResults(overrides?: Partial<SimulationResults>): SimulationResults {
  return {
    config: makeConfig(),
    meshStats: makeMeshStats(),
    residuals: makeResiduals(100),
    pressureDrop: 245.5,
    efficiencyRating: "Good",
    solveTimeSeconds: 1800,
    totalIterations: 800,
    converged: true,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("FeatureExtractor.extractFromResults", () => {
  const extractor = new FeatureExtractor();

  it("produces all six FeatureVector fields", () => {
    const fv = extractor.extractFromResults(makeResults());
    expect(fv).toHaveProperty("reynoldsNumber");
    expect(fv).toHaveProperty("turbulenceIntensity");
    expect(fv).toHaveProperty("pressureDrop");
    expect(fv).toHaveProperty("efficiency");
    expect(fv).toHaveProperty("meshQualityScore");
    expect(fv).toHaveProperty("convergenceSpeed");
  });

  // ── Reynolds Number ────────────────────────────────────────────────

  it("computes Reynolds number deterministically (Re = ρVL/μ)", () => {
    const fv = extractor.extractFromResults(makeResults());
    // ρ=1.225, V=10 m/s, L=0.01 m, μ=1.7894e-5
    const expected = (1.225 * 10 * 0.01) / 1.7894e-5;
    expect(fv.reynoldsNumber).toBeCloseTo(expected, 1);
  });

  it("returns zero Re for zero inlet velocity", () => {
    const config = makeConfig({
      boundaryConditions: [
        { id: "bc-1", name: "Inlet", type: BoundaryType.VelocityInlet, surfaceIds: ["s1"], velocity: { x: 0, y: 0, z: 0 } },
      ],
    });
    const fv = extractor.extractFromResults(makeResults({ config }));
    expect(fv.reynoldsNumber).toBe(0);
  });

  // ── Turbulence Intensity ──────────────────────────────────────────

  it("uses explicit turbulentIntensity from config", () => {
    const fv = extractor.extractFromResults(makeResults());
    expect(fv.turbulenceIntensity).toBe(0.05);
  });

  it("estimates turbulence intensity from Re when config value is 0", () => {
    const config = makeConfig();
    config.turbulenceModel.turbulentIntensity = 0;
    const fv = extractor.extractFromResults(makeResults({ config }));
    // I = 0.16 * Re^(-1/8), should be a small positive number
    expect(fv.turbulenceIntensity).toBeGreaterThan(0);
    expect(fv.turbulenceIntensity).toBeLessThan(0.1);
  });

  // ── Pressure Drop ────────────────────────────────────────────────

  it("passes through pressure drop directly", () => {
    const fv = extractor.extractFromResults(makeResults({ pressureDrop: 999 }));
    expect(fv.pressureDrop).toBe(999);
  });

  // ── Efficiency ────────────────────────────────────────────────────

  it("maps efficiency ratings to [0, 1]", () => {
    expect(extractor.extractFromResults(makeResults({ efficiencyRating: "Poor" })).efficiency).toBe(0);
    expect(extractor.extractFromResults(makeResults({ efficiencyRating: "Average" })).efficiency).toBe(0.33);
    expect(extractor.extractFromResults(makeResults({ efficiencyRating: "Good" })).efficiency).toBe(0.67);
    expect(extractor.extractFromResults(makeResults({ efficiencyRating: "Excellent" })).efficiency).toBe(1.0);
  });

  // ── Mesh Quality Score ────────────────────────────────────────────

  it("produces high MQS for good mesh", () => {
    const fv = extractor.extractFromResults(makeResults({
      meshStats: makeMeshStats({ maxSkewness: 0.1, avgOrthogonality: 0.95, maxAspectRatio: 5, nonOrthogonalCellPercent: 2 }),
    }));
    expect(fv.meshQualityScore).toBeGreaterThan(0.85);
  });

  it("produces low MQS for poor mesh", () => {
    const fv = extractor.extractFromResults(makeResults({
      meshStats: makeMeshStats({ maxSkewness: 0.95, avgOrthogonality: 0.3, maxAspectRatio: 90, nonOrthogonalCellPercent: 40 }),
    }));
    expect(fv.meshQualityScore).toBeLessThan(0.35);
  });

  it("clamps MQS to [0, 1]", () => {
    const extreme = extractor.extractFromResults(makeResults({
      meshStats: makeMeshStats({ maxSkewness: 2.0, avgOrthogonality: -1, maxAspectRatio: 500, nonOrthogonalCellPercent: 200 }),
    }));
    expect(extreme.meshQualityScore).toBeGreaterThanOrEqual(0);
    expect(extreme.meshQualityScore).toBeLessThanOrEqual(1);
  });

  // ── Convergence Speed ─────────────────────────────────────────────

  it("returns high convergence speed when few iterations used", () => {
    const fv = extractor.extractFromResults(makeResults({ totalIterations: 200 }));
    // 1 - 200/2000 = 0.9 + potential bonus
    expect(fv.convergenceSpeed).toBeGreaterThanOrEqual(0.9);
  });

  it("returns low convergence speed near max iterations", () => {
    const fv = extractor.extractFromResults(makeResults({ totalIterations: 1900 }));
    expect(fv.convergenceSpeed).toBeLessThanOrEqual(0.15);
  });

  it("returns zero for non-converged simulations", () => {
    const fv = extractor.extractFromResults(makeResults({ converged: false }));
    expect(fv.convergenceSpeed).toBe(0);
  });

  // ── Determinism ───────────────────────────────────────────────────

  it("produces identical output for identical input", () => {
    const results = makeResults();
    const fv1 = extractor.extractFromResults(results);
    const fv2 = extractor.extractFromResults(results);
    expect(fv1).toEqual(fv2);
  });

  // ── Array Conversion ──────────────────────────────────────────────

  it("resultToArray produces ordered array matching RESULT_FEATURE_NAMES", () => {
    const fv = extractor.extractFromResults(makeResults());
    const arr = extractor.resultToArray(fv);
    expect(arr).toHaveLength(6);
    expect(arr[0]).toBe(fv.reynoldsNumber);
    expect(arr[1]).toBe(fv.turbulenceIntensity);
    expect(arr[2]).toBe(fv.pressureDrop);
    expect(arr[3]).toBe(fv.efficiency);
    expect(arr[4]).toBe(fv.meshQualityScore);
    expect(arr[5]).toBe(fv.convergenceSpeed);
  });
});
