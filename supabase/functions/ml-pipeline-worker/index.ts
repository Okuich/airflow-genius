import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Feature extraction config ──────────────────────────────────────────────

const FEATURE_NAMES = [
  "reynoldsNumber", "turbulenceIntensity", "pressureDrop",
  "efficiency", "meshQualityScore", "convergenceSpeed",
];

const MODEL_TYPES = ["pressure_drop", "convergence", "efficiency"] as const;
type ModelType = (typeof MODEL_TYPES)[number];

const TARGET_LABEL: Record<ModelType, string> = {
  pressure_drop: "pressureDrop",
  convergence: "converged",
  efficiency: "efficiency",
};

// ── OLS helpers (same as pipeline-worker for consistency) ───────────────────

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

function trainOLS(features: number[][], targets: number[]): TrainResult {
  const n = features.length;
  const dim = features[0].length;
  const mean = new Array(dim).fill(0);
  const std = new Array(dim).fill(0);
  for (const row of features) for (let j = 0; j < dim; j++) mean[j] += row[j];
  for (let j = 0; j < dim; j++) mean[j] /= n;
  for (const row of features) for (let j = 0; j < dim; j++) std[j] += (row[j] - mean[j]) ** 2;
  for (let j = 0; j < dim; j++) { std[j] = Math.sqrt(std[j] / n); if (std[j] < 1e-12) std[j] = 1; }
  const normalized = features.map((row) => row.map((v, j) => (v - mean[j]) / std[j]));
  const X = normalized.map((row) => [1, ...row]);
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const XtXInv = invertMatrix(XtX);
  const Xty = matVecMul(Xt, targets);
  const w = matVecMul(XtXInv, Xty);
  const intercept = w[0];
  const coefficients = w.slice(1);
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
    metrics: { mse: ssRes / n, mae: absErr / n, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0, sampleCount: n, trainedAt: new Date().toISOString() },
    normalization: { mean, std, featureNames: [...FEATURE_NAMES] },
  };
}

// ── Feature extraction from simulation results ────────────────────────────

interface SimulationRow {
  id: string;
  organization_id: string;
  solver_config: Record<string, unknown>;
  mesh_config: Record<string, unknown>;
  cell_count: number | null;
  current_iteration: number | null;
}

interface SimResultRow {
  pressure_drop: number;
  converged: boolean;
  efficiency_rating: string;
  total_iterations: number;
  solve_time_seconds: number;
  mesh_stats: Record<string, unknown>;
  residuals: unknown;
}

function extractFeatures(sim: SimulationRow, result: SimResultRow): Record<string, number> {
  const solver = sim.solver_config ?? {};
  const mesh = sim.mesh_config ?? {};

  // Estimate Reynolds number from mesh & solver hints
  const baseSize = (mesh as { baseSize?: number }).baseSize ?? 0.01;
  const velocity = 10; // placeholder — real value would come from BCs
  const viscosity = 1.8e-5;
  const reynoldsNumber = (velocity * baseSize) / viscosity;

  // Turbulence intensity heuristic
  const turbModel = (solver as { turbulenceModel?: string }).turbulenceModel ?? "k-epsilon";
  const turbulenceIntensity = turbModel.includes("sst") ? 0.05 : turbModel.includes("spalart") ? 0.03 : 0.07;

  // Mesh quality score from cell count and refinement
  const cellCount = sim.cell_count ?? 100000;
  const refinementLevels = (mesh as { refinementLevels?: number }).refinementLevels ?? 1;
  const meshQualityScore = Math.min(1, (refinementLevels * 0.15) + (cellCount > 500000 ? 0.3 : cellCount > 100000 ? 0.2 : 0.1));

  // Convergence speed: iterations per second
  const convergenceSpeed = result.solve_time_seconds > 0
    ? result.total_iterations / result.solve_time_seconds
    : 0;

  // Efficiency as numeric
  const efficiencyMap: Record<string, number> = { Excellent: 0.9, Good: 0.75, Average: 0.55, Poor: 0.3 };
  const efficiency = efficiencyMap[result.efficiency_rating] ?? 0.5;

  return {
    reynoldsNumber,
    turbulenceIntensity,
    pressureDrop: result.pressure_drop,
    efficiency,
    meshQualityScore,
    convergenceSpeed,
  };
}

function extractLabels(result: SimResultRow): Record<string, number> {
  const efficiencyMap: Record<string, number> = { Excellent: 0.9, Good: 0.75, Average: 0.55, Poor: 0.3 };
  return {
    pressureDrop: result.pressure_drop,
    converged: result.converged ? 1 : 0,
    efficiency: efficiencyMap[result.efficiency_rating] ?? 0.5,
  };
}

// ── Event types ────────────────────────────────────────────────────────────

