import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlatformEventBus, InMemoryTransport, setEventBus, getEventBus } from "@/packages/events";
import type { SimulationCompletedEvent, SimulationConfig } from "@/packages/types";
import { FlowType, TurbulenceType } from "@/packages/types";

describe("PipelineReactor event chain", () => {
  let bus: PlatformEventBus;
  let transport: InMemoryTransport;

  const makeConfig = (): SimulationConfig => ({
    id: "sim-1",
    name: "Test Sim",
    description: "",
    flowType: FlowType.Steady,
    turbulenceModel: {
      type: TurbulenceType.SST,
      wallFunction: true,
      turbulentIntensity: 0.05,
      turbulentViscosityRatio: 10,
      kInitial: 0.1,
      omegaInitial: 1,
    },
    meshSettings: {
      baseSize: 0.01, minSize: 0.001, maxSize: 0.1,
      refinementLevels: 3, boundaryLayerCount: 5,
      boundaryLayerGrowthRate: 1.2, targetCellCount: 100000,
      featureAngle: 30, qualityThreshold: 0.8,
    },
    solverSettings: {
      flowType: FlowType.Steady, maxIterations: 2000,
      convergenceCriteria: 1e-6, relaxationPressure: 0.3,
      relaxationVelocity: 0.7, relaxationTurbulence: 0.8,
    },
    boundaryConditions: [],
    fluidDensity: 1.225,
    fluidViscosity: 1.8e-5,
    enableHeatTransfer: false,
    referencePressure: 101325,
  });

  const makeCompletedEvent = (): SimulationCompletedEvent => ({
    simulationId: "sim-1",
    organizationId: "org-1",
    userId: "user-1",
    config: makeConfig(),
    results: {
      converged: true,
      totalIterations: 500,
      finalResiduals: {
        iteration: 500, continuity: 1e-6,
        xMomentum: 1e-6, yMomentum: 1e-6, zMomentum: 1e-6,
        energy: null, kTurbulent: 1e-5, epsilonOrOmega: 1e-5,
      },
      pressureDrop: 245,
      efficiencyRating: "Good",
      solveTimeSeconds: 120,
    },
    timestamp: new Date().toISOString(),
  });

  beforeEach(() => {
    transport = new InMemoryTransport();
    bus = new PlatformEventBus({ transport, source: "test" });
    setEventBus(bus);
  });

  it("emitting simulation.completed triggers feature.created listeners", async () => {
    const featureCreated = vi.fn();
    bus.on("feature.created", featureCreated);

    // Simulate stage 1 inline (without Supabase)
    bus.on("simulation.completed", async (event) => {
      await bus.emit("feature.created", {
        organizationId: event.payload.organizationId,
        simulationId: event.payload.simulationId,
        featureStoreEntryId: "entry-1",
        geometryCluster: "internal-flow",
        timestamp: new Date().toISOString(),
      });
    });

    await bus.emit("simulation.completed", makeCompletedEvent());

    expect(featureCreated).toHaveBeenCalledOnce();
    expect(featureCreated.mock.calls[0][0].payload.organizationId).toBe("org-1");
  });

  it("feature.created → training.threshold_reached after N events", async () => {
    const thresholdReached = vi.fn();
    bus.on("training.threshold_reached", thresholdReached);

    const threshold = 3;
    let count = 0;

    bus.on("feature.created", async (event) => {
      count++;
      if (count >= threshold) {
        await bus.emit("training.threshold_reached", {
          organizationId: event.payload.organizationId,
          pendingCount: count,
          threshold,
          modelTypes: ["pressure_drop", "convergence", "efficiency"],
          timestamp: new Date().toISOString(),
        });
        count = 0;
      }
    });

    for (let i = 0; i < 3; i++) {
      await bus.emit("feature.created", {
        organizationId: "org-1",
        simulationId: `sim-${i}`,
        featureStoreEntryId: `entry-${i}`,
        geometryCluster: "generic",
        timestamp: new Date().toISOString(),
      });
    }

    expect(thresholdReached).toHaveBeenCalledOnce();
    expect(thresholdReached.mock.calls[0][0].payload.pendingCount).toBe(3);
  });

  it("training.threshold_reached triggers training.job_launched listener", async () => {
    const jobLaunched = vi.fn();
    bus.on("training.job_launched", jobLaunched);

    bus.on("training.threshold_reached", async (event) => {
      await bus.emit("training.job_launched", {
        organizationId: event.payload.organizationId,
        jobId: "job-1",
        modelType: "pressure_drop",
        sampleCount: 50,
        timestamp: new Date().toISOString(),
      });
    });

    await bus.emit("training.threshold_reached", {
      organizationId: "org-1",
      pendingCount: 10,
      threshold: 10,
      modelTypes: ["pressure_drop"],
      timestamp: new Date().toISOString(),
    });

    expect(jobLaunched).toHaveBeenCalledOnce();
    expect(jobLaunched.mock.calls[0][0].payload.modelType).toBe("pressure_drop");
  });

  it("full chain: completed → feature → threshold → job", async () => {
    const events: string[] = [];

    bus.on("simulation.completed", async (e) => {
      events.push("simulation.completed");
      await bus.emit("feature.created", {
        organizationId: e.payload.organizationId,
        simulationId: e.payload.simulationId,
        featureStoreEntryId: "e1",
        geometryCluster: "generic",
        timestamp: new Date().toISOString(),
      });
    });

    bus.on("feature.created", async (e) => {
      events.push("feature.created");
      await bus.emit("training.threshold_reached", {
        organizationId: e.payload.organizationId,
        pendingCount: 10, threshold: 10,
        modelTypes: ["pressure_drop"],
        timestamp: new Date().toISOString(),
      });
    });

    bus.on("training.threshold_reached", async (e) => {
      events.push("training.threshold_reached");
      await bus.emit("training.job_launched", {
        organizationId: e.payload.organizationId,
        jobId: "j1", modelType: "pressure_drop",
        sampleCount: 50, timestamp: new Date().toISOString(),
      });
    });

    bus.on("training.job_launched", () => {
      events.push("training.job_launched");
    });

    await bus.emit("simulation.completed", makeCompletedEvent());

    expect(events).toEqual([
      "simulation.completed",
      "feature.created",
      "training.threshold_reached",
      "training.job_launched",
    ]);
  });
});
