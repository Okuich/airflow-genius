import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ProgressiveMeshController,
  type ProgressiveMeshConfig,
  type GradientRegion,
  type MeshRefinementReport,
} from "./progressive-mesh-controller";
import type { SimulationConfig, MeshSettings, ResidualSnapshot } from "@/packages/types";
import type { PipelineResult } from "./simulation-execution-pipeline";

// ── Mocks ───────────────────────────────────────────────────────────────────

const stubBus = {
  emit: vi.fn().mockResolvedValue(undefined),
  on: vi.fn().mockReturnValue(() => {}),
};

const baseMesh: MeshSettings = {
  baseSize: 0.01,
  minSize: 0.001,
  maxSize: 0.05,
  refinementLevels: 2,
  boundaryLayerCount: 5,
  boundaryLayerGrowthRate: 1.2,
  targetCellCount: 100_000,
  featureAngle: 30,
  qualityThreshold: 0.7,
};

const baseConfig: SimulationConfig = {
  id: "sim-amr",
  name: "AMR Test",
  description: "test",
  flowType: "steady" as any,
  turbulenceModel: { type: "k-epsilon" as any, wallFunction: true, turbulentIntensity: 0.05, turbulentViscosityRatio: 10, kInitial: 0.1 },
  meshSettings: baseMesh,
  solverSettings: { flowType: "steady" as any, maxIterations: 1000, convergenceCriteria: 1e-6, relaxationPressure: 0.3, relaxationVelocity: 0.7, relaxationTurbulence: 0.8 },
  boundaryConditions: [],
  fluidDensity: 1.225,
  fluidViscosity: 1.81e-5,
  enableHeatTransfer: false,
  referencePressure: 101325,
};

