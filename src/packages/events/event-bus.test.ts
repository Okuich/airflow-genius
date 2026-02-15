import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PlatformEventBus,
  InMemoryTransport,
} from "@/packages/events";
import type {
  SimulationCompletedEvent,
  SimulationSubmittedEvent,
  SimulationFailedEvent,
  DiagnosticGeneratedEvent,
  ModelUpdatedEvent,
  BillingThresholdExceededEvent,
  Event,
  SolverErrorCode,
} from "@/packages/types";

// ── Fixtures ────────────────────────────────────────────────────────────

const NOW = "2026-02-15T12:00:00.000Z";

const submittedPayload: SimulationSubmittedEvent = {
  simulationId: "sim-1",
  organizationId: "org-1",
  userId: "user-1",
  config: {} as any,
  timestamp: NOW,
};

const completedPayload: SimulationCompletedEvent = {
  simulationId: "sim-1",
  organizationId: "org-1",
  userId: "user-1",
  config: {} as any,
  results: {
    converged: true,
    totalIterations: 500,
    finalResiduals: {} as any,
    pressureDrop: 120,
    efficiencyRating: "Good",
    solveTimeSeconds: 3600,
  },
  timestamp: NOW,
};

const failedPayload: SimulationFailedEvent = {
  simulationId: "sim-2",
  organizationId: "org-1",
  userId: "user-1",
  error: {
    code: "DIVERGENCE_DETECTED" as SolverErrorCode,
    message: "Divergence at iteration 42",
    jobId: "job-2",
    iteration: 42,
    timestamp: NOW,
    recoverable: false,
    suggestedAction: "Lower relaxation factors",
  },
  lastIteration: 42,
  timestamp: NOW,
};

const diagnosticPayload: DiagnosticGeneratedEvent = {
  simulationId: "sim-1",
  organizationId: "org-1",
  diagnosticType: "convergence",
  severity: "warning",
  message: "Oscillation detected",
  recommendations: ["Lower relaxation"],
  timestamp: NOW,
};

const modelUpdatedPayload: ModelUpdatedEvent = {
  organizationId: "org-1",
  modelType: "pressure_drop",
  version: 3,
  metrics: { mse: 0.01, mae: 0.05, r2: 0.92, sampleCount: 50, trainedAt: NOW },
  previousVersion: 2,
  timestamp: NOW,
};

const billingPayload: BillingThresholdExceededEvent = {
  organizationId: "org-1",
  userId: "user-1",
  resource: "cpuHours",
  currentValue: 48,
  limit: 50,
  percentUsed: 96,
  tier: "free",
  timestamp: NOW,
};

// ── Tests ───────────────────────────────────────────────────────────────

