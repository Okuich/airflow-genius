// ─── Inference Client ──────────────────────────────────────────────────────
// Client-side wrapper for the ml-inference edge function.
// Used by the AI Agent and UI to get surrogate model predictions.
// ──────────────────────────────────────────────────────────────────────────

import type { FeatureVector, SurrogateModelType } from "@/packages/types";
import { supabase } from "@/integrations/supabase/client";

export interface InferencePrediction {
  modelType: SurrogateModelType;
  value: number;
  confidence: number;
  label: string;
  modelVersion: number;
}

export interface InferenceResult {
  prediction: InferencePrediction | null;
  model: {
    version: number;
    trainedAt: string;
    sampleCount: number;
    r2: number;
  } | null;
  message?: string;
}

export interface PipelineHealthReport {
  healthy: boolean;
  checks: Record<string, unknown>;
}

export interface CacheInvalidationResult {
  status: string;
  organizationId: string;
  modelType: string;
  activeModels: { modelType: string; version: number }[];
  invalidatedAt: string;
}

export class InferenceClient {
  private readonly baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  private async getHeaders(): Promise<Record<string, string>> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
  }

  /** Get a prediction from the inference API. */
  async predict(
    orgId: string,
    modelType: SurrogateModelType,
    featureVector: FeatureVector
  ): Promise<InferenceResult> {
    const url = `${this.baseUrl}/ml-inference?orgId=${encodeURIComponent(orgId)}&modelType=${encodeURIComponent(modelType)}`;
    const headers = await this.getHeaders();

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ featureVector }),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({ error: "Inference request failed" }));
      throw new Error(errBody.error ?? `Inference failed: ${resp.status}`);
    }

    return resp.json();
  }

  /** Get predictions for all model types. */
  async predictAll(
    orgId: string,
    featureVector: FeatureVector
  ): Promise<InferenceResult[]> {
    const types: SurrogateModelType[] = ["pressure_drop", "convergence", "efficiency"];
    const results = await Promise.allSettled(
      types.map((t) => this.predict(orgId, t, featureVector))
    );

    return results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      console.warn(`Inference failed for ${types[i]}:`, r.reason);
      return { prediction: null, model: null, message: String(r.reason) };
    });
  }

  /** Run a health check on the ML pipeline. */
  async healthCheck(orgId?: string): Promise<PipelineHealthReport> {
    const headers = await this.getHeaders();
    const resp = await fetch(`${this.baseUrl}/ml-pipeline-worker`, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "health_check", organizationId: orgId }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      return { healthy: false, checks: { error: errBody } };
    }

    return resp.json();
  }

  /** Invalidate server-side model cache for an organization. */
  async invalidateCache(orgId: string, modelType?: string): Promise<CacheInvalidationResult> {
    const headers = await this.getHeaders();
    const resp = await fetch(`${this.baseUrl}/ml-pipeline-worker`, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "cache_invalidate", organizationId: orgId, modelType }),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({ error: "Cache invalidation failed" }));
      throw new Error(errBody.error ?? `Cache invalidation failed: ${resp.status}`);
    }

    return resp.json();
  }
}
