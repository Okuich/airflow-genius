// ─── packages/model-registry/types ──────────────────────────────────────────
// Platform-agnostic type definitions for the ML Model Registry.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SurrogateModelType,
  SurrogateModelWeights,
  SurrogateModelMetrics,
  NormalizationParams,
} from "@/packages/types";

/** A single versioned model record. */
export interface ModelVersion {
  id: string;
  organizationId: string;
  modelType: SurrogateModelType;
  version: number;
  weights: SurrogateModelWeights;
  normalization: NormalizationParams;
  metrics: SurrogateModelMetrics;
  isActive: boolean;
  createdAt: string;
}

/** Options for saving a new model version. */
export interface SaveVersionOptions {
  organizationId: string;
  modelType: SurrogateModelType;
  weights: SurrogateModelWeights;
  normalization: NormalizationParams;
  metrics: SurrogateModelMetrics;
}

/** High-level metadata describing a registered model (UI / audit). */
export interface ModelMetadata {
  id: string;
  version: string;
  type: "Convergence" | "Efficiency" | "Turbulence";
  trainedAt: Date;
  datasetSize: number;
  validationScore: number;
  deployed: boolean;
}
