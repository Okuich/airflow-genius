import { describe, it, expect, beforeEach } from "vitest";
import {
  SimulationExecutionPipeline,
  type GPUAllocation,
  type AdaptiveTimeStep,
} from "./simulation-execution-pipeline";
import type {
  SimulationConfig,
  FeatureVector,
  ResidualSnapshot,
} from "@/packages/types";
import type { ConvergencePrediction, EfficiencyPrediction } from "../inference/inference-service";

// ── Fixtures ──────────────────────────────────────────────────────────────

const makeConfig = (overrides?: Partial<SimulationConfig>): SimulationConfig => ({
  id: "sim-1",
  name: "Test Sim",
  description: "test",
  flowType: "steady" as any,
  turbulenceModel: {
    type: "k-omega-sst" as any,
    wallFunction: true,
    turbulentIntensity: 0.05,
    turbulentViscosityRatio: 10,
    kInitial: 0.1,
    omegaInitial: 1,
  },
  meshSettings: {
    baseSize: 0.01,
    minSize: 0.001,
    maxSize: 0.1,
    refinementLevels: 3,
    boundaryLayerCount: 5,
    boundaryLayerGrowthRate: 1.2,
    targetCellCount: 500_000,
    featureAngle: 30,
    qualityThreshold: 0.85,
  },
  solverSettings: {
    flowType: "steady" as any,
    maxIterations: 1000,
    convergenceCriteria: 1e-5,
    relaxationPressure: 0.3,
    relaxationVelocity: 0.7,
    relaxationTurbulence: 0.5,
  },
  boundaryConditions: [
    {
      id: "bc-1",
      name: "inlet",
      type: "velocity_inlet" as any,
      surfaceIds: ["s1"],
      velocity: { x: 5, y: 0, z: 0 },
    },
    {
      id: "bc-2",
      name: "outlet",
      type: "outlet" as any,
      surfaceIds: ["s2"],
      pressure: 0,
    },
  ],
  fluidDensity: 1.225,
  fluidViscosity: 1.8e-5,
  enableHeatTransfer: false,
  referencePressure: 101325,
  ...overrides,
});

const makeResidual = (continuity: number, iteration: number): ResidualSnapshot => ({
  iteration,
  continuity,
  xMomentum: continuity * 0.8,
  yMomentum: continuity * 0.6,
  zMomentum: continuity * 0.4,
  energy: null,
  kTurbulent: continuity * 0.5,
  epsilonOrOmega: continuity * 0.3,
});

const convergingHistory = (n: number): ResidualSnapshot[] =>
  Array.from({ length: n }, (_, i) => makeResidual(1e-2 * Math.exp(-0.1 * i), i));

const divergingHistory = (n: number): ResidualSnapshot[] =>
  Array.from({ length: n }, (_, i) => makeResidual(1e-3 * Math.exp(0.5 * i), i));

const stagnatingHistory = (n: number): ResidualSnapshot[] =>
  Array.from({ length: n }, (_, i) => makeResidual(1e-3 + Math.sin(i) * 1e-5, i));

// ── Tests ─────────────────────────────────────────────────────────────────

