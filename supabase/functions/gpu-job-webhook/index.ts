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
    // ── RunPod webhook signature validation (optional) ──
    // RunPod doesn't sign webhooks by default; if you configure a secret
    // on the RunPod side, validate it here:
    // const secret = Deno.env.get("RUNPOD_WEBHOOK_SECRET");
    // const sig = req.headers.get("x-runpod-signature");

    const body = await req.json();

    // RunPod sends: { id, status: "COMPLETED"|"FAILED"|"TIMED_OUT", output: {...} }
    // Map to our internal shape
    const simulationId = body.input?.simulation_id ?? body.simulationId;
    const rawStatus = (body.status ?? "").toUpperCase();
    const status = rawStatus === "COMPLETED" ? "completed"
      : (rawStatus === "FAILED" || rawStatus === "TIMED_OUT") ? "failed"
      : "running";
    const gpuHours = body.output?.gpu_hours ?? body.gpuHours;
    const durationSeconds = body.output?.duration_seconds ?? body.durationSeconds;
    const costUsd = body.output?.cost_usd ?? body.costUsd;

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
    await supabase
      .from("simulations")
      .update({
        status,
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

    console.log(`[gpu-job-webhook] Updated simulation ${simulationId} → ${status}`);

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
