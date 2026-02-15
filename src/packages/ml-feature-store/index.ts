// ─── packages/ml-feature-store ──────────────────────────────────────────────
// Public API for the ML Feature Store package.
// ─────────────────────────────────────────────────────────────────────────────

export type { IFeatureStore } from "./feature-store";
export { SupabaseFeatureStore } from "./supabase-feature-store";
export { InMemoryFeatureStore } from "./in-memory-feature-store";
export type {
  FeatureStoreEntry,
  FeatureQuery,
  TrainingPair,
  IngestOptions,
  GeometryCluster,
} from "./types";
export {
  cfdFeatureVectorV1Schema,
  cfdFeatureVectorV2Schema,
  validateFeatureVector,
  safeValidateFeatureVector,
  cfdFeatureToArray,
  MODEL_TYPE_FEATURES,
} from "./schemas";
export type {
  CFDFeatureVector,
  CFDFeatureVectorV2,
  SchemaVersion,
} from "./schemas";