const makePipelineResult = (continuity: number): PipelineResult => ({
  success: true,
  stages: [],
  simulationId: "sim-amr-0",
  surrogateCheck: null,
  convergenceWarning: null,
  gpuAllocation: null,
  solverJobId: "j1",
  earlyTerminated: false,
  adaptiveSteps: [],
  finalResult: {
    success: true,
    results: {
      jobId: "j1",
      completedAt: new Date().toISOString(),
      totalIterations: 500,
      converged: true,
      finalResiduals: {
        iteration: 500,
        continuity,
        xMomentum: continuity * 0.5,
        yMomentum: continuity * 0.3,
        zMomentum: continuity * 0.2,
        energy: null,
        kTurbulent: null,
        epsilonOrOmega: null,
      },
      outputFiles: [],
      performanceMetrics: {
        totalCpuHours: 1,
        peakMemoryGB: 4,
        cellCount: 100_000,
        wallClockSeconds: 3600,
        parallelEfficiency: 0.85,
      },
    },
    error: null,
  },
  error: null,
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("ProgressiveMeshController", () => {
  let controller: ProgressiveMeshController;

  describe("scaleToCoarse", () => {
    it("reduces cell count by coarseMultiplier", () => {
      controller = new ProgressiveMeshController(
        { coarseMultiplier: 0.25 },
        { bus: stubBus as any }
      );
      const coarse = controller.scaleToCoarse(baseMesh, 100_000);
      expect(coarse.targetCellCount).toBe(25_000);
      expect(coarse.baseSize).toBeGreaterThan(baseMesh.baseSize);
    });

    it("preserves boundary layer settings", () => {
      controller = new ProgressiveMeshController({}, { bus: stubBus as any });
      const coarse = controller.scaleToCoarse(baseMesh, 100_000);
      expect(coarse.boundaryLayerCount).toBe(baseMesh.boundaryLayerCount);
      expect(coarse.boundaryLayerGrowthRate).toBe(baseMesh.boundaryLayerGrowthRate);
    });
  });

  describe("identifyHighGradientRegions", () => {
    beforeEach(() => {
      controller = new ProgressiveMeshController({}, { bus: stubBus as any });
    });

    it("returns empty for failed pipeline", () => {
      const result: PipelineResult = {
        success: false,
        stages: [],
        simulationId: "x",
        surrogateCheck: null,
        convergenceWarning: null,
        gpuAllocation: null,
        solverJobId: null,
        earlyTerminated: false,
        adaptiveSteps: [],
        finalResult: null,
        error: "failed",
      };
      expect(controller.identifyHighGradientRegions(result)).toHaveLength(0);
    });

    it("returns regions for successful pipeline", () => {
      const result = makePipelineResult(1e-3);
      const regions = controller.identifyHighGradientRegions(result);
      expect(regions.length).toBeGreaterThan(0);
      expect(regions[0].gradientMagnitude).toBeGreaterThan(0);
      expect(regions[0].refinementFactor).toBeGreaterThanOrEqual(0);
      expect(regions[0].refinementFactor).toBeLessThanOrEqual(1);
    });
  });

  describe("refineNearGradients", () => {
    beforeEach(() => {
      controller = new ProgressiveMeshController(
        { refineFraction: 0.15 },
        { bus: stubBus as any }
      );
    });

    it("increases cell count", () => {
      const regions: GradientRegion[] = [
        { centroid: { x: 0, y: 0, z: 0 }, gradientMagnitude: 0.5, refinementFactor: 0.5 },
      ];
      const refined = controller.refineNearGradients(baseMesh, regions, 1_000_000);
      expect(refined.targetCellCount).toBeGreaterThan(baseMesh.targetCellCount);
    });

    it("caps at maxCells", () => {
      const regions: GradientRegion[] = [
        { centroid: { x: 0, y: 0, z: 0 }, gradientMagnitude: 10, refinementFactor: 0.1 },
      ];
      const refined = controller.refineNearGradients(baseMesh, regions, 110_000);
      expect(refined.targetCellCount).toBeLessThanOrEqual(110_000);
    });

    it("falls back to uniform refinement when no regions", () => {
      const refined = controller.refineNearGradients(baseMesh, [], 1_000_000);
      expect(refined.targetCellCount).toBeGreaterThan(baseMesh.targetCellCount);
    });

    it("increases refinement levels", () => {
      const regions: GradientRegion[] = [
        { centroid: { x: 0, y: 0, z: 0 }, gradientMagnitude: 0.5, refinementFactor: 0.5 },
      ];
      const refined = controller.refineNearGradients(baseMesh, regions, 1_000_000);
      expect(refined.refinementLevels).toBe(baseMesh.refinementLevels + 1);
    });
  });

  describe("run", () => {
    it("converges when metrics stabilise", async () => {
      // Pipeline returns decreasing-then-stable continuity
      let call = 0;
      const metricSequence = [1e-3, 5e-4, 4.98e-4]; // third ≈ same as second
      const mockPipeline = {
        execute: vi.fn().mockImplementation(async () => {
          return makePipelineResult(metricSequence[Math.min(call++, metricSequence.length - 1)]);
        }),
      };

      controller = new ProgressiveMeshController(
        { maxPasses: 5, convergenceThresholdPercent: 1.0 },
        { pipeline: mockPipeline as any, bus: stubBus as any }
      );

      const report = await controller.run("org", "user", baseConfig);

      expect(report.converged).toBe(true);
      expect(report.totalPasses).toBe(3);
      expect(report.recommendation).toContain("Converged");
    });

    it("stops at maxPasses if not converging", async () => {
      let call = 0;
      const metricSequence = [1e-2, 5e-3, 3e-3, 2e-3, 1.5e-3];
      const mockPipeline = {
        execute: vi.fn().mockImplementation(async () => {
          return makePipelineResult(metricSequence[Math.min(call++, metricSequence.length - 1)]);
        }),
      };

      controller = new ProgressiveMeshController(
        { maxPasses: 4, convergenceThresholdPercent: 0.01 },
        { pipeline: mockPipeline as any, bus: stubBus as any }
      );

      const report = await controller.run("org", "user", baseConfig);
      expect(report.converged).toBe(false);
      expect(report.totalPasses).toBeLessThanOrEqual(4);
    });

    it("calls onProgress callback", async () => {
      const mockPipeline = {
        execute: vi.fn().mockResolvedValue(makePipelineResult(1e-3)),
      };
      controller = new ProgressiveMeshController(
        { maxPasses: 1 },
        { pipeline: mockPipeline as any, bus: stubBus as any }
      );

      const progress = vi.fn();
      await controller.run("org", "user", baseConfig, progress);
      expect(progress).toHaveBeenCalled();
    });

    it("emits refinement_study.completed event", async () => {
      const mockPipeline = {
        execute: vi.fn().mockResolvedValue(makePipelineResult(1e-3)),
      };
      controller = new ProgressiveMeshController(
        { maxPasses: 1 },
        { pipeline: mockPipeline as any, bus: stubBus as any }
      );

      await controller.run("org", "user", baseConfig);
      expect(stubBus.emit).toHaveBeenCalledWith(
        "refinement_study.completed",
        expect.objectContaining({ simulationId: "sim-amr" })
      );
    });
  });
});
