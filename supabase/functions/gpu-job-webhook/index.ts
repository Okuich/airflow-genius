import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Webhook Handler ─────────────────────────────────────────────────────
// GPU providers call this endpoint when a job completes or fails.
// Validate the webhook signature using GPU_PROVIDER_WEBHOOK_SECRET.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ┌──────────────────────────────────────────────────────────────────┐
    // │  STUB: Validate webhook signature from your provider            │
    // │  e.g. HMAC-SHA256 of body against GPU_PROVIDER_WEBHOOK_SECRET   │
    // └──────────────────────────────────────────────────────────────────┘
    // const secret = Deno.env.get("GPU_PROVIDER_WEBHOOK_SECRET");

    const body = await req.json();
    const { simulationId, status, gpuHours, durationSeconds, costUsd } = body;

    if (!simulationId || !status) {
      return new Response(JSON.stringify({ error: "Missing simulationId or status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Update simulation status
    const newStatus = status === "completed" ? "completed" : status === "failed" ? "failed" : "running";
    await supabase
      .from("simulations")
      .update({
        status: newStatus,
        progress: status === "completed" ? 100 : undefined,
        completed_at: ["completed", "failed"].includes(status) ? new Date().toISOString() : undefined,
      })
      .eq("id", simulationId);

    // Update compute usage with actual numbers
    if (gpuHours || durationSeconds || costUsd) {
      await supabase
        .from("compute_usage")
        .update({
          gpu_hours: gpuHours ?? 0,
          duration_seconds: durationSeconds ?? 0,
          cost_usd: costUsd ?? 0,
        })
        .eq("simulation_id", simulationId);
    }

    console.log(`[gpu-job-webhook] Updated simulation ${simulationId} → ${newStatus}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[gpu-job-webhook] Error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
