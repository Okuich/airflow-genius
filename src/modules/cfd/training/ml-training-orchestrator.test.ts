import { describe, it, expect, beforeEach, vi } from "vitest";
import { MLTrainingOrchestrator } from "./ml-training-orchestrator";
import { ModelRegistry } from "../ml-models/model-registry";
import { FeatureStoreService } from "../feature-store/feature-store-service";
import { InMemoryModelRegistry } from "@/packages/model-registry";
import {
  PlatformEventBus,
  InMemoryTransport,
} from "@/packages/events/event-bus";
import type { TrainingPair } from "@/packages/ml-feature-store";

// ── Helpers ───────────────────────────────────────────────────────────────

function makePairs(n: number): TrainingPair[] {
  return Array.from({ length: n }, (_, i) => ({
    features: [
      i * 0.1, i * 0.2, i * 0.3, i * 0.05, 0.5, 0.8,
      0.1, 0.2, 100, 1e-4, 0.8, 0.6, 0.5,
      1.225, 1.8e-5, 50000,
      2, 1, 4, 5.0, 3.0,
      0, 0,
    ],
    target: 10 + i * 2 + Math.sin(i),
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("MLTrainingOrchestrator", () => {
  let orchestrator: MLTrainingOrchestrator;
  let mockFeatureStore: FeatureStoreService;
  let bus: PlatformEventBus;

  beforeEach(() => {
    const transport = new InMemoryTransport();
    bus = new PlatformEventBus({ transport, source: "test" });

    const inMemoryRegistry = new InMemoryModelRegistry();
    const registry = new ModelRegistry(inMemoryRegistry);

    mockFeatureStore = {
      getTrainingData: vi.fn(),
      ingestFromResults: vi.fn(),
      query: vi.fn(),
      count: vi.fn(),
    } as unknown as FeatureStoreService;

    orchestrator = new MLTrainingOrchestrator(
      { retrainThreshold: 5, minSamples: 10, testSplitRatio: 0.2 },
      { featureStore: mockFeatureStore, registry, bus }
    );
  });

  describe("checkTrainingThreshold", () => {
    it("returns false when below threshold", () => {
      orchestrator.incrementPending("org-1", 3);
      const check = orchestrator.checkTrainingThreshold("org-1", "pressure_drop");
      expect(check.shouldRetrain).toBe(false);
      expect(check.currentCount).toBe(3);
    });

    it("returns true when at threshold", () => {
      orchestrator.incrementPending("org-1", 5);
      const check = orchestrator.checkTrainingThreshold("org-1", "convergence");
      expect(check.shouldRetrain).toBe(true);
    });

    it("returns true when above threshold", () => {
      orchestrator.incrementPending("org-1", 12);
      const check = orchestrator.checkTrainingThreshold("org-1", "efficiency");
      expect(check.shouldRetrain).toBe(true);
      expect(check.threshold).toBe(5);
    });
  });

  describe("launchTrainingJob", () => {
    it("throws when samples are insufficient", async () => {
      vi.mocked(mockFeatureStore.getTrainingData).mockResolvedValue(makePairs(3));
      await expect(
        orchestrator.launchTrainingJob("org-1", "pressure_drop")
      ).rejects.toThrow("Insufficient samples");
    });

    it("returns artifact with weights and metrics", async () => {
      vi.mocked(mockFeatureStore.getTrainingData).mockResolvedValue(makePairs(20));
      const artifact = await orchestrator.launchTrainingJob("org-1", "pressure_drop");

      expect(artifact.weights.coefficients).toBeDefined();
      expect(artifact.normalization.mean.length).toBeGreaterThan(0);
      expect(artifact.trainMetrics.sampleCount).toBe(16); // 20 - ceil(20*0.2)
      expect(artifact.trainSamples).toBe(16);
      expect(artifact.testSamples).toBe(4);
    });
  });

  describe("evaluateModel", () => {
    it("produces test metrics and overfit flag", async () => {
      vi.mocked(mockFeatureStore.getTrainingData).mockResolvedValue(makePairs(20));
      const artifact = await orchestrator.launchTrainingJob("org-1", "efficiency");
      const evaluation = await orchestrator.evaluateModel(artifact, "org-1", "efficiency");

      expect(typeof evaluation.testMse).toBe("number");
      expect(typeof evaluation.testR2).toBe("number");
      expect(typeof evaluation.overfit).toBe("boolean");
      expect(evaluation.testSampleCount).toBe(4);
    });
  });

  describe("registerModel", () => {
    it("saves model and emits model.updated event", async () => {
      vi.mocked(mockFeatureStore.getTrainingData).mockResolvedValue(makePairs(20));

      const events: string[] = [];
      bus.on("model.updated", (e) => {
        events.push(e.payload.modelType);
      });

      const artifact = await orchestrator.launchTrainingJob("org-1", "convergence");
      const evaluation = await orchestrator.evaluateModel(artifact, "org-1", "convergence");
      const registered = await orchestrator.registerModel(
        "org-1",
        "convergence",
        artifact,
        evaluation
      );

      expect(registered.version).toBe(1);
      expect(registered.modelType).toBe("convergence");
      expect(events).toContain("convergence");
    });

    it("resets pending count after registration", async () => {
      vi.mocked(mockFeatureStore.getTrainingData).mockResolvedValue(makePairs(15));

      orchestrator.incrementPending("org-1", 10);
      const artifact = await orchestrator.launchTrainingJob("org-1", "pressure_drop");
      const evaluation = await orchestrator.evaluateModel(artifact, "org-1", "pressure_drop");
      await orchestrator.registerModel("org-1", "pressure_drop", artifact, evaluation);

      const check = orchestrator.checkTrainingThreshold("org-1", "pressure_drop");
      expect(check.currentCount).toBe(0);
    });
  });

  describe("runFullCycle", () => {
    it("runs train → evaluate → register end-to-end", async () => {
      vi.mocked(mockFeatureStore.getTrainingData).mockResolvedValue(makePairs(25));

      const result = await orchestrator.runFullCycle("org-1", "pressure_drop");

      expect(result).not.toBeNull();
      expect(result!.version).toBe(1);
      expect(result!.evaluation.testSampleCount).toBe(5);
    });

    it("increments version on repeated cycles", async () => {
      vi.mocked(mockFeatureStore.getTrainingData).mockResolvedValue(makePairs(20));

      const r1 = await orchestrator.runFullCycle("org-1", "efficiency");
      const r2 = await orchestrator.runFullCycle("org-1", "efficiency");

      expect(r1!.version).toBe(1);
      expect(r2!.version).toBe(2);
    });
  });
});
