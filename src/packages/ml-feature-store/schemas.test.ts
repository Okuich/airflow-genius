import { describe, it, expect } from "vitest";
import {
  validateFeatureVector,
  safeValidateFeatureVector,
  cfdFeatureToArray,
  MODEL_TYPE_FEATURES,
  type CFDFeatureVector,
} from "./schemas";

const validVector: CFDFeatureVector = {
  reynoldsNumber: 50000,
  turbulenceIntensity: 0.05,
  meshQualityScore: 0.85,
  rpm: 1500,
  pressureDrop: 120.5,
  efficiency: 0.78,
  convergenceIterations: 200,
};

describe("CFDFeatureVector schemas", () => {
  describe("validateFeatureVector", () => {
    it("accepts a valid v1 vector", () => {
      const result = validateFeatureVector(validVector, "v1");
      expect(result.reynoldsNumber).toBe(50000);
    });

    it("accepts minimal required fields", () => {
      const result = validateFeatureVector({
        reynoldsNumber: 1000,
        turbulenceIntensity: 0.1,
        meshQualityScore: 0.5,
        convergenceIterations: 50,
      });
      expect(result.rpm).toBeUndefined();
    });

    it("rejects negative reynoldsNumber", () => {
      expect(() =>
        validateFeatureVector({ ...validVector, reynoldsNumber: -1 })
      ).toThrow();
    });

    it("rejects turbulenceIntensity > 1", () => {
      expect(() =>
        validateFeatureVector({ ...validVector, turbulenceIntensity: 1.5 })
      ).toThrow();
    });

    it("rejects non-integer convergenceIterations", () => {
      expect(() =>
        validateFeatureVector({ ...validVector, convergenceIterations: 10.5 })
      ).toThrow();
    });

    it("rejects missing required fields", () => {
      expect(() =>
        validateFeatureVector({ reynoldsNumber: 100 })
      ).toThrow();
    });
  });

  describe("safeValidateFeatureVector", () => {
    it("returns success for valid input", () => {
      const result = safeValidateFeatureVector(validVector);
      expect(result.success).toBe(true);
    });

    it("returns error details for invalid input", () => {
      const result = safeValidateFeatureVector({ reynoldsNumber: "bad" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe("v2 schema", () => {
    it("accepts v2 fields", () => {
      const result = validateFeatureVector(
        { ...validVector, boundaryLayerThickness: 0.01, wallYPlus: 1.2 },
        "v2"
      );
      expect(result).toBeDefined();
    });
  });

  describe("cfdFeatureToArray", () => {
    it("converts to deterministic array", () => {
      const arr = cfdFeatureToArray(validVector);
      expect(arr).toEqual([50000, 0.05, 0.85, 1500, 120.5, 0.78, 200]);
    });

    it("fills optional fields with 0", () => {
      const arr = cfdFeatureToArray({
        reynoldsNumber: 1000,
        turbulenceIntensity: 0.1,
        meshQualityScore: 0.5,
        convergenceIterations: 50,
      });
      expect(arr).toEqual([1000, 0.1, 0.5, 0, 0, 0, 50]);
    });
  });

  describe("MODEL_TYPE_FEATURES", () => {
    it("maps all three model types", () => {
      expect(Object.keys(MODEL_TYPE_FEATURES)).toEqual([
        "pressure_drop",
        "convergence",
        "efficiency",
      ]);
    });

    it("each model type has relevant keys", () => {
      expect(MODEL_TYPE_FEATURES.convergence).toContain("convergenceIterations");
      expect(MODEL_TYPE_FEATURES.pressure_drop).toContain("pressureDrop");
      expect(MODEL_TYPE_FEATURES.efficiency).toContain("efficiency");
    });
  });
});
