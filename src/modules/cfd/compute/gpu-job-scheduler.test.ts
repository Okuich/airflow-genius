import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  GPUJobScheduler,
  JobPriority,
  SimulationSize,
  type ResourceAllocation,
  type GPUMetrics,
  type ScalingHook,
} from "./gpu-job-scheduler";
import type { SimulationConfig } from "@/packages/types";

// ── Fixtures ──────────────────────────────────────────────────────────────

const makeConfig = (cells: number, overrides?: Partial<SimulationConfig>): SimulationConfig => ({
  id: `sim-${cells}`,
  name: "Test",
  description: "",
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
    targetCellCount: cells,
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
  boundaryConditions: [],
  fluidDensity: 1.225,
  fluidViscosity: 1.8e-5,
  enableHeatTransfer: false,
  referencePressure: 101325,
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("GPUJobScheduler", () => {
  let scheduler: GPUJobScheduler;

  beforeEach(() => {
    scheduler = new GPUJobScheduler({ totalGPUs: 4, totalCPUCores: 64, totalMemoryGB: 256, maxQueueDepth: 5 });
  });

  describe("classifySize", () => {
    it("classifies small simulations", () => {
      expect(scheduler.classifySize(makeConfig(100_000))).toBe(SimulationSize.Small);
    });

    it("classifies medium simulations", () => {
      expect(scheduler.classifySize(makeConfig(1_000_000))).toBe(SimulationSize.Medium);
    });

    it("classifies large simulations", () => {
      expect(scheduler.classifySize(makeConfig(5_000_000))).toBe(SimulationSize.Large);
    });

    it("classifies massive simulations", () => {
      expect(scheduler.classifySize(makeConfig(15_000_000))).toBe(SimulationSize.Massive);
    });
  });

  describe("allocate", () => {
    it("allocates resources for a small job", () => {
      const alloc = scheduler.allocate("sim-1", makeConfig(200_000));
      expect(alloc).not.toBeNull();
      expect(alloc!.gpuCount).toBe(0);
      expect(alloc!.size).toBe(SimulationSize.Small);
    });

    it("allocates GPUs for medium jobs", () => {
      const alloc = scheduler.allocate("sim-2", makeConfig(1_000_000));
      expect(alloc).not.toBeNull();
      expect(alloc!.gpuCount).toBe(1);
    });

    it("scales up for transient simulations", () => {
      const steady = scheduler.allocate("sim-s", makeConfig(1_000_000));
      scheduler.release(steady!.jobId);
      const transient = scheduler.allocate("sim-t", makeConfig(1_000_000, { flowType: "transient" as any }));
      expect(transient!.cpuCores).toBeGreaterThan(steady!.cpuCores);
      expect(transient!.estimatedDurationMinutes).toBeGreaterThan(steady!.estimatedDurationMinutes);
    });

    it("respects priority weighting on estimated duration", () => {
      const normal = scheduler.allocate("sim-n", makeConfig(1_000_000), JobPriority.Normal);
      scheduler.release(normal!.jobId);
      const critical = scheduler.allocate("sim-c", makeConfig(1_000_000), JobPriority.Critical);
      expect(critical!.estimatedDurationMinutes).toBeLessThan(normal!.estimatedDurationMinutes);
    });

    it("returns null when queue is full", () => {
      // Fill capacity with large jobs
      for (let i = 0; i < 10; i++) {
        scheduler.allocate(`sim-${i}`, makeConfig(5_000_000));
      }
      const result = scheduler.allocate("sim-overflow", makeConfig(5_000_000));
      expect(result).toBeNull();
    });
  });

  describe("release and queue drain", () => {
    it("releases resources and promotes queued jobs", () => {
      const alloc1 = scheduler.allocate("sim-1", makeConfig(5_000_000))!;
      const alloc2 = scheduler.allocate("sim-2", makeConfig(5_000_000));
      // alloc2 should be queued since 2 GPUs × 2 = 4, filling capacity
      expect(scheduler.getMetrics().activeJobs).toBeGreaterThanOrEqual(1);

      scheduler.release(alloc1.jobId);
      // Queue should drain
      expect(scheduler.getMetrics().activeJobs).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getMetrics", () => {
    it("returns correct initial metrics", () => {
      const m = scheduler.getMetrics();
      expect(m.totalGPUs).toBe(4);
      expect(m.allocatedGPUs).toBe(0);
      expect(m.availableGPUs).toBe(4);
      expect(m.utilizationPercent).toBe(0);
      expect(m.activeJobs).toBe(0);
      expect(m.queueDepth).toBe(0);
    });

    it("updates after allocation", () => {
      scheduler.allocate("sim-1", makeConfig(1_000_000));
      const m = scheduler.getMetrics();
      expect(m.allocatedGPUs).toBe(1);
      expect(m.utilizationPercent).toBe(25);
      expect(m.activeJobs).toBe(1);
    });
  });

  describe("scaling hooks", () => {
    it("fires onScaleUp when utilization exceeds threshold and jobs are queued", () => {
      const onScaleUp = vi.fn();
      const onScaleDown = vi.fn();

      // Fill all 4 GPUs
      scheduler.allocate("sim-1", makeConfig(5_000_000)); // 2 GPUs
      scheduler.allocate("sim-2", makeConfig(5_000_000)); // 2 GPUs → full

      // Queue a job that can't fit
      scheduler.allocate("sim-3", makeConfig(5_000_000)); // queued

      // Now register hook and trigger via a release+allocate cycle
      scheduler.registerScalingHook({
        triggerThreshold: 0.5,
        cooldownThreshold: 0.2,
        onScaleUp,
        onScaleDown,
      });

      // Allocate a small job (0 GPUs) — scaling check runs, sees queue depth > 0 and util >= 50%
      scheduler.allocate("sim-4", makeConfig(100_000));

      expect(onScaleUp).toHaveBeenCalled();
    });

    it("fires onScaleDown when utilization drops below cooldown", () => {
      const onScaleDown = vi.fn();
      scheduler.registerScalingHook({
        triggerThreshold: 0.9,
        cooldownThreshold: 0.3,
        onScaleUp: vi.fn(),
        onScaleDown,
      });

      const alloc = scheduler.allocate("sim-1", makeConfig(200_000))!; // 0 GPUs
      scheduler.release(alloc.jobId); // 0% utilisation < 30%

      expect(onScaleDown).toHaveBeenCalled();
    });

    it("unregisters scaling hooks", () => {
      const onScaleDown = vi.fn();
      const unsub = scheduler.registerScalingHook({
        triggerThreshold: 0.9,
        cooldownThreshold: 0.3,
        onScaleUp: vi.fn(),
        onScaleDown,
      });
      unsub();

      const alloc = scheduler.allocate("sim-1", makeConfig(200_000))!;
      scheduler.release(alloc.jobId);
      expect(onScaleDown).not.toHaveBeenCalled();
    });
  });

  describe("addCapacity / removeCapacity", () => {
    it("increases available resources", () => {
      scheduler.addCapacity(4, 32, 128);
      const m = scheduler.getMetrics();
      expect(m.totalGPUs).toBe(8);
    });

    it("decreases capacity without evicting active jobs", () => {
      scheduler.allocate("sim-1", makeConfig(1_000_000)); // 1 GPU
      scheduler.removeCapacity(2, 16, 64);
      const m = scheduler.getMetrics();
      expect(m.totalGPUs).toBeGreaterThanOrEqual(m.allocatedGPUs);
    });
  });

  describe("preemption", () => {
    it("preempts low-priority jobs for critical ones", () => {
      // Fill all 4 GPUs with low-priority
      scheduler.allocate("sim-low-1", makeConfig(5_000_000), JobPriority.Low); // 2 GPUs
      scheduler.allocate("sim-low-2", makeConfig(5_000_000), JobPriority.Low); // 2 GPUs
      expect(scheduler.getMetrics().allocatedGPUs).toBe(4);

      // Critical job should preempt
      const critical = scheduler.allocate("sim-crit", makeConfig(5_000_000), JobPriority.Critical);
      expect(critical).not.toBeNull();
      expect(scheduler.getQueuedJobs().length).toBeGreaterThan(0);
    });
  });
});
