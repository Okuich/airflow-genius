// ─── Step 6: Model Versioning ──────────────────────────────────────────────
// Manages surrogate model versions — local cache + DB sync.
// ──────────────────────────────────────────────────────────────────────────

import type {
  SurrogateModelType,
  SurrogateModelVersion,
  SurrogateModelWeights,
  SurrogateModelMetrics,
  NormalizationParams,
} from "@/packages/types";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

const LOCAL_CACHE_KEY = "flowforge_ml_models";

interface CachedModels {
  models: SurrogateModelVersion[];
  syncedAt: string;
}

export class ModelVersionManager {
  private cache: Map<string, SurrogateModelVersion> = new Map();

  /** Get the active model for a given type and org. */
  async getActiveModel(
    orgId: string,
    modelType: SurrogateModelType
  ): Promise<SurrogateModelVersion | null> {
    const cacheKey = `${orgId}:${modelType}`;

    // Check in-memory cache first
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    // Check localStorage
    const local = this.loadFromLocal(orgId, modelType);
    if (local) {
      this.cache.set(cacheKey, local);
      return local;
    }

    // Fetch from DB
    const { data, error } = await supabase
      .from("ml_model_versions")
      .select("*")
      .eq("organization_id", orgId)
      .eq("model_type", modelType)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    const model = this.rowToModel(data);
    this.cache.set(cacheKey, model);
    this.saveToLocal(orgId, model);
    return model;
  }

  /** Save a new model version (increments version number). */
  async saveVersion(
    orgId: string,
    modelType: SurrogateModelType,
    weights: SurrogateModelWeights,
    normalization: NormalizationParams,
    metrics: SurrogateModelMetrics
  ): Promise<SurrogateModelVersion> {
    // Get current max version
    const { data: existing } = await supabase
      .from("ml_model_versions")
      .select("version")
      .eq("organization_id", orgId)
      .eq("model_type", modelType)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = (existing?.[0]?.version ?? 0) + 1;

    // Deactivate previous versions
    await supabase
      .from("ml_model_versions")
      .update({ is_active: false } as Record<string, unknown>)
      .eq("organization_id", orgId)
      .eq("model_type", modelType);

    // Insert new version
    const { data, error } = await supabase
      .from("ml_model_versions")
      .insert([{
        organization_id: orgId,
        model_type: modelType,
        version: nextVersion,
        weights: JSON.parse(JSON.stringify(weights)) as Json,
        normalization: JSON.parse(JSON.stringify(normalization)) as Json,
        metrics: JSON.parse(JSON.stringify(metrics)) as Json,
        training_sample_count: metrics.sampleCount,
        is_active: true,
      }])
      .select()
      .single();

    if (error) throw new Error(`Failed to save model version: ${error.message}`);

    const model = this.rowToModel(data);
    const cacheKey = `${orgId}:${modelType}`;
    this.cache.set(cacheKey, model);
    this.saveToLocal(orgId, model);

    return model;
  }

  /** List all versions for an org/model type. */
  async listVersions(orgId: string, modelType: SurrogateModelType): Promise<SurrogateModelVersion[]> {
    const { data, error } = await supabase
      .from("ml_model_versions")
      .select("*")
      .eq("organization_id", orgId)
      .eq("model_type", modelType)
      .order("version", { ascending: false });

    if (error) throw new Error(`Failed to list model versions: ${error.message}`);
    return (data ?? []).map(this.rowToModel);
  }

  // ── Local Storage ───────────────────────────────────────────────────

  private loadFromLocal(orgId: string, modelType: SurrogateModelType): SurrogateModelVersion | null {
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      if (!raw) return null;
      const cached: CachedModels = JSON.parse(raw);
      return cached.models.find(
        (m) => m.organizationId === orgId && m.modelType === modelType && m.isActive
      ) ?? null;
    } catch { return null; }
  }

  private saveToLocal(orgId: string, model: SurrogateModelVersion): void {
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      const cached: CachedModels = raw ? JSON.parse(raw) : { models: [], syncedAt: "" };

      // Replace or add
      const idx = cached.models.findIndex(
        (m) => m.organizationId === orgId && m.modelType === model.modelType
      );
      if (idx >= 0) cached.models[idx] = model;
      else cached.models.push(model);

      cached.syncedAt = new Date().toISOString();
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cached));
    } catch { /* localStorage unavailable */ }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private rowToModel(row: Record<string, unknown>): SurrogateModelVersion {
    return {
      id: row.id as string,
      organizationId: row.organization_id as string,
      modelType: row.model_type as SurrogateModelType,
      version: row.version as number,
      weights: row.weights as SurrogateModelWeights,
      normalization: row.normalization as NormalizationParams,
      metrics: row.metrics as SurrogateModelMetrics,
      isActive: row.is_active as boolean,
      createdAt: row.created_at as string,
    };
  }
}
