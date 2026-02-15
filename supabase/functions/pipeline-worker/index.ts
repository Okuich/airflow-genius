import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Feature names for normalization & model weights ────────────────────────
const FEATURE_NAMES = [
  "reynoldsNumber", "turbulenceIntensity", "pressureDrop",
  "efficiency", "meshQualityScore", "convergenceSpeed",
];

const MODEL_TYPES = ["pressure_drop", "convergence", "efficiency"] as const;
type ModelType = (typeof MODEL_TYPES)[number];

const MODEL_TARGET_MAP: Record<ModelType, string> = {
  pressure_drop: "pressureDrop",
  convergence: "converged",
  efficiency: "efficiency",
};

// ── OLS Training (Normal Equation) ─────────────────────────────────────────

function transpose(M: number[][]): number[][] {
  const rows = M.length, cols = M[0].length;
  const T: number[][] = Array.from({ length: cols }, () => new Array(rows));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) T[j][i] = M[i][j];
  return T;
}

function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length, n = B[0].length, k = B.length;
  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      for (let p = 0; p < k; p++) C[i][j] += A[i][p] * B[p][j];
  return C;
}

function matVecMul(M: number[][], v: number[]): number[] {
  return M.map((row) => row.reduce((sum, val, j) => sum + val * v[j], 0));
}

function invertMatrix(M: number[][]): number[][] {
  const n = M.length;
  const aug: number[][] = M.map((row, i) => {
    const augRow = [...row, ...new Array(n).fill(0)];
    augRow[n + i] = 1;
    return augRow;
  });

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-12) aug[col][col] = 1e-8;

    const scale = 1 / aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] *= scale;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
  return aug.map((row) => row.slice(n));
}

interface TrainResult {
  weights: { coefficients: number[]; intercept: number; featureNames: string[] };
  metrics: { mse: number; mae: number; r2: number; sampleCount: number; trainedAt: string };
  normalization: { mean: number[]; std: number[]; featureNames: string[] };
}

function trainOLS(
  features: number[][],
  targets: number[]
): TrainResult {
  const n = features.length;
  const dim = features[0].length;

  // Z-score normalization
  const mean = new Array(dim).fill(0);
  const std = new Array(dim).fill(0);
  for (const row of features) for (let j = 0; j < dim; j++) mean[j] += row[j];
  for (let j = 0; j < dim; j++) mean[j] /= n;
  for (const row of features) for (let j = 0; j < dim; j++) std[j] += (row[j] - mean[j]) ** 2;
  for (let j = 0; j < dim; j++) {
    std[j] = Math.sqrt(std[j] / n);
    if (std[j] < 1e-12) std[j] = 1;
  }

  const normalized = features.map((row) =>
    row.map((v, j) => (v - mean[j]) / std[j])
  );

  // OLS with bias column
  const X = normalized.map((row) => [1, ...row]);
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const XtXInv = invertMatrix(XtX);
  const Xty = matVecMul(Xt, targets);
  const w = matVecMul(XtXInv, Xty);

  const intercept = w[0];
  const coefficients = w.slice(1);

  // Metrics
  const predictions = X.map((row) => row.reduce((sum, x, i) => sum + x * w[i], 0));
  const yMean = targets.reduce((a, b) => a + b, 0) / n;
  let ssRes = 0, ssTot = 0, absErr = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (targets[i] - predictions[i]) ** 2;
    ssTot += (targets[i] - yMean) ** 2;
    absErr += Math.abs(targets[i] - predictions[i]);
  }

  return {
    weights: { coefficients, intercept, featureNames: [...FEATURE_NAMES] },
    metrics: {
      mse: ssRes / n,
      mae: absErr / n,
      r2: ssTot > 0 ? 1 - ssRes / ssTot : 0,
      sampleCount: n,
      trainedAt: new Date().toISOString(),
    },
    normalization: { mean, std, featureNames: [...FEATURE_NAMES] },
  };
}

