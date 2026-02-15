// ─── Step 6: Model Registry ────────────────────────────────────────────────
// CFD-domain facade over packages/model-registry.
// Adds localStorage caching on top of the platform-agnostic interface.
// ──────────────────────────────────────────────────────────────────────────

import type {
  SurrogateModelType,
  SurrogateModelVersion,
  SurrogateModelWeights,
  SurrogateModelMetrics,
  NormalizationParams,
} from "@/packages/types";
import type { IModelRegistry, ModelVersion } from "@/packages/model-registry";
import { SupabaseModelRegistry } from "@/packages/model-registry";

const LOCAL_CACHE_KEY = "flowforge_ml_models";

interface CachedModels {
  models: SurrogateModelVersion[];
  syncedAt: string;
}

function versionToLegacy(v: ModelVersion): SurrogateModelVersion {
  return {
    id: v.id,
    organizationId: v.organizationId,
    modelType: v.modelType,
    version: v.version,
    weights: v.weights,
    normalization: v.normalization,
    metrics: v.metrics,
    isActive: v.isActive,
    createdAt: v.createdAt,
  };
}

export class ModelRegistry {
  private readonly inner: IModelRegistry;
  private localCache = new Map<string, SurrogateModelVersion>();

  constructor(inner?: IModelRegistry) {
    this.inner = inner ?? new SupabaseModelRegistry();
  }

  async getActiveModel(
    orgId: string,
    modelType: SurrogateModelType
  ): Promise<SurrogateModelVersion | null> {
    const cacheKey = `${orgId}:${modelType}`;
    if (this.localCache.has(cacheKey)) return this.localCache.get(cacheKey)!;

    // Check localStorage
    const local = this.loadFromLocal(orgId, modelType);
    if (local) {
      this.localCache.set(cacheKey, local);
      return local;
    }

    const result = await this.inner.getActiveModel(orgId, modelType);
    if (!result) return null;

    const model = versionToLegacy(result);
    this.localCache.set(cacheKey, model);
    this.saveToLocal(orgId, model);
    return model;
  }

  async saveVersion(
    orgId: string,
    modelType: SurrogateModelType,
    weights: SurrogateModelWeights,
    normalization: NormalizationParams,
    metrics: SurrogateModelMetrics
  ): Promise<SurrogateModelVersion> {
    const result = await this.inner.saveVersion({
      organizationId: orgId,
      modelType,
      weights,
      normalization,
      metrics,
    });

    const model = versionToLegacy(result);
    const cacheKey = `${orgId}:${modelType}`;
    this.localCache.set(cacheKey, model);
    this.saveToLocal(orgId, model);
    return model;
  }

  async listVersions(
    orgId: string,
    modelType: SurrogateModelType
  ): Promise<SurrogateModelVersion[]> {
    const versions = await this.inner.listVersions(orgId, modelType);
    return versions.map(versionToLegacy);
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

      const idx = cached.models.findIndex(
        (m) => m.organizationId === orgId && m.modelType === model.modelType
      );
      if (idx >= 0) cached.models[idx] = model;
      else cached.models.push(model);

      cached.syncedAt = new Date().toISOString();
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cached));
    } catch { /* localStorage unavailable */ }
  }
}
