import { describe, it, expect, beforeEach, vi } from "vitest";
import { TrainingPipeline } from "./training-pipeline";
import { ModelRegistry } from "../ml-models/model-registry";
import { FeatureStoreService } from "../feature-store/feature-store-service";
import { InMemoryModelRegistry } from "@/packages/model-registry";
import type { TrainingPair } from "@/packages/ml-feature-store";

// ── Helpers ───────────────────────────────────────────────────────────────

function makePairs(n: number): TrainingPair[] {
  return Array.from({ length: n }, (_, i) => ({
    features: [i * 0.1, i * 0.2, i * 0.3, i * 0.05, 0.5, 0.8,
               0.1, 0.2, 100, 1e-4, 0.8, 0.6, 0.5,
               1.225, 1.8e-5, 50000,
               2, 1, 4, 5.0, 3.0,
               0, 0],
    target: 10 + i * 2 + Math.sin(i),
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("TrainingPipeline", () => {
  let pipeline: TrainingPipeline;
  let mockFeatureStore: FeatureStoreService;

  beforeEach(() => {
    const inMemoryRegistry = new InMemoryModelRegistry();
    const registry = new ModelRegistry(inMemoryRegistry);

    mockFeatureStore = {
      getTrainingData: vi.fn(),
      ingestFromResults: vi.fn(),
      query: vi.fn(),
      count: vi.fn(),
    } as unknown as FeatureStoreService;

    pipeline = new TrainingPipeline(
      { minSamples: 10, testSplitRatio: 0.2 },
      { featureStore: mockFeatureStore, registry }
    );
  });

  it("rejects when samples are below minimum", async () => {
    vi.mocked(mockFeatureStore.getTrainingData).mockResolvedValue(makePairs(3));

    const result = await pipeline.run("org-1", "pressure_drop");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Insufficient samples");
  });

  it("runs full 7-step pipeline successfully", async () => {
    vi.mocked(mockFeatureStore.getTrainingData).mockResolvedValue(makePairs(20));

    const result = await pipeline.run("org-1", "pressure_drop");

    expect(result.success).toBe(true);
    expect(result.modelVersion).toBe(1);
    expect(result.steps).toHaveLength(7);
    expect(result.steps.map((s) => s.step)).toEqual([
      "load_features",
      "normalize",
      "split",
      "train",
      "evaluate",
      "save_artifact",
      "emit_event",
    ]);
  });

  it("produces evaluation report with test metrics", async () => {
    vi.mocked(mockFeatureStore.getTrainingData).mockResolvedValue(makePairs(25));

    const result = await pipeline.run("org-1", "efficiency");

    expect(result.evaluation).not.toBeNull();
    expect(result.evaluation!.testSampleCount).toBe(5); // 25 * 0.2
    expect(typeof result.evaluation!.testR2).toBe("number");
    expect(typeof result.evaluation!.testMse).toBe("number");
    expect(typeof result.evaluation!.overfit).toBe("boolean");
  });

  it("increments version on repeated training", async () => {
    vi.mocked(mockFeatureStore.getTrainingData).mockResolvedValue(makePairs(15));

    const r1 = await pipeline.run("org-1", "convergence");
    const r2 = await pipeline.run("org-1", "convergence");

    expect(r1.modelVersion).toBe(1);
    expect(r2.modelVersion).toBe(2);
  });

  it("runAll trains all configured model types", async () => {
    vi.mocked(mockFeatureStore.getTrainingData).mockResolvedValue(makePairs(12));

    const results = await pipeline.runAll("org-1");

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.map((r) => r.modelType)).toEqual([
      "pressure_drop",
      "convergence",
      "efficiency",
    ]);
  });
});
