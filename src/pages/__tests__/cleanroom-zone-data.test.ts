import { describe, it, expect } from "vitest";

// Reproduce the zone data generation logic from CleanroomMetrics
const ZONE_RAW = [
  { zone: "Zone A", overrides: { airChangeRate: 52, particleRetention: 0.99, laminarStability: 0.94 } },
  { zone: "Zone B", overrides: { airChangeRate: 38, particleRetention: 0.92, laminarStability: 0.78 } },
  { zone: "Zone C", overrides: { airChangeRate: 61, particleRetention: 0.998, laminarStability: 0.97 } },
  { zone: "Zone D", overrides: { airChangeRate: 45, particleRetention: 0.96, laminarStability: 0.88 } },
];

function generateZoneSamples(overrides: { airChangeRate: number; particleRetention: number; laminarStability: number }) {
  return Array.from({ length: 12 }, (_, i) => ({
    timestamp: Date.now() - (11 - i) * 3600_000,
    airChangeRate: overrides.airChangeRate + (Math.random() - 0.5) * 4,
    particleRetention: Math.min(1, Math.max(0, overrides.particleRetention + (Math.random() - 0.5) * 0.01)),
    laminarStability: Math.min(1, Math.max(0, overrides.laminarStability + (Math.random() - 0.5) * 0.03)),
  }));
}

describe("Zone data generation", () => {
  // Run multiple iterations to catch probabilistic edge cases
  const ITERATIONS = 200;

  for (const z of ZONE_RAW) {
    describe(`${z.zone}`, () => {
      it(`particleRetention stays within [0, 1] over ${ITERATIONS} batches`, () => {
        for (let i = 0; i < ITERATIONS; i++) {
          const samples = generateZoneSamples(z.overrides as any);
          for (const s of samples) {
            expect(s.particleRetention).toBeGreaterThanOrEqual(0);
            expect(s.particleRetention).toBeLessThanOrEqual(1);
          }
        }
      });

      it(`laminarStability stays within [0, 1] over ${ITERATIONS} batches`, () => {
        for (let i = 0; i < ITERATIONS; i++) {
          const samples = generateZoneSamples(z.overrides as any);
          for (const s of samples) {
            expect(s.laminarStability).toBeGreaterThanOrEqual(0);
            expect(s.laminarStability).toBeLessThanOrEqual(1);
          }
        }
      });
    });
  }
});
