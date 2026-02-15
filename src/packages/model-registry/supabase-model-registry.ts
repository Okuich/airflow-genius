// ─── packages/model-registry/supabase-model-registry ─────────────────────────
// Supabase-backed implementation of IModelRegistry.
// ─────────────────────────────────────────────────────────────────────────────

import type { SurrogateModelType } from "@/packages/types";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type { IModelRegistry } from "./model-registry";
import type { ModelVersion, SaveVersionOptions } from "./types";

export class SupabaseModelRegistry implements IModelRegistry {
  private cache = new Map<string, ModelVersion>();

  async getActiveModel(
    orgId: string,
    modelType: SurrogateModelType
  ): Promise<ModelVersion | null> {
    const cacheKey = `${orgId}:${modelType}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

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

    const model = rowToModel(data);
    this.cache.set(cacheKey, model);
    return model;
  }

  async saveVersion(options: SaveVersionOptions): Promise<ModelVersion> {
    const { organizationId: orgId, modelType, weights, normalization, metrics } = options;

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

    const model = rowToModel(data);
    this.cache.set(`${orgId}:${modelType}`, model);
    return model;
  }

  async listVersions(
    orgId: string,
    modelType: SurrogateModelType
  ): Promise<ModelVersion[]> {
    const { data, error } = await supabase
      .from("ml_model_versions")
      .select("*")
      .eq("organization_id", orgId)
      .eq("model_type", modelType)
      .order("version", { ascending: false });

    if (error) throw new Error(`Failed to list model versions: ${error.message}`);
    return (data ?? []).map(rowToModel);
  }

  /** Invalidate the in-memory cache for a specific org/type. */
  invalidateCache(orgId: string, modelType: SurrogateModelType): void {
    this.cache.delete(`${orgId}:${modelType}`);
  }
}

function rowToModel(row: Record<string, unknown>): ModelVersion {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    modelType: row.model_type as SurrogateModelType,
    version: row.version as number,
    weights: row.weights as ModelVersion["weights"],
    normalization: row.normalization as ModelVersion["normalization"],
    metrics: row.metrics as ModelVersion["metrics"],
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
  };
}
