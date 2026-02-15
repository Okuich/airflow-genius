// ─── packages/model-registry/model-registry ─────────────────────────────────
// Abstract interface for the ML Model Registry.
// Implementations can back this with Supabase, in-memory, etc.
// ─────────────────────────────────────────────────────────────────────────────

import type { SurrogateModelType } from "@/packages/types";
import type { ModelVersion, SaveVersionOptions } from "./types";

/**
 * Platform-agnostic model registry contract.
 *
 * Responsibilities:
 *   • Store and retrieve versioned surrogate model weights
 *   • Activate/deactivate model versions per org + type
 *   • Provide version history for auditability
 */
export interface IModelRegistry {
  /** Get the currently active model for a given org and type. */
  getActiveModel(
    orgId: string,
    modelType: SurrogateModelType
  ): Promise<ModelVersion | null>;

  /**
   * Save a new model version. Automatically increments the version number
   * and deactivates previous versions of the same type.
   */
  saveVersion(options: SaveVersionOptions): Promise<ModelVersion>;

  /** List all versions for an org/model type (newest first). */
  listVersions(
    orgId: string,
    modelType: SurrogateModelType
  ): Promise<ModelVersion[]>;
}