interface SimulationCompletedEvent {
  type: "simulation.completed";
  simulationId: string;
  organizationId?: string;
}

interface BatchTrainRequest {
  type: "batch_train";
  organizationId: string;
  modelTypes?: string[];
  minSamples?: number;
}

interface HealthCheckRequest {
  type: "health_check";
  organizationId?: string;
}

interface CacheInvalidateRequest {
  type: "cache_invalidate";
  organizationId: string;
  modelType?: string;
}

type WorkerRequest = SimulationCompletedEvent | BatchTrainRequest | HealthCheckRequest | CacheInvalidateRequest;

// ── Main handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body: WorkerRequest = await req.json();

    // ── Route by event type ──────────────────────────────────────────────
    if (body.type === "simulation.completed") {
      return await handleSimulationCompleted(supabase, body);
    }

    if (body.type === "batch_train") {
      return await handleBatchTrain(supabase, body);
    }

    if (body.type === "health_check") {
      return await handleHealthCheck(supabase, body);
    }

    if (body.type === "cache_invalidate") {
      return await handleCacheInvalidate(supabase, body);
    }

    return new Response(
      JSON.stringify({ error: `Unknown event type: ${(body as { type?: string }).type}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ml-pipeline-worker error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── simulation.completed handler ───────────────────────────────────────────

async function handleSimulationCompleted(
  supabase: ReturnType<typeof createClient>,
  event: SimulationCompletedEvent
) {
  const { simulationId } = event;
  console.log(`[ml-pipeline-worker] Processing simulation.completed for ${simulationId}`);

  // 1. Fetch simulation
  const { data: sim, error: simErr } = await supabase
    .from("simulations")
    .select("id, organization_id, solver_config, mesh_config, cell_count, current_iteration")
    .eq("id", simulationId)
    .single();

  if (simErr || !sim) {
    return jsonResponse(404, { error: `Simulation not found: ${simulationId}`, details: simErr?.message });
  }

  // 2. Fetch simulation results
  const { data: result, error: resErr } = await supabase
    .from("simulation_results")
    .select("pressure_drop, converged, efficiency_rating, total_iterations, solve_time_seconds, mesh_stats, residuals")
    .eq("simulation_id", simulationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (resErr || !result) {
    return jsonResponse(404, { error: `No results found for simulation: ${simulationId}`, details: resErr?.message });
  }

  const orgId = sim.organization_id;

  // 3. Extract features & labels
  const features = extractFeatures(sim as SimulationRow, result as unknown as SimResultRow);
  const labels = extractLabels(result as unknown as SimResultRow);

  // 4. Store in feature_store
  const { error: insertErr } = await supabase.from("feature_store").insert([{
    organization_id: orgId,
    simulation_id: simulationId,
    feature_vector: features,
    labels,
    feature_version: "v1",
    geometry_cluster: "default",
  }]);

  if (insertErr) {
    console.error("[ml-pipeline-worker] Feature store insert failed:", insertErr);
    return jsonResponse(500, { error: "Failed to store features", details: insertErr.message });
  }

  console.log(`[ml-pipeline-worker] Features stored for simulation ${simulationId}`);

  // 5. Check if we have enough data to trigger training
  const { count: featureCount } = await supabase
    .from("feature_store")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("feature_version", "v1");

  const totalFeatures = featureCount ?? 0;

  // 6. Check last training for each model type
  const trainingResults: Record<string, unknown>[] = [];
  const RETRAIN_THRESHOLD = 10;
  const MIN_SAMPLES = 5;

  for (const modelType of MODEL_TYPES) {
    const { data: lastJob } = await supabase
      .from("training_jobs")
      .select("completed_at, sample_count")
      .eq("organization_id", orgId)
      .eq("model_type", modelType)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Count new features since last training
    let newSampleQuery = supabase
      .from("feature_store")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("feature_version", "v1");

    if (lastJob?.completed_at) {
      newSampleQuery = newSampleQuery.gt("created_at", lastJob.completed_at);
    }

    const { count: newCount } = await newSampleQuery;
    const newSamples = newCount ?? 0;

    const threshold = lastJob ? RETRAIN_THRESHOLD : MIN_SAMPLES;

    if (newSamples < threshold) {
      trainingResults.push({
        modelType,
        action: "skipped",
        reason: `${newSamples} new samples (need ${threshold})`,
        totalFeatures,
      });
      continue;
    }

    // 7. Trigger training
    const trainResult = await trainModelForOrg(supabase, orgId, modelType, MIN_SAMPLES);
    trainingResults.push(trainResult);
  }

  return jsonResponse(200, {
    status: "processed",
    simulationId,
    organizationId: orgId,
    featuresStored: true,
    totalFeatures,
    training: trainingResults,
    processedAt: new Date().toISOString(),
  });
}

// ── batch_train handler ────────────────────────────────────────────────────

async function handleBatchTrain(
  supabase: ReturnType<typeof createClient>,
  request: BatchTrainRequest
) {
  const { organizationId, minSamples = 5 } = request;
  const modelTypes = (request.modelTypes ?? [...MODEL_TYPES]) as ModelType[];

  console.log(`[ml-pipeline-worker] Batch training for org ${organizationId}`);

  const results: Record<string, unknown>[] = [];

  for (const modelType of modelTypes) {
    if (!MODEL_TYPES.includes(modelType)) {
      results.push({ modelType, status: "skipped", reason: "Unknown model type" });
      continue;
    }
    const result = await trainModelForOrg(supabase, organizationId, modelType, minSamples);
    results.push(result);
  }

  return jsonResponse(200, {
    status: "completed",
    organizationId,
    jobs: results,
    processedAt: new Date().toISOString(),
  });
}

// ── Shared training logic ──────────────────────────────────────────────────

async function trainModelForOrg(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  modelType: ModelType,
  minSamples: number
): Promise<Record<string, unknown>> {
  const targetLabel = TARGET_LABEL[modelType];

  // Fetch all features
  const { data: allFeatures, error: fetchErr } = await supabase
    .from("feature_store")
    .select("feature_vector, labels")
    .eq("organization_id", orgId)
    .eq("feature_version", "v1")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (fetchErr || !allFeatures || allFeatures.length < minSamples) {
    return {
      modelType,
      status: "skipped",
      reason: `Insufficient samples: ${allFeatures?.length ?? 0} (need ${minSamples})`,
    };
  }

  // Create training job
  const { data: jobRow } = await supabase
    .from("training_jobs")
    .insert([{
      organization_id: orgId,
      model_type: modelType,
      status: "running",
      started_at: new Date().toISOString(),
      sample_count: 0,
    }])
    .select("id")
    .single();

  const jobId = jobRow?.id ?? crypto.randomUUID();

  try {
    // Extract arrays
    const featureArrays: number[][] = [];
    const targets: number[] = [];

    for (const row of allFeatures) {
      const fv = row.feature_vector as Record<string, number>;
      const lbls = row.labels as Record<string, number | null>;
      const target = lbls[targetLabel];
      if (target === null || target === undefined) continue;
      featureArrays.push(FEATURE_NAMES.map((k) => fv[k] ?? 0));
      targets.push(target);
    }

    if (featureArrays.length < minSamples) {
      await supabase.from("training_jobs").update({
        status: "completed",
        sample_count: featureArrays.length,
        error_message: "Insufficient labeled samples after filtering",
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);

      return { modelType, jobId, status: "skipped", reason: `Only ${featureArrays.length} labeled samples` };
    }

    // Train/test split (80/20)
    const testSize = Math.max(1, Math.round(featureArrays.length * 0.2));
    const trainFeatures = featureArrays.slice(0, featureArrays.length - testSize);
    const trainTargets = targets.slice(0, targets.length - testSize);
    const testFeatures = featureArrays.slice(featureArrays.length - testSize);
    const testTargets = targets.slice(targets.length - testSize);

    // Train on training set
    const trained = trainOLS(trainFeatures, trainTargets);

    // Evaluate on test set
    const testPredictions = testFeatures.map((f) => {
      const norm = f.map((v, j) => (v - trained.normalization.mean[j]) / trained.normalization.std[j]);
      return trained.weights.intercept + norm.reduce((sum, v, j) => sum + v * trained.weights.coefficients[j], 0);
    });

    const testMean = testTargets.reduce((a, b) => a + b, 0) / testTargets.length;
    let testSsRes = 0, testSsTot = 0;
    for (let i = 0; i < testTargets.length; i++) {
      testSsRes += (testTargets[i] - testPredictions[i]) ** 2;
      testSsTot += (testTargets[i] - testMean) ** 2;
    }
    const testR2 = testSsTot > 0 ? 1 - testSsRes / testSsTot : 0;
    const overfit = trained.metrics.r2 - testR2 > 0.2;

    // Save model version
    const { data: existing } = await supabase
      .from("ml_model_versions")
      .select("version")
      .eq("organization_id", orgId)
      .eq("model_type", modelType)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = ((existing?.[0] as { version: number } | undefined)?.version ?? 0) + 1;

    await supabase
      .from("ml_model_versions")
      .update({ is_active: false })
      .eq("organization_id", orgId)
      .eq("model_type", modelType);

    await supabase
      .from("ml_model_versions")
      .insert([{
        organization_id: orgId,
        model_type: modelType,
        version: nextVersion,
        weights: trained.weights,
        normalization: trained.normalization,
        metrics: { ...trained.metrics, testR2, overfit },
        training_sample_count: trained.metrics.sampleCount,
        is_active: true,
      }]);

    // Update job
    await supabase.from("training_jobs").update({
      status: "completed",
      sample_count: trained.metrics.sampleCount,
      metrics: { ...trained.metrics, testR2, overfit, version: nextVersion },
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    console.log(`[ml-pipeline-worker] Trained ${modelType} v${nextVersion} — R²=${trained.metrics.r2.toFixed(3)}, testR²=${testR2.toFixed(3)}`);

    return {
      modelType, jobId,
      status: "completed",
      version: nextVersion,
      trainR2: trained.metrics.r2,
      testR2,
      overfit,
      samples: trained.metrics.sampleCount,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    await supabase.from("training_jobs").update({
      status: "failed",
      error_message: errMsg,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    console.error(`[ml-pipeline-worker] Training failed for ${modelType}:`, err);
    return { modelType, jobId, status: "failed", error: errMsg };
  }
}

// ── health_check handler ───────────────────────────────────────────────────

async function handleHealthCheck(
  supabase: ReturnType<typeof createClient>,
  request: HealthCheckRequest
) {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    service: "ml-pipeline-worker",
  };

  // Check database connectivity
  try {
    const { count, error } = await supabase
      .from("ml_model_versions")
      .select("id", { count: "exact", head: true });
    checks.database = { healthy: !error, modelCount: count ?? 0, error: error?.message };
  } catch (e) {
    checks.database = { healthy: false, error: e instanceof Error ? e.message : "Unknown" };
  }

  // Check feature store
  try {
    let query = supabase
      .from("feature_store")
      .select("id", { count: "exact", head: true });
    if (request.organizationId) query = query.eq("organization_id", request.organizationId);
    const { count, error } = await query;
    checks.featureStore = { healthy: !error, sampleCount: count ?? 0, error: error?.message };
  } catch (e) {
    checks.featureStore = { healthy: false, error: e instanceof Error ? e.message : "Unknown" };
  }

  // Check active models per type
  try {
    let query = supabase
      .from("ml_model_versions")
      .select("model_type, version, is_active, training_sample_count, metrics")
      .eq("is_active", true);
    if (request.organizationId) query = query.eq("organization_id", request.organizationId);
    const { data, error } = await query;

    if (error) {
      checks.activeModels = { healthy: false, error: error.message };
    } else {
      const models = (data ?? []).map((m) => ({
        modelType: m.model_type,
        version: m.version,
        samples: m.training_sample_count,
        r2: (m.metrics as { r2?: number })?.r2 ?? null,
        testR2: (m.metrics as { testR2?: number })?.testR2 ?? null,
      }));
      checks.activeModels = { healthy: true, count: models.length, models };
    }
  } catch (e) {
    checks.activeModels = { healthy: false, error: e instanceof Error ? e.message : "Unknown" };
  }

  // Check training jobs (recent failures)
  try {
    let query = supabase
      .from("training_jobs")
      .select("id, model_type, status, error_message, completed_at")
      .eq("status", "failed")
      .order("completed_at", { ascending: false })
      .limit(5);
    if (request.organizationId) query = query.eq("organization_id", request.organizationId);
    const { data, error } = await query;
    checks.recentFailures = { healthy: !error, count: data?.length ?? 0, failures: data ?? [] };
  } catch (e) {
    checks.recentFailures = { healthy: false, error: e instanceof Error ? e.message : "Unknown" };
  }

  const allHealthy = Object.values(checks)
    .filter((v) => typeof v === "object" && v !== null && "healthy" in (v as Record<string, unknown>))
    .every((v) => (v as { healthy: boolean }).healthy);

  return jsonResponse(allHealthy ? 200 : 503, { healthy: allHealthy, checks });
}

// ── cache_invalidate handler ──────────────────────────────────────────────

async function handleCacheInvalidate(
  supabase: ReturnType<typeof createClient>,
  request: CacheInvalidateRequest
) {
  const { organizationId, modelType } = request;

  // Verify org exists
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgErr || !org) {
    return jsonResponse(404, { error: "Organization not found", organizationId });
  }

  // Fetch current active models (acts as a cache refresh signal)
  let modelsQuery = supabase
    .from("ml_model_versions")
    .select("model_type, version, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (modelType) {
    modelsQuery = modelsQuery.eq("model_type", modelType);
  }

  const { data: activeModels } = await modelsQuery;

  return jsonResponse(200, {
    status: "cache_invalidated",
    organizationId,
    modelType: modelType ?? "all",
    activeModels: (activeModels ?? []).map((m) => ({
      modelType: m.model_type,
      version: m.version,
    })),
    invalidatedAt: new Date().toISOString(),
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
