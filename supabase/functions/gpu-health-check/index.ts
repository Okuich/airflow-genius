const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("RUNPOD_API_KEY");
  const endpointId = Deno.env.get("RUNPOD_ENDPOINT_ID");

  const checks: Record<string, unknown> = {
    runpod_api_key_set: !!apiKey,
    runpod_endpoint_id_set: !!endpointId,
    runpod_api_key_prefix: apiKey ? apiKey.slice(0, 6) + "…" : null,
    runpod_endpoint_id: endpointId ?? null,
  };

  // Quick connectivity test — hit RunPod's health endpoint
  if (apiKey && endpointId) {
    try {
      const res = await fetch(
        `https://api.runpod.ai/v2/${endpointId}/health`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      const body = await res.text();
      checks.runpod_health_status = res.status;
      checks.runpod_health_body = body.slice(0, 500);
      checks.runpod_connected = res.ok;
    } catch (err) {
      checks.runpod_connected = false;
      checks.runpod_error = err instanceof Error ? err.message : String(err);
    }
  }

  return new Response(JSON.stringify(checks, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
