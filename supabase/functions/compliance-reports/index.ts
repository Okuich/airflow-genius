import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return errorResponse("Unauthorized", 401);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/compliance-reports\/?/, "").replace(/\/$/, "");

  try {
    // ── POST / → Generate a new report ──────────────────────────────
    if (req.method === "POST" && (!path || path === "generate")) {
      const body = await req.json();
      const { organization_id, simulation_id, domain, title, verdict, overall_score, findings, regulatory_references, filters, format } = body;

      if (!organization_id || !domain || !title) {
        return errorResponse("organization_id, domain, and title are required");
      }

      const { data, error } = await supabase
        .from("compliance_reports")
        .insert({
          organization_id,
          simulation_id: simulation_id ?? null,
          domain,
          title,
          verdict: verdict ?? "PENDING",
          overall_score: overall_score ?? 0,
          findings: findings ?? [],
          regulatory_references: regulatory_references ?? [],
          filters: filters ?? {},
          format: format ?? "json",
          created_by: user.id,
        })
        .select()
        .single();

      if (error) return errorResponse(error.message, 500);
      return jsonResponse(data, 201);
    }

    // ── GET /?id=:id → Fetch single report ──────────────────────────
    if (req.method === "GET" && url.searchParams.has("id")) {
      const id = url.searchParams.get("id")!;
      const { data, error } = await supabase
        .from("compliance_reports")
        .select("*")
        .eq("id", id)
        .single();

      if (error) return errorResponse(error.message, error.code === "PGRST116" ? 404 : 500);
      return jsonResponse(data);
    }

    // ── GET / → List reports (with optional filters) ────────────────
    if (req.method === "GET") {
      const orgId = url.searchParams.get("organization_id");
      if (!orgId) return errorResponse("organization_id query param is required");

      let query = supabase
        .from("compliance_reports")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      const domain = url.searchParams.get("domain");
      if (domain) query = query.eq("domain", domain);

      const dateFrom = url.searchParams.get("date_from");
      if (dateFrom) query = query.gte("created_at", dateFrom);

      const dateTo = url.searchParams.get("date_to");
      if (dateTo) query = query.lte("created_at", dateTo);

      const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
      query = query.limit(limit);

      const { data, error } = await query;
      if (error) return errorResponse(error.message, 500);
      return jsonResponse(data);
    }

    // ── DELETE /?id=:id → Delete a report ───────────────────────────
    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return errorResponse("id query param is required");

      const { error } = await supabase
        .from("compliance_reports")
        .delete()
        .eq("id", id);

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ success: true });
    }

    return errorResponse("Not found", 404);
  } catch (e) {
    console.error("compliance-reports error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
