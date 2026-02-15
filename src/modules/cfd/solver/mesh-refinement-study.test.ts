import { describe, it, expect, beforeEach } from "vitest";
import {
  MeshRefinementStudy,
  type RichardsonExtrapolation,
} from "./mesh-refinement-study";
import type { MeshSettings } from "@/packages/types";

// ── Fixtures ──────────────────────────────────────────────────────────────

const baseMesh: MeshSettings = {
  baseSize: 0.01,
  minSize: 0.001,
  maxSize: 0.1,
  refinementLevels: 3,
  boundaryLayerCount: 5,
  boundaryLayerGrowthRate: 1.2,
  targetCellCount: 500_000,
  featureAngle: 30,
  qualityThreshold: 0.85,
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe("MeshRefinementStudy", () => {
  let study: MeshRefinementStudy;

  beforeEach(() => {
    study = new MeshRefinementStudy({
      refinementRatio: Math.SQRT2,
      gciThresholdPercent: 3.0,
      safetyFactor: 1.25,
    });
  });

  describe("scaleMeshSettings", () => {
    it("coarsens mesh by increasing cell sizes", () => {
      const coarse = study.scaleMeshSettings(baseMesh, 500_000, 250_000);
      expect(coarse.targetCellCount).toBe(250_000);
      expect(coarse.baseSize).toBeGreaterThan(baseMesh.baseSize);
      expect(coarse.minSize).toBeGreaterThan(baseMesh.minSize);
    });

    it("refines mesh by decreasing cell sizes", () => {
      const fine = study.scaleMeshSettings(baseMesh, 500_000, 1_000_000);
      expect(fine.targetCellCount).toBe(1_000_000);
      expect(fine.baseSize).toBeLessThan(baseMesh.baseSize);
      expect(fine.minSize).toBeLessThan(baseMesh.minSize);
    });

    it("preserves non-size settings", () => {
      const scaled = study.scaleMeshSettings(baseMesh, 500_000, 750_000);
      expect(scaled.refinementLevels).toBe(baseMesh.refinementLevels);
      expect(scaled.boundaryLayerCount).toBe(baseMesh.boundaryLayerCount);
      expect(scaled.qualityThreshold).toBe(baseMesh.qualityThreshold);
    });

    it("returns identical sizes when target equals base", () => {
      const same = study.scaleMeshSettings(baseMesh, 500_000, 500_000);
      expect(same.baseSize).toBeCloseTo(baseMesh.baseSize, 10);
      expect(same.minSize).toBeCloseTo(baseMesh.minSize, 10);
    });
  });

  describe("computeRichardsonExtrapolation", () => {
    it("computes second-order convergence for quadratic data", () => {
      // f(h) = 1 + h² pattern: coarse=1.04, medium=1.02, fine=1.01
      const r = Math.SQRT2;
      const result = study.computeRichardsonExtrapolation(1.04, 1.02, 1.01, r);
      expect(result.order).toBeGreaterThanOrEqual(1);
      expect(result.order).toBeLessThanOrEqual(5);
      expect(result.exactEstimate).toBeDefined();
      expect(result.gciFine).toBeGreaterThanOrEqual(0);
    });

    it("reports low GCI when solutions are nearly identical", () => {
      const result = study.computeRichardsonExtrapolation(10.001, 10.0005, 10.0001, Math.SQRT2);
      expect(result.gciFine).toBeLessThan(1);
    });

    it("reports high GCI when solutions differ significantly", () => {
      const result = study.computeRichardsonExtrapolation(8.0, 9.5, 10.0, Math.SQRT2);
      expect(result.gciFine).toBeGreaterThan(1);
    });

    it("handles identical metrics (fully converged)", () => {
      const result = study.computeRichardsonExtrapolation(5.0, 5.0, 5.0, Math.SQRT2);
      expect(result.order).toBe(2); // fallback
      expect(result.gciFine).toBe(0);
    });

    it("handles oscillatory convergence gracefully", () => {
      // f values oscillate: coarse=10.1, medium=9.9, fine=10.05
      const result = study.computeRichardsonExtrapolation(10.1, 9.9, 10.05, Math.SQRT2);
      expect(result.order).toBeGreaterThanOrEqual(0.5);
      expect(result.gciFine).toBeGreaterThan(0);
    });

    it("clamps convergence order to [0.5, 5]", () => {
      // Extremely steep convergence
      const result = study.computeRichardsonExtrapolation(100, 10.1, 10.0, Math.SQRT2);
      expect(result.order).toBeLessThanOrEqual(5);
      expect(result.order).toBeGreaterThanOrEqual(0.5);
    });

    it("checks asymptotic range", () => {
      // Consistent second-order: differences scale as r²
      const r = 2;
      // h_coarse=2h, h_medium=h, h_fine=h/2 → differences 4:1
      const result = study.computeRichardsonExtrapolation(1.16, 1.04, 1.01, r);
      expect(typeof result.inAsymptoticRange).toBe("boolean");
    });
  });
});
