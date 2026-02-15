import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function csv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) {
    return new Response("", {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
  const keys = Object.keys(rows[0]);
  const header = keys.join(",");
  const body = rows
    .map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))
    .join("\n");
  return new Response(`${header}\n${body}`, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "fetch";
  const orgId = url.searchParams.get("org_id");

  if (!orgId) return json({ error: "org_id is required" }, 400);

  // ── FETCH: paginated query with optional filters ─────────────────────────
  if (req.method === "GET" && action === "fetch") {
    const zone = url.searchParams.get("zone");
    const from = url.searchParams.get("from"); // ISO date
    const to = url.searchParams.get("to");     // ISO date
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 500), 1000);
    const offset = Number(url.searchParams.get("offset") ?? 0);

    let query = supabase
      .from("cleanroom_samples")
      .select("*", { count: "exact" })
      .eq("organization_id", orgId)
      .order("timestamp", { ascending: false })
      .range(offset, offset + limit - 1);

    if (zone) query = query.eq("zone_name", zone);
    if (from) query = query.gte("timestamp", from);
    if (to) query = query.lte("timestamp", to);

    const { data, error, count } = await query;
    if (error) return json({ error: error.message }, 500);

    return json({ data, count, limit, offset });
  }

  // ── EXPORT: CSV download ─────────────────────────────────────────────────
  if (req.method === "GET" && action === "export") {
    const zone = url.searchParams.get("zone");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    let query = supabase
      .from("cleanroom_samples")
      .select("zone_name, timestamp, air_change_rate, particle_retention, laminar_stability")
      .eq("organization_id", orgId)
      .order("timestamp", { ascending: true })
      .limit(1000);

    if (zone) query = query.eq("zone_name", zone);
    if (from) query = query.gte("timestamp", from);
    if (to) query = query.lte("timestamp", to);

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);

    const filename = `cleanroom_metrics_${orgId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.csv`;
    return csv(data ?? [], filename);
  }

  // ── INGEST: batch insert validated samples ───────────────────────────────
  if (req.method === "POST" && action === "ingest") {
    const body = await req.json();
    const samples = body?.samples;
    if (!Array.isArray(samples) || samples.length === 0) {
      return json({ error: "samples array is required" }, 400);
    }
    if (samples.length > 168) {
      return json({ error: "Max 168 samples per batch" }, 400);
    }

    // Validate each sample
    const errors: string[] = [];
    const rows = samples.map((s: Record<string, unknown>, i: number) => {
      const acr = Number(s.air_change_rate);
      const pr = Number(s.particle_retention);
      const ls = Number(s.laminar_stability);
      const zone = String(s.zone_name ?? "default");
      const ts = s.timestamp ? String(s.timestamp) : new Date().toISOString();

      if (isNaN(acr) || acr < 0 || acr > 1000) errors.push(`[${i}] air_change_rate out of range`);
      if (isNaN(pr) || pr < 0 || pr > 1) errors.push(`[${i}] particle_retention out of range`);
      if (isNaN(ls) || ls < 0 || ls > 1) errors.push(`[${i}] laminar_stability out of range`);

      return {
        organization_id: orgId,
        zone_name: zone,
        timestamp: ts,
        air_change_rate: acr,
        particle_retention: pr,
        laminar_stability: ls,
      };
    });

    if (errors.length > 0) return json({ error: "Validation failed", details: errors }, 400);

    const { data, error } = await supabase
      .from("cleanroom_samples")
      .insert(rows)
      .select("id, zone_name, timestamp");

    if (error) return json({ error: error.message }, 500);

    return json({ inserted: data?.length ?? 0, ids: data?.map((r: { id: string }) => r.id) }, 201);
  }

  // ── SUMMARY: aggregated stats per zone ───────────────────────────────────
  if (req.method === "GET" && action === "summary") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    let query = supabase
      .from("cleanroom_samples")
      .select("zone_name, air_change_rate, particle_retention, laminar_stability, timestamp")
      .eq("organization_id", orgId)
      .order("timestamp", { ascending: true })
      .limit(1000);

    if (from) query = query.gte("timestamp", from);
    if (to) query = query.lte("timestamp", to);

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);

    // Group by zone and compute stats
    const zones: Record<string, { acr: number[]; pr: number[]; ls: number[]; count: number }> = {};
    for (const row of data ?? []) {
      const z = row.zone_name;
      if (!zones[z]) zones[z] = { acr: [], pr: [], ls: [], count: 0 };
      zones[z].acr.push(Number(row.air_change_rate));
      zones[z].pr.push(Number(row.particle_retention));
      zones[z].ls.push(Number(row.laminar_stability));
      zones[z].count++;
    }

    const avg = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    const summary = Object.entries(zones).map(([zone, v]) => ({
      zone,
      sampleCount: v.count,
      avgAirChangeRate: Number(avg(v.acr).toFixed(2)),
      avgParticleRetention: Number(avg(v.pr).toFixed(4)),
      avgLaminarStability: Number(avg(v.ls).toFixed(4)),
      minAirChangeRate: Math.min(...v.acr),
      maxAirChangeRate: Math.max(...v.acr),
    }));

    return json({ summary, totalSamples: data?.length ?? 0 });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