describe("PlatformEventBus", () => {
  let bus: PlatformEventBus;
  let transport: InMemoryTransport;

  beforeEach(() => {
    transport = new InMemoryTransport();
    bus = new PlatformEventBus({ transport, source: "test" });
  });

  it("emits and receives simulation.submitted with correct types", async () => {
    const handler = vi.fn();
    bus.on("simulation.submitted", handler);

    const event = await bus.emit("simulation.submitted", submittedPayload);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].name).toBe("simulation.submitted");
    expect(handler.mock.calls[0][0].payload.simulationId).toBe("sim-1");
    expect(event.source).toBe("test");
    expect(event.id).toMatch(/^evt_/);
  });

  it("emits and receives simulation.completed", async () => {
    const handler = vi.fn();
    bus.on("simulation.completed", handler);
    await bus.emit("simulation.completed", completedPayload);

    expect(handler).toHaveBeenCalledOnce();
    const received: Event<"simulation.completed"> = handler.mock.calls[0][0];
    expect(received.payload.results.converged).toBe(true);
    expect(received.payload.results.efficiencyRating).toBe("Good");
  });

  it("emits and receives simulation.failed", async () => {
    const handler = vi.fn();
    bus.on("simulation.failed", handler);
    await bus.emit("simulation.failed", failedPayload);

    const received: Event<"simulation.failed"> = handler.mock.calls[0][0];
    expect(received.payload.error.code).toBe("DIVERGENCE_DETECTED");
    expect(received.payload.lastIteration).toBe(42);
  });

  it("emits and receives diagnostic.generated", async () => {
    const handler = vi.fn();
    bus.on("diagnostic.generated", handler);
    await bus.emit("diagnostic.generated", diagnosticPayload);

    const received: Event<"diagnostic.generated"> = handler.mock.calls[0][0];
    expect(received.payload.diagnosticType).toBe("convergence");
    expect(received.payload.severity).toBe("warning");
  });

  it("emits and receives model.updated", async () => {
    const handler = vi.fn();
    bus.on("model.updated", handler);
    await bus.emit("model.updated", modelUpdatedPayload);

    const received: Event<"model.updated"> = handler.mock.calls[0][0];
    expect(received.payload.modelType).toBe("pressure_drop");
    expect(received.payload.version).toBe(3);
    expect(received.payload.metrics.r2).toBe(0.92);
  });

  it("emits and receives billing.threshold_exceeded", async () => {
    const handler = vi.fn();
    bus.on("billing.threshold_exceeded", handler);
    await bus.emit("billing.threshold_exceeded", billingPayload);

    const received: Event<"billing.threshold_exceeded"> = handler.mock.calls[0][0];
    expect(received.payload.resource).toBe("cpuHours");
    expect(received.payload.percentUsed).toBe(96);
    expect(received.payload.tier).toBe("free");
  });

  it("does not cross-fire between event types", async () => {
    const completedHandler = vi.fn();
    const failedHandler = vi.fn();
    bus.on("simulation.completed", completedHandler);
    bus.on("simulation.failed", failedHandler);

    await bus.emit("simulation.completed", completedPayload);

    expect(completedHandler).toHaveBeenCalledOnce();
    expect(failedHandler).not.toHaveBeenCalled();
  });

  it("supports multiple handlers for the same event", async () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on("simulation.submitted", h1);
    bus.on("simulation.submitted", h2);

    await bus.emit("simulation.submitted", submittedPayload);

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it("unsubscribes correctly", async () => {
    const handler = vi.fn();
    const unsub = bus.on("simulation.completed", handler);

    unsub();
    await bus.emit("simulation.completed", completedPayload);

    expect(handler).not.toHaveBeenCalled();
  });

  it("once() fires handler only once", async () => {
    const handler = vi.fn();
    bus.once("model.updated", handler);

    await bus.emit("model.updated", modelUpdatedPayload);
    await bus.emit("model.updated", modelUpdatedPayload);

    expect(handler).toHaveBeenCalledOnce();
  });

  it("waitFor() resolves on next emission", async () => {
    const promise = bus.waitFor("diagnostic.generated", 5000);

    // Emit after a microtask delay
    queueMicrotask(() => {
      bus.emit("diagnostic.generated", diagnosticPayload);
    });

    const event = await promise;
    expect(event.payload.diagnosticType).toBe("convergence");
  });

  it("waitFor() rejects on timeout", async () => {
    await expect(bus.waitFor("simulation.submitted", 50)).rejects.toThrow("Timeout");
  });

  it("handler errors do not prevent other handlers from running", async () => {
    const errorHandler = vi.fn(() => { throw new Error("boom"); });
    const goodHandler = vi.fn();

    bus.on("simulation.completed", errorHandler);
    bus.on("simulation.completed", goodHandler);

    await bus.emit("simulation.completed", completedPayload);

    expect(errorHandler).toHaveBeenCalledOnce();
    expect(goodHandler).toHaveBeenCalledOnce();
  });

  it("transport.listenerCount reports accurately", () => {
    bus.on("simulation.submitted", vi.fn());
    bus.on("simulation.submitted", vi.fn());
    bus.on("simulation.failed", vi.fn());

    expect(transport.listenerCount("simulation.submitted")).toBe(2);
    expect(transport.listenerCount("simulation.failed")).toBe(1);
    expect(transport.listenerCount("simulation.completed")).toBe(0);
    expect(transport.totalListeners).toBe(3);
  });

  it("transport.clear removes all handlers", async () => {
    bus.on("simulation.submitted", vi.fn());
    bus.on("simulation.completed", vi.fn());

    transport.clear();
    expect(transport.totalListeners).toBe(0);
  });
});
