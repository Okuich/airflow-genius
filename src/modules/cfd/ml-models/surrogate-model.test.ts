import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ConvergencePredictor,
  EfficiencyPredictor,
  TurbulenceRecommendationModel,
  type Prediction,
  type TrainingData,
} from "./surrogate-model";
import type { FeatureVector } from "@/packages/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeFeatureVector(overrides?: Partial<FeatureVector>): FeatureVector {
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

// ── ConvergencePredictor ────────────────────────────────────────────────────

describe("ConvergencePredictor", () => {
  it("returns no-model prediction when weights are not loaded", () => {
    const predictor = new ConvergencePredictor("org-1");
    const result = predictor.predict(makeFeatureVector());
    expect(result.label).toBe("no-model");
    expect(result.confidence).toBe(0);
  });

  it("implements SurrogateModel interface", () => {
    const predictor = new ConvergencePredictor("org-1");
    expect(predictor.version).toBeDefined();
    expect(typeof predictor.predict).toBe("function");
    expect(typeof predictor.train).toBe("function");
  });

  it("has convergence model type", () => {
    const predictor = new ConvergencePredictor("org-1");
    expect(predictor.modelType).toBe("convergence");
  });
});

// ── EfficiencyPredictor ─────────────────────────────────────────────────────

describe("EfficiencyPredictor", () => {
  it("returns no-model prediction when weights are not loaded", () => {
    const predictor = new EfficiencyPredictor("org-1");
    const result = predictor.predict(makeFeatureVector());
    expect(result.label).toBe("no-model");
    expect(result.confidence).toBe(0);
  });

  it("implements SurrogateModel interface", () => {
    const predictor = new EfficiencyPredictor("org-1");
    expect(predictor.version).toBeDefined();
    expect(typeof predictor.predict).toBe("function");
    expect(typeof predictor.train).toBe("function");
  });

  it("has efficiency model type", () => {
    const predictor = new EfficiencyPredictor("org-1");
    expect(predictor.modelType).toBe("efficiency");
  });
});

// ── TurbulenceRecommendationModel ───────────────────────────────────────────

describe("TurbulenceRecommendationModel", () => {
  it("recommends spalart-allmaras for low Re", () => {
    const model = new TurbulenceRecommendationModel("org-1");
    const result = model.predict(makeFeatureVector({ reynoldsNumber: 5000 }));
    expect(result.recommendedModel).toBe("spalart-allmaras");
    expect(result.reasoning).toContain("Low Reynolds");
  });

  it("recommends k-omega-sst for high Re with good mesh", () => {
    const model = new TurbulenceRecommendationModel("org-1");
    const result = model.predict(makeFeatureVector({ reynoldsNumber: 2e6, meshQualityScore: 0.9 }));
    expect(result.recommendedModel).toBe("k-omega-sst");
  });

  it("recommends k-epsilon-rng for high Re with poor mesh", () => {
    const model = new TurbulenceRecommendationModel("org-1");
    const result = model.predict(makeFeatureVector({ reynoldsNumber: 2e6, meshQualityScore: 0.4 }));
    expect(result.recommendedModel).toBe("k-epsilon-rng");
  });

  it("recommends k-epsilon for mid Re with high turbulence intensity", () => {
    const model = new TurbulenceRecommendationModel("org-1");
    const result = model.predict(makeFeatureVector({ reynoldsNumber: 1e5, turbulenceIntensity: 0.15 }));
    expect(result.recommendedModel).toBe("k-epsilon");
  });

  it("recommends k-omega-sst for mid Re with low turbulence intensity", () => {
    const model = new TurbulenceRecommendationModel("org-1");
    const result = model.predict(makeFeatureVector({ reynoldsNumber: 1e5, turbulenceIntensity: 0.03 }));
    expect(result.recommendedModel).toBe("k-omega-sst");
  });

  it("has confidence between 0 and 1", () => {
    const model = new TurbulenceRecommendationModel("org-1");
    const result = model.predict(makeFeatureVector());
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("provides reasoning string", () => {
    const model = new TurbulenceRecommendationModel("org-1");
    const result = model.predict(makeFeatureVector());
    expect(result.reasoning.length).toBeGreaterThan(10);
  });

  it("implements SurrogateModel interface", () => {
    const model = new TurbulenceRecommendationModel("org-1");
    expect(model.version).toBe("1.0.0-heuristic");
    expect(typeof model.predict).toBe("function");
    expect(typeof model.train).toBe("function");
  });
});
