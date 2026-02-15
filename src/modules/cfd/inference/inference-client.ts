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

export class InferenceClient {
  /** Get a prediction from the inference API. */
  async predict(
    orgId: string,
    modelType: SurrogateModelType,
    featureVector: FeatureVector
  ): Promise<InferenceResult> {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ml-inference?orgId=${encodeURIComponent(orgId)}&modelType=${encodeURIComponent(modelType)}`;

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
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
}