describe("SimulationExecutionPipeline", () => {
  let pipeline: SimulationExecutionPipeline;

  beforeEach(() => {
    pipeline = new SimulationExecutionPipeline({
      divergenceWindowSize: 10,
      divergenceSlopeThreshold: 0.05,
    });
  });

  describe("optimizeGPUAllocation", () => {
    const mockConvergence: ConvergencePrediction = {
      likelihood: 0.7,
      label: "likely-converge",
      confidence: 0.5,
      source: "fallback",
      modelVersion: null,
    };
    const mockEfficiency: EfficiencyPrediction = {
      score: 0.6,
      label: "Good",
      confidence: 0.4,
      source: "fallback",
      modelVersion: null,
    };

    it("allocates modest resources for small meshes", () => {
      const config = makeConfig({ meshSettings: { ...makeConfig().meshSettings, targetCellCount: 100_000 } });
      const alloc = pipeline.optimizeGPUAllocation(config, mockConvergence, mockEfficiency);
      expect(alloc.gpuCount).toBe(0);
      expect(alloc.cpuCores).toBe(8);
      expect(alloc.memoryGB).toBe(16);
    });

    it("allocates GPUs for large meshes", () => {
      const config = makeConfig({ meshSettings: { ...makeConfig().meshSettings, targetCellCount: 6_000_000 } });
      const alloc = pipeline.optimizeGPUAllocation(config, mockConvergence, mockEfficiency);
      expect(alloc.gpuCount).toBeGreaterThanOrEqual(1);
      expect(alloc.cpuCores).toBe(32);
    });

    it("scales up for transient simulations", () => {
      const steady = pipeline.optimizeGPUAllocation(makeConfig(), mockConvergence, mockEfficiency);
      const transient = pipeline.optimizeGPUAllocation(
        makeConfig({ flowType: "transient" as any }),
        mockConvergence,
        mockEfficiency
      );
      expect(transient.cpuCores).toBeGreaterThan(steady.cpuCores);
    });

    it("reduces resources for high-confidence convergence", () => {
      const highConf: ConvergencePrediction = { ...mockConvergence, likelihood: 0.95, confidence: 0.8 };
      const normal = pipeline.optimizeGPUAllocation(makeConfig(), mockConvergence, mockEfficiency);
      const reduced = pipeline.optimizeGPUAllocation(makeConfig(), highConf, mockEfficiency);
      expect(reduced.cpuCores).toBeLessThanOrEqual(normal.cpuCores);
    });

    it("includes cost estimate", () => {
      const alloc = pipeline.optimizeGPUAllocation(makeConfig(), mockConvergence, mockEfficiency);
      expect(alloc.estimatedCostUSD).toBeGreaterThan(0);
      expect(alloc.reasoning).toBeTruthy();
    });
  });

  describe("analyseAdaptiveStep", () => {
    it("recommends increasing dt when converging", () => {
      const step = pipeline.analyseAdaptiveStep(convergingHistory(20), 1.0);
      expect(step.trend).toBe("converging");
      expect(step.recommendedAction).toBe("increase_dt");
      expect(step.currentMultiplier).toBeGreaterThan(1.0);
    });

    it("recommends decreasing dt when diverging", () => {
      const step = pipeline.analyseAdaptiveStep(divergingHistory(20), 1.0);
      expect(step.trend).toBe("diverging");
      expect(step.recommendedAction).toBe("decrease_dt");
      expect(step.currentMultiplier).toBeLessThan(1.0);
    });

    it("holds when stagnating", () => {
      const step = pipeline.analyseAdaptiveStep(stagnatingHistory(20), 1.0);
      expect(step.trend).toBe("stagnating");
      expect(step.recommendedAction).toBe("hold");
    });

    it("clamps multiplier to max", () => {
      const step = pipeline.analyseAdaptiveStep(convergingHistory(20), 1.9);
      expect(step.currentMultiplier).toBeLessThanOrEqual(2.0);
    });

    it("clamps multiplier to min", () => {
      const step = pipeline.analyseAdaptiveStep(divergingHistory(20), 0.3);
      expect(step.currentMultiplier).toBeGreaterThanOrEqual(0.25);
    });
  });

  describe("shouldTerminateEarly", () => {
    it("returns false with insufficient history", () => {
      expect(pipeline.shouldTerminateEarly(convergingHistory(3))).toBe(false);
    });

    it("returns false for converging residuals", () => {
      expect(pipeline.shouldTerminateEarly(convergingHistory(25))).toBe(false);
    });

    it("returns true for strongly diverging residuals", () => {
      expect(pipeline.shouldTerminateEarly(divergingHistory(25))).toBe(true);
    });

    it("returns true for NaN residuals", () => {
      const history = convergingHistory(15);
      history.push(makeResidual(NaN, 15));
      expect(pipeline.shouldTerminateEarly(history)).toBe(true);
    });

    it("returns true for exploded residuals", () => {
      const history = convergingHistory(15);
      history.push(makeResidual(1e7, 15));
      expect(pipeline.shouldTerminateEarly(history)).toBe(true);
    });
  });
});
