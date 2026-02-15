import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    const modelType = url.searchParams.get("modelType");

    if (!orgId || !modelType) {
      return new Response(
        JSON.stringify({ error: "Missing orgId or modelType query param" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate model type
    const validTypes = ["pressure_drop", "convergence", "efficiency"];
    if (!validTypes.includes(modelType)) {
      return new Response(
        JSON.stringify({ error: `Invalid modelType. Must be one of: ${validTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Parse request body for feature vector
    const body = await req.json();
    const featureVector = body.featureVector;

    if (!featureVector) {
      return new Response(
        JSON.stringify({ error: "Missing featureVector in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch active model from registry
    const { data: model, error: modelErr } = await supabase
      .from("ml_model_versions")
      .select("*")
      .eq("organization_id", orgId)
      .eq("model_type", modelType)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (modelErr) {
      return new Response(
        JSON.stringify({ error: `Registry query failed: ${modelErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!model) {
      return new Response(
        JSON.stringify({
          prediction: null,
          confidence: 0,
          message: `No trained ${modelType} model found for this organization`,
          modelVersion: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Run inference
    const weights = model.weights as { coefficients: number[]; intercept: number };
    const normalization = model.normalization as { mean: number[]; std: number[] };
    const metrics = model.metrics as { r2: number; sampleCount: number; mse: number; mae: number };

    // Normalize input features
    const featureNames = [
      "reynoldsNumber", "turbulenceIntensity", "pressureDrop",
      "efficiency", "meshQualityScore", "convergenceSpeed",
    ];
    const rawFeatures = featureNames.map((k: string) => featureVector[k] ?? 0);
    const normalized = rawFeatures.map((v: number, i: number) => {
      const mean = normalization.mean[i] ?? 0;
      const std = normalization.std[i] ?? 1;
      return std > 1e-12 ? (v - mean) / std : 0;
    });

    // Linear prediction
    let value = weights.intercept ?? 0;
    for (let i = 0; i < normalized.length; i++) {
      value += normalized[i] * (weights.coefficients[i] ?? 0);
    }

    // Confidence from R² and sample count
    const r2Factor = Math.max(0, metrics.r2 ?? 0);
    const sampleFactor = Math.min(1, (metrics.sampleCount ?? 0) / 50);
    const confidence = Math.round(r2Factor * sampleFactor * 100) / 100;

    // Interpret the prediction
    let label: string;
    if (modelType === "convergence") {
      const clamped = Math.max(0, Math.min(1, value));
      value = clamped;
      label = clamped >= 0.5 ? "likely-converge" : "risk-diverge";
    } else if (modelType === "efficiency") {
      const clamped = Math.max(0, Math.min(1, value));
      value = clamped;
      if (clamped >= 0.75) label = "Excellent";
      else if (clamped >= 0.5) label = "Good";
      else if (clamped >= 0.25) label = "Average";
      else label = "Poor";
    } else {
      label = `${value.toFixed(1)} Pa`;
    }

    return new Response(
      JSON.stringify({
        prediction: {
          modelType,
          value: Math.round(value * 10000) / 10000,
          confidence,
          label,
          modelVersion: model.version,
        },
        model: {
          version: model.version,
          trainedAt: model.created_at,
          sampleCount: metrics.sampleCount,
          r2: metrics.r2,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ml-inference error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
