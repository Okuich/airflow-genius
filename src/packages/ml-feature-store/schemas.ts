// ─── packages/ml-feature-store/schemas ──────────────────────────────────────
// Zod-validated, versioned feature-vector schemas.
//
// Each schema version is registered in SCHEMA_REGISTRY so the store can
// validate incoming vectors against the correct version at ingest time.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";
import type { SurrogateModelType } from "@/packages/types";

// ── v1 Schema ──────────────────────────────────────────────────────────────

export const cfdFeatureVectorV1Schema = z.object({
  reynoldsNumber: z
    .number({ required_error: "reynoldsNumber is required" })
    .nonnegative("reynoldsNumber must be ≥ 0"),
  turbulenceIntensity: z
    .number({ required_error: "turbulenceIntensity is required" })
    .min(0, "turbulenceIntensity must be ≥ 0")
    .max(1, "turbulenceIntensity must be ≤ 1"),
  meshQualityScore: z
    .number({ required_error: "meshQualityScore is required" })
    .min(0, "meshQualityScore must be ≥ 0")
    .max(1, "meshQualityScore must be ≤ 1"),
  rpm: z.number().nonnegative().optional(),
  pressureDrop: z.number().optional(),
  efficiency: z.number().min(0).max(1).optional(),
  convergenceIterations: z
    .number({ required_error: "convergenceIterations is required" })
    .int("convergenceIterations must be an integer")
    .nonnegative("convergenceIterations must be ≥ 0"),
});

/** Inferred TypeScript type from the v1 schema. */
export type CFDFeatureVector = z.infer<typeof cfdFeatureVectorV1Schema>;

// ── v2 Schema (example extension — adds boundary layer fields) ─────────

export const cfdFeatureVectorV2Schema = cfdFeatureVectorV1Schema.extend({
  boundaryLayerThickness: z.number().nonnegative().optional(),
  wallYPlus: z.number().nonnegative().optional(),
});

export type CFDFeatureVectorV2 = z.infer<typeof cfdFeatureVectorV2Schema>;

// ── Schema Registry ────────────────────────────────────────────────────────

export type SchemaVersion = "v1" | "v2";

const SCHEMA_REGISTRY: Record<SchemaVersion, z.ZodType<CFDFeatureVector>> = {
  v1: cfdFeatureVectorV1Schema,
  v2: cfdFeatureVectorV2Schema,
};

/**
 * Validate a raw feature vector against a specific schema version.
 * Throws a `ZodError` with detailed field-level messages on failure.
 */
export function validateFeatureVector(
  data: unknown,
  version: SchemaVersion = "v1"
): CFDFeatureVector {
  const schema = SCHEMA_REGISTRY[version];
  if (!schema) throw new Error(`Unknown schema version: ${version}`);
  return schema.parse(data);
}

/**
 * Safe variant — returns `{ success, data, error }` without throwing.
 */
export function safeValidateFeatureVector(
  data: unknown,
  version: SchemaVersion = "v1"
): z.SafeParseReturnType<unknown, CFDFeatureVector> {
  const schema = SCHEMA_REGISTRY[version];
  if (!schema) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["version"],
          message: `Unknown schema version: ${version}`,
        },
      ]),
    } as z.SafeParseReturnType<unknown, CFDFeatureVector>;
  }
  return schema.safeParse(data);
}

// ── Model-type feature keys ────────────────────────────────────────────────

/**
 * Maps each model type to the feature-vector keys most relevant for that model.
 * Useful for filtering / selecting columns before training.
 */
export const MODEL_TYPE_FEATURES: Record<SurrogateModelType, (keyof CFDFeatureVector)[]> = {
  pressure_drop: [
    "reynoldsNumber",
    "turbulenceIntensity",
    "meshQualityScore",
    "rpm",
    "pressureDrop",
  ],
  convergence: [
    "reynoldsNumber",
    "turbulenceIntensity",
    "meshQualityScore",
    "convergenceIterations",
  ],
  efficiency: [
    "reynoldsNumber",
    "turbulenceIntensity",
    "meshQualityScore",
    "rpm",
    "efficiency",
  ],
};

/**
 * Convert a CFDFeatureVector to a flat numeric array, filling optional fields
 * with 0. Deterministic ordering matches the v1 schema field order.
 */
export function cfdFeatureToArray(fv: CFDFeatureVector): number[] {
  return [
    fv.reynoldsNumber,
    fv.turbulenceIntensity,
    fv.meshQualityScore,
    fv.rpm ?? 0,
    fv.pressureDrop ?? 0,
    fv.efficiency ?? 0,
    fv.convergenceIterations,
  ];
}
