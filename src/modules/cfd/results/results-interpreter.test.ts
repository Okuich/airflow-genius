import { describe, it, expect } from "vitest";
import {
  CFDResultsInterpreter,
  computeFieldStats,
  detectSeparationZones,
  rateEfficiency,
  computePressureLoss,
  type VelocityFieldEntry,
  type PressureFieldEntry,
  type TemperatureFieldEntry,
  type EfficiencyMetrics,
} from "@/modules/cfd/results";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeVelocity(magnitudes: number[]): VelocityFieldEntry[] {
  return magnitudes.map((m, i) => ({
    position: { x: i, y: 0, z: 0 },
    magnitude: m,
    components: { u: m, v: 0, w: 0 },
  }));
}

function makePressure(statics: number[], totals?: number[]): PressureFieldEntry[] {
  return statics.map((s, i) => ({
    position: { x: i, y: 0, z: 0 },
    staticPressure: s,
    totalPressure: totals ? totals[i] : s + 50,
  }));
}

function makeTemperature(temps: number[]): TemperatureFieldEntry[] {
  return temps.map((t, i) => ({
    position: { x: i, y: 0, z: 0 },
    temperature: t,
  }));
}

const baseMetrics: EfficiencyMetrics = {
  totalPressureRiseOrDrop: 500,
  volumeFlowRate: 2.5,
  shaftPower: 1800,
  inletTotalPressure: 101325,
  outletTotalPressure: 101825,
  inletStaticPressure: 101200,
  outletStaticPressure: 101700,
  massFlowRate: 3.0,
  fluidDensity: 1.2,
};

// ─── computeFieldStats ──────────────────────────────────────────────────────

describe("computeFieldStats", () => {
  it("returns zeros for empty array", () => {
    const stats = computeFieldStats([]);
    expect(stats).toEqual({ min: 0, max: 0, mean: 0, stdDev: 0 });
  });

  it("computes correct stats for uniform values", () => {
    const stats = computeFieldStats([5, 5, 5, 5]);
    expect(stats.min).toBe(5);
    expect(stats.max).toBe(5);
    expect(stats.mean).toBe(5);
    expect(stats.stdDev).toBe(0);
  });

  it("computes correct min, max, mean, stdDev", () => {
    const stats = computeFieldStats([2, 4, 6, 8]);
    expect(stats.min).toBe(2);
    expect(stats.max).toBe(8);
    expect(stats.mean).toBe(5);
    expect(stats.stdDev).toBeCloseTo(2.236, 2);
  });
});

// ─── detectSeparationZones ──────────────────────────────────────────────────

describe("detectSeparationZones", () => {
  it("returns 0 for uniform high-velocity field", () => {
    const field = makeVelocity([10, 12, 11, 10, 13]);
    expect(detectSeparationZones(field)).toBe(0);
  });

  it("detects a single separation zone", () => {
    const field = makeVelocity([10, 12, 0.01, 0.02, 11, 10]);
    expect(detectSeparationZones(field)).toBe(1);
  });

  it("detects multiple separation zones", () => {
    const field = makeVelocity([10, 0.01, 10, 0.02, 10]);
    expect(detectSeparationZones(field)).toBe(2);
  });
});

// ─── rateEfficiency ─────────────────────────────────────────────────────────

describe("rateEfficiency", () => {
  it("rates Excellent for high efficiency", () => {
    const m: EfficiencyMetrics = { ...baseMetrics, shaftPower: 1400 };
    // hydraulic = 2.5 * 500 = 1250, eff = 1250/1400 ≈ 0.893
    expect(rateEfficiency(m)).toBe("Excellent");
  });

  it("rates Good for moderate efficiency", () => {
    const m: EfficiencyMetrics = { ...baseMetrics, shaftPower: 1750 };
    // eff ≈ 1250/1750 ≈ 0.714
    expect(rateEfficiency(m)).toBe("Good");
  });

  it("rates Average for low efficiency", () => {
    const m: EfficiencyMetrics = { ...baseMetrics, shaftPower: 2300 };
    // eff ≈ 1250/2300 ≈ 0.543
    expect(rateEfficiency(m)).toBe("Average");
  });

  it("rates Poor for very low efficiency", () => {
    const m: EfficiencyMetrics = { ...baseMetrics, shaftPower: 4000 };
    // eff ≈ 1250/4000 ≈ 0.3125
    expect(rateEfficiency(m)).toBe("Poor");
  });

  it("falls back to pressure recovery when no shaft power", () => {
    const m: EfficiencyMetrics = { ...baseMetrics, shaftPower: null };
    const result = rateEfficiency(m);
    expect(["Poor", "Average", "Good", "Excellent"]).toContain(result);
  });
});

// ─── computePressureLoss ────────────────────────────────────────────────────

describe("computePressureLoss", () => {
  it("returns absolute difference of inlet/outlet total pressure", () => {
    const field = makePressure([100, 200]);
    const loss = computePressureLoss(field, baseMetrics);
    expect(loss).toBe(500); // |101325 - 101825|
  });
});

// ─── CFDResultsInterpreter (integration) ────────────────────────────────────

describe("CFDResultsInterpreter", () => {
  const interpreter = new CFDResultsInterpreter();

  it("produces a complete summary", () => {
    const vel = makeVelocity([10, 12, 8, 11, 9, 0.01, 10]);
    const pres = makePressure([101200, 101300, 101400, 101500, 101600, 101650, 101700]);
    const temp = makeTemperature([300, 310, 320, 305, 315, 308, 302]);

    const summary = interpreter.interpret(vel, pres, temp, baseMetrics);

    expect(summary.keyFindings.length).toBeGreaterThan(0);
    expect(typeof summary.pressureLossEstimate).toBe("number");
    expect(["Poor", "Average", "Good", "Excellent"]).toContain(summary.efficiencyRating);
    expect(summary.flowSeparationZones).toBeGreaterThanOrEqual(0);
    expect(summary.recommendations.length).toBeGreaterThan(0);
  });

  it("detects separation and adds recommendation", () => {
    const vel = makeVelocity([10, 0.001, 0.002, 10, 0.001, 10]);
    const pres = makePressure([100, 100, 100, 100, 100, 100]);
    const temp: TemperatureFieldEntry[] = [];

    const summary = interpreter.interpret(vel, pres, temp, baseMetrics);

    expect(summary.flowSeparationZones).toBeGreaterThanOrEqual(1);
    expect(summary.recommendations.some((r) => r.toLowerCase().includes("separation"))).toBe(true);
  });

  it("handles empty temperature field gracefully", () => {
    const vel = makeVelocity([10, 12]);
    const pres = makePressure([100, 200]);

    const summary = interpreter.interpret(vel, pres, [], baseMetrics);

    expect(summary.keyFindings.some((f) => f.includes("Temperature"))).toBe(false);
  });
});
