import { describe, it, expect } from "vitest";
import { ISOClassifier, computeTrend } from "./iso-classifier";
import type { CleanroomSample } from "./iso-classifier";

function makeSample(overrides: Partial<CleanroomSample> = {}): CleanroomSample {
  return {
    timestamp: Date.now(),
    airChangeRate: 50,
    particleRetention: 0.98,
    laminarStability: 0.92,
    ...overrides,
  };
}

describe("computeTrend", () => {
  it("returns zero slope for constant values", () => {
    const result = computeTrend([5, 5, 5, 5]);
    expect(result.slope).toBe(0);
    expect(result.mean).toBe(5);
    expect(result.volatility).toBe(0);
  });

  it("returns positive slope for increasing values", () => {
    const result = computeTrend([1, 2, 3, 4, 5]);
    expect(result.slope).toBeGreaterThan(0);
  });

  it("handles empty array", () => {
    const result = computeTrend([]);
    expect(result.mean).toBe(0);
  });
});

describe("ISOClassifier", () => {
  it("classifies high-quality cleanroom as low ISO class", () => {
    const classifier = new ISOClassifier();
    const samples = Array.from({ length: 10 }, () =>
      makeSample({ particleRetention: 0.999, laminarStability: 0.95, airChangeRate: 60 })
    );
    const result = classifier.loadSamples(samples);
    expect(result.isoClass).toBeLessThanOrEqual(4);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.laminarPenalty).toBe(0);
    expect(result.acrPenalty).toBe(0);
  });

  it("penalises low laminar stability", () => {
    const classifier = new ISOClassifier();
    const samples = Array.from({ length: 10 }, () =>
      makeSample({ particleRetention: 0.99, laminarStability: 0.55, airChangeRate: 50 })
    );
    const result = classifier.loadSamples(samples);
    expect(result.laminarPenalty).toBe(2);
    expect(result.isoClass).toBeGreaterThan(3);
  });

  it("penalises low air change rate", () => {
    const classifier = new ISOClassifier();
    const samples = Array.from({ length: 10 }, () =>
      makeSample({ airChangeRate: 15, laminarStability: 0.92 })
    );
    const result = classifier.loadSamples(samples);
    expect(result.acrPenalty).toBe(1);
  });

  it("applies trend bonus for improving retention", () => {
    const classifier = new ISOClassifier();
    const samples = Array.from({ length: 10 }, (_, i) =>
      makeSample({ particleRetention: 0.95 + i * 0.005, laminarStability: 0.92 })
    );
    const result = classifier.loadSamples(samples);
    expect(result.trendAdjustment).toBe(-1);
    expect(result.reasoning.some((r) => r.includes("bonus"))).toBe(true);
  });

  it("classifyZones handles multiple zones", () => {
    const zones = {
      "Zone A": Array.from({ length: 8 }, () => makeSample({ particleRetention: 0.999 })),
      "Zone B": Array.from({ length: 8 }, () => makeSample({ particleRetention: 0.90, laminarStability: 0.5 })),
    };
    const results = ISOClassifier.classifyZones(zones);
    expect(results["Zone A"].isoClass).toBeLessThan(results["Zone B"].isoClass);
  });

  it("addSample incrementally updates classification", () => {
    const classifier = new ISOClassifier();
    expect(classifier.getClassification()).toBeNull();
    classifier.addSample(makeSample());
    expect(classifier.getClassification()).not.toBeNull();
  });
});
