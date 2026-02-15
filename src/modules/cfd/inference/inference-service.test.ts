import { describe, it, expect, beforeEach } from "vitest";
import { InferenceService } from "./inference-service";
import { ModelRegistry } from "../ml-models/model-registry";
import { InMemoryModelRegistry } from "@/packages/model-registry";
import type { FeatureVector } from "@/packages/types";

// ── Helpers ───────────────────────────────────────────────────────────────

const baseInput: FeatureVector = {
  reynoldsNumber: 50000,
  turbulenceIntensity: 0.05,
  pressureDrop: 120,
  efficiency: 0.75,
  meshQualityScore: 0.85,
  convergenceSpeed: 0.7,
};

async function seedModel(registry: ModelRegistry, orgId: string, modelType: "convergence" | "efficiency") {
  await registry.saveVersion(
    orgId,
    modelType,
    {
      coefficients: [0.1, -0.05, 0.02, 0.01, 0.03, 0.04],
      intercept: 0.5,
      featureNames: ["a", "b", "c", "d", "e", "f"],
    },
    {
      mean: [50000, 0.05, 120, 0.75, 0.85, 0.7],
      std: [20000, 0.03, 50, 0.2, 0.1, 0.3],
      featureNames: ["a", "b", "c", "d", "e", "f"],
    },
    { mse: 0.01, mae: 0.08, r2: 0.9, sampleCount: 50, trainedAt: new Date().toISOString() }
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("InferenceService", () => {
  let service: InferenceService;
  let registry: ModelRegistry;

  beforeEach(() => {
    const inMemory = new InMemoryModelRegistry();
    registry = new ModelRegistry(inMemory);
    service = new InferenceService(registry);
  });

  describe("predictConvergence", () => {
    it("returns fallback when no model exists", async () => {
      const result = await service.predictConvergence("org-1", baseInput);
      expect(result.source).toBe("fallback");
      expect(result.modelVersion).toBeNull();
      expect(result.confidence).toBeLessThan(0.5);
      expect(["likely-converge", "risk-diverge"]).toContain(result.label);
    });

    it("returns model prediction when model exists", async () => {
      await seedModel(registry, "org-1", "convergence");
      const result = await service.predictConvergence("org-1", baseInput);
      expect(result.source).toBe("model");
      expect(result.modelVersion).toBe(1);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe("predictEfficiency", () => {
    it("returns fallback when no model exists", async () => {
      const result = await service.predictEfficiency("org-1", baseInput);
      expect(result.source).toBe("fallback");
      expect(result.modelVersion).toBeNull();
      expect(["Excellent", "Good", "Average", "Poor"]).toContain(result.label);
    });

    it("returns model prediction when model exists", async () => {
      await seedModel(registry, "org-1", "efficiency");
      const result = await service.predictEfficiency("org-1", baseInput);
      expect(result.source).toBe("model");
      expect(result.modelVersion).toBe(1);
    });
  });

  describe("recommendTurbulenceModel", () => {
    it("recommends SA for low Reynolds number", async () => {
      const lowRe = { ...baseInput, reynoldsNumber: 5000 };
      const result = await service.recommendTurbulenceModel("org-1", lowRe);
      expect(result.recommended).toBe("spalart-allmaras");
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    it("recommends k-ω SST for high Re + good mesh", async () => {
      const highRe = { ...baseInput, reynoldsNumber: 2e6, meshQualityScore: 0.9 };
      const result = await service.recommendTurbulenceModel("org-1", highRe);
      expect(result.recommended).toBe("k-omega-sst");
    });

    it("recommends RNG k-ε for high Re + poor mesh", async () => {
      const highRePoorMesh = { ...baseInput, reynoldsNumber: 2e6, meshQualityScore: 0.4 };
      const result = await service.recommendTurbulenceModel("org-1", highRePoorMesh);
      expect(result.recommended).toBe("k-epsilon-rng");
    });

    it("recommends k-ε for moderate Re + high TI", async () => {
      const highTI = { ...baseInput, reynoldsNumber: 50000, turbulenceIntensity: 0.2 };
      const result = await service.recommendTurbulenceModel("org-1", highTI);
      expect(result.recommended).toBe("k-epsilon");
    });

    it("boosts confidence when surrogate models exist", async () => {
      const fallbackResult = await service.recommendTurbulenceModel("org-1", baseInput);

      await seedModel(registry, "org-1", "convergence");
      await seedModel(registry, "org-1", "efficiency");
      service.invalidateCache("org-1");

      const boostedResult = await service.recommendTurbulenceModel("org-1", baseInput);
      expect(boostedResult.confidence).toBeGreaterThanOrEqual(fallbackResult.confidence);
      expect(boostedResult.source).toBe("model");
    });
  });

  describe("cache", () => {
    it("invalidateCache clears org-specific cache", async () => {
      await seedModel(registry, "org-1", "convergence");
      await service.predictConvergence("org-1", baseInput);

      service.invalidateCache("org-1");
      // Should re-fetch from registry (still returns model)
      const result = await service.predictConvergence("org-1", baseInput);
      expect(result.source).toBe("model");
    });
  });
});
