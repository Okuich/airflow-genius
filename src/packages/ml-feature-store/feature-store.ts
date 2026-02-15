// ─── packages/ml-feature-store/feature-store ────────────────────────────────
// Abstract interface for the ML Feature Store.
// Implementations can back this with Supabase, Postgres, in-memory, etc.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  FeatureStoreEntry,
  FeatureQuery,
  TrainingPair,
  IngestOptions,
} from "./types";

/**
 * Platform-agnostic feature store contract.
 *
 * Responsibilities:
 *   • Persist versioned feature vectors with geometry cluster tags
 *   • Query entries by org, cluster, version
 *   • Produce training-ready (features, target) pairs for ML pipelines
 *   • Count entries for threshold checks
 */
export interface IFeatureStore {
  /** Persist a feature vector entry. Returns the stored entry ID. */
  ingest(options: IngestOptions): Promise<string>;

  /** Query feature-vector entries with optional filtering. */
  query(options: FeatureQuery): Promise<FeatureStoreEntry[]>;

  /**
   * Retrieve training-ready pairs for a given target label.
   * Filters out entries where the target label is null/undefined.
   */
  getTrainingData(
    orgId: string,
    targetLabel: string,
    options?: { geometryCluster?: FeatureQuery["geometryCluster"]; limit?: number }
  ): Promise<TrainingPair[]>;

  /** Count entries for an organization. */
  count(orgId: string): Promise<number>;
}
