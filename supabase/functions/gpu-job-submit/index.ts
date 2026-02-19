import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── GPU Provider Adapter Interface ──────────────────────────────────────
// Swap this section when you choose a provider (RunPod, Modal, Lambda, AWS, etc.)

interface GPUJobRequest {
  simulationId: string;
  meshCellCount: number;
  solverConfig: Record<string, unknown>;
  priority: "low" | "normal" | "high" | "critical";
}

interface GPUJobResponse {
  providerId: string;
  status: "queued" | "provisioning" | "running";
  estimatedStartSeconds: number;
}

async function submitToProvider(job: GPUJobRequest): Promise<GPUJobResponse> {
  const apiKey = Deno.env.get("RUNPOD_API_KEY");
  const endpointId = Deno.env.get("RUNPOD_ENDPOINT_ID");

  // ── Fallback to stub mode when secrets aren't configured yet ──
  if (!apiKey || !endpointId) {
    console.log("[gpu-job-submit] RunPod not configured – running in stub mode", job.simulationId);
    return {
      providerId: `stub-${crypto.randomUUID().slice(0, 8)}`,
      status: "queued",
      estimatedStartSeconds: 30,
    };
  }

  // ── Submit to RunPod Serverless ──
  const runpodUrl = `https://api.runpod.ai/v2/${endpointId}/run`;

  const res = await fetch(runpodUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: {
        simulation_id: job.simulationId,
        mesh_cell_count: job.meshCellCount,
        solver_config: job.solverConfig,
        priority: job.priority,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`RunPod API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  console.log("[gpu-job-submit] RunPod job submitted", data.id);

  return {
    providerId: data.id,
    status: data.status === "IN_QUEUE" ? "queued" : "provisioning",
    estimatedStartSeconds: 15,
  };
}

// ─── Tier-based GPU limits ───────────────────────────────────────────────

const TIER_LIMITS: Record<string, { maxGpuHours: number; maxConcurrent: number }> = {
  "trial-cleanroom":   { maxGpuHours: 10,  maxConcurrent: 1 },
  "trial-datacenter":  { maxGpuHours: 10,  maxConcurrent: 1 },
  "trial-hvac":        { maxGpuHours: 10,  maxConcurrent: 1 },
  "trial-automotive":  { maxGpuHours: 20,  maxConcurrent: 2 },
  "trial-energy":      { maxGpuHours: 20,  maxConcurrent: 2 },
  "trial-full":        { maxGpuHours: 50,  maxConcurrent: 3 },
  free:                { maxGpuHours: 5,   maxConcurrent: 1 },
  pro:                 { maxGpuHours: 500, maxConcurrent: 10 },
  enterprise:          { maxGpuHours: -1,  maxConcurrent: 50 },
};

// ─── Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Parse request
    const body: GPUJobRequest = await req.json();
    if (!body.simulationId || !body.meshCellCount) {
      return new Response(JSON.stringify({ error: "Missing simulationId or meshCellCount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up user's org tier
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, organizations(tier)")
      .eq("user_id", userId)
      .limit(1)
      .single();

    const tier = (membership?.organizations as any)?.tier ?? "free";
    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

    // Check GPU-hours usage
    const orgId = membership?.organization_id;
    if (orgId && limits.maxGpuHours > 0) {
      const { data: usage } = await supabase
        .from("compute_usage")
        .select("gpu_hours")
        .eq("organization_id", orgId);

      const totalHours = (usage ?? []).reduce((sum, r) => sum + Number(r.gpu_hours), 0);
      if (totalHours >= limits.maxGpuHours) {
        return new Response(
          JSON.stringify({ error: "GPU hour limit reached for your tier", usedHours: totalHours, limitHours: limits.maxGpuHours }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Submit to provider
    const result = await submitToProvider(body);

    // Record submission
    if (orgId) {
      await supabase.from("compute_usage").insert({
        organization_id: orgId,
        user_id: userId,
        simulation_id: body.simulationId,
        gpu_hours: 0, // updated by webhook on completion
        cpu_hours: 0,
        duration_seconds: 0,
        memory_gb_hours: 0,
        cost_usd: 0,
      });
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[gpu-job-submit] Error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