// ── Worker Handler ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId as string | undefined;
    const minSamples = (body.minSamples as number) ?? 5;
    const modelTypesFilter = (body.modelTypes as string[]) ?? [...MODEL_TYPES];

    // If no orgId, scan for all orgs with pending training
    const orgIds: string[] = [];
    if (orgId) {
      orgIds.push(orgId);
    } else {
      // Find orgs with feature_store entries that haven't been trained recently
      const { data: orgs } = await supabase
        .from("feature_store")
        .select("organization_id")
        .order("created_at", { ascending: false })
        .limit(100);

      const uniqueOrgs = new Set((orgs ?? []).map((r: { organization_id: string }) => r.organization_id));
      orgIds.push(...uniqueOrgs);
    }

    if (orgIds.length === 0) {
      return new Response(
        JSON.stringify({ status: "idle", message: "No organizations with feature data" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, unknown>[] = [];

    for (const org of orgIds) {
      for (const modelType of modelTypesFilter) {
        if (!MODEL_TYPES.includes(modelType as ModelType)) continue;
        const targetLabel = MODEL_TARGET_MAP[modelType as ModelType];

        // Check if we need retraining: count features since last training job
        const { data: lastJob } = await supabase
          .from("training_jobs")
          .select("completed_at")
          .eq("organization_id", org)
          .eq("model_type", modelType)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let featureQuery = supabase
          .from("feature_store")
          .select("feature_vector, labels")
          .eq("organization_id", org)
          .eq("feature_version", "v1");

        if (lastJob?.completed_at) {
          featureQuery = featureQuery.gt("created_at", lastJob.completed_at);
        }

        const { data: newFeatures } = await featureQuery;
        const newCount = newFeatures?.length ?? 0;

        // Skip if insufficient new data (threshold: 10 new samples or minSamples for first train)
        const threshold = lastJob ? 10 : minSamples;
        if (newCount < threshold) {
          results.push({
            orgId: org, modelType, status: "skipped",
            reason: `Only ${newCount} new samples (need ${threshold})`,
          });
          continue;
        }

        // Fetch ALL feature data for training
        const { data: allFeatures, error: fetchErr } = await supabase
          .from("feature_store")
          .select("feature_vector, labels")
          .eq("organization_id", org)
          .eq("feature_version", "v1")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (fetchErr || !allFeatures || allFeatures.length < minSamples) {
          results.push({
            orgId: org, modelType, status: "skipped",
            reason: `Insufficient total samples: ${allFeatures?.length ?? 0}`,
          });
          continue;
        }

        // Create training job record
        const { data: jobRow } = await supabase
          .from("training_jobs")
          .insert([{
            organization_id: org,
            model_type: modelType,
            status: "running",
            started_at: new Date().toISOString(),
          }])
          .select("id")
          .single();

        const jobId = jobRow?.id ?? crypto.randomUUID();

        try {
          // Extract feature arrays and targets
          const featureArrays: number[][] = [];
          const targets: number[] = [];

          for (const row of allFeatures) {
            const fv = row.feature_vector as Record<string, number>;
            const labels = row.labels as Record<string, number | null>;
            const target = labels[targetLabel];
            if (target === null || target === undefined) continue;

            featureArrays.push(FEATURE_NAMES.map((k) => fv[k] ?? 0));
            targets.push(target);
          }

          if (featureArrays.length < minSamples) {
            await supabase.from("training_jobs").update({
              status: "completed",
              sample_count: featureArrays.length,
              error_message: "Insufficient labeled samples",
              completed_at: new Date().toISOString(),
            }).eq("id", jobId);

            results.push({
              orgId: org, modelType, jobId, status: "skipped",
              reason: `Only ${featureArrays.length} labeled samples`,
            });
            continue;
          }

          // Train
          const trained = trainOLS(featureArrays, targets);

          // Save to model registry — deactivate old, insert new
          const { data: existing } = await supabase
            .from("ml_model_versions")
            .select("version")
            .eq("organization_id", org)
            .eq("model_type", modelType)
            .order("version", { ascending: false })
            .limit(1);

          const nextVersion = ((existing?.[0] as { version: number } | undefined)?.version ?? 0) + 1;

          await supabase
            .from("ml_model_versions")
            .update({ is_active: false })
            .eq("organization_id", org)
            .eq("model_type", modelType);

          await supabase
            .from("ml_model_versions")
            .insert([{
              organization_id: org,
              model_type: modelType,
              version: nextVersion,
              weights: trained.weights,
              normalization: trained.normalization,
              metrics: trained.metrics,
              training_sample_count: trained.metrics.sampleCount,
              is_active: true,
            }]);

          // Update job
          await supabase.from("training_jobs").update({
            status: "completed",
            sample_count: trained.metrics.sampleCount,
            metrics: trained.metrics,
            completed_at: new Date().toISOString(),
          }).eq("id", jobId);

          results.push({
            orgId: org, modelType, jobId, status: "completed",
            version: nextVersion,
            r2: trained.metrics.r2,
            samples: trained.metrics.sampleCount,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          await supabase.from("training_jobs").update({
            status: "failed",
            error_message: errMsg,
            completed_at: new Date().toISOString(),
          }).eq("id", jobId);

          results.push({ orgId: org, modelType, jobId, status: "failed", error: errMsg });
        }
      }
    }

    return new Response(
      JSON.stringify({ status: "completed", jobs: results, processedAt: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pipeline-worker error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
