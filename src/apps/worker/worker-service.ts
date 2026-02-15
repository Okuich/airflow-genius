// ─── apps/worker ────────────────────────────────────────────────────────────
// Client-side service for invoking and monitoring the ML pipeline worker.
// Wraps the pipeline-worker edge function with typed interfaces.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";

// ── Types ───────────────────────────────────────────────────────────────────

export type WorkerJobStatus = "completed" | "skipped" | "failed";

export interface WorkerJobResult {
  orgId: string;
  modelType: string;
  jobId?: string;
  status: WorkerJobStatus;
  reason?: string;
  error?: string;
  version?: number;
  r2?: number;
  samples?: number;
}

export interface WorkerRunResult {
  status: "completed" | "idle";
  message?: string;
  jobs?: WorkerJobResult[];
  processedAt?: string;
}

export interface WorkerInvokeOptions {
  /** Target a specific org. Omit to process all orgs with pending data. */
  orgId?: string;
  /** Minimum samples required to trigger training (default: 5). */
  minSamples?: number;
  /** Filter to specific model types. Default: all three. */
  modelTypes?: ("pressure_drop" | "convergence" | "efficiency")[];
}

export interface TrainingJobSummary {
  id: string;
  organizationId: string;
  modelType: string;
  status: string;
  sampleCount: number;
  metrics: Record<string, unknown>;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

// ── Worker Service ──────────────────────────────────────────────────────────

export class WorkerService {
  /**
   * Invoke the pipeline worker to process pending training jobs.
   * Uses the service role via edge function — no auth required from caller.
   */
  async run(options?: WorkerInvokeOptions): Promise<WorkerRunResult> {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pipeline-worker`;

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        orgId: options?.orgId,
        minSamples: options?.minSamples,
        modelTypes: options?.modelTypes,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({ error: "Worker invocation failed" }));
      throw new Error(errBody.error ?? `Worker failed: ${resp.status}`);
    }

    return resp.json();
  }

  /**
   * Get recent training job history for an organization.
   */
  async getJobHistory(
    orgId: string,
    options?: { limit?: number; modelType?: string }
  ): Promise<TrainingJobSummary[]> {
    let q = supabase
      .from("training_jobs")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.modelType) q = q.eq("model_type", options.modelType);
    if (options?.limit) q = q.limit(options.limit);

    const { data, error } = await q;
    if (error) throw new Error(`Failed to fetch job history: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      modelType: row.model_type,
      status: row.status,
      sampleCount: row.sample_count,
      metrics: row.metrics as Record<string, unknown>,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      errorMessage: row.error_message,
    }));
  }

  /**
   * Get the latest training job status for each model type.
   */
  async getLatestJobs(orgId: string): Promise<Map<string, TrainingJobSummary>> {
    const jobs = await this.getJobHistory(orgId, { limit: 20 });
    const latest = new Map<string, TrainingJobSummary>();

    for (const job of jobs) {
      if (!latest.has(job.modelType)) {
        latest.set(job.modelType, job);
      }
    }

    return latest;
  }

  /**
   * Check if retraining is needed for a specific org/model type.
   * Returns the number of new feature entries since last training.
   */
  async checkRetrainingNeeded(
    orgId: string,
    modelType: string
  ): Promise<{ needed: boolean; newSamples: number; threshold: number }> {
    // Get last completed training job
    const { data: lastJob } = await supabase
      .from("training_jobs")
      .select("completed_at")
      .eq("organization_id", orgId)
      .eq("model_type", modelType)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let featureQuery = supabase
      .from("feature_store")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("feature_version", "v1");

    if (lastJob?.completed_at) {
      featureQuery = featureQuery.gt("created_at", lastJob.completed_at);
    }

    const { count } = await featureQuery;
    const newSamples = count ?? 0;
    const threshold = lastJob ? 10 : 5;

    return { needed: newSamples >= threshold, newSamples, threshold };
  }
}
