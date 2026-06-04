import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Current knowledge base snapshot (sent to AI for delta analysis) ──────

const CURRENT_STANDARDS = [
  "ASHRAE_62.1 (2022)", "ASHRAE_55 (2023)", "ASHRAE_90.4 (2019)",
  "ISO_14644 (2015)", "OSHA_PEL (2021)", "NFPA_45 (2019)",
  "EN_16798 (2019)", "ACGIH_TLV (2023)", "TIA_942 (2017)", "NEBS_GR_3028 (2001)",
];

const CURRENT_DOMAINS = ["hvac", "cleanroom", "exhaust", "agriculture", "data-center"];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: admin-only function (writes to compliance_knowledge_sync as service role)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const _userSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: _u } = await _userSb.auth.getUser();
  if (!_u?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  // require admin role in at least one org
  const { data: _adminRows } = await _userSb.from("organization_members").select("role").eq("user_id", _u.user.id).in("role", ["admin", "owner"]).limit(1);
  if (!_adminRows || _adminRows.length === 0) {
    return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }


  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!lovableApiKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Create sync log entry
  const { data: logEntry, error: logError } = await supabase
    .from("compliance_sync_log")
    .insert({ status: "running", ai_model: "google/gemini-3-flash-preview" })
    .select("id")
    .single();

  if (logError) {
    console.error("Failed to create sync log:", logError);
    return new Response(JSON.stringify({ error: "Failed to create sync log" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const logId = logEntry.id;

  try {
    // ── Ask AI for regulatory updates ────────────────────────────────
    const systemPrompt = `You are a regulatory compliance analyst specialising in building services, HVAC, cleanroom, industrial exhaust, agriculture ventilation, and data center cooling standards.

Your task: identify any updates, amendments, or new editions to the following standards that would affect CFD-based airflow compliance analysis. Also suggest any NEW standards not yet in our catalog that are relevant to the domains listed.

Current catalog: ${CURRENT_STANDARDS.join(", ")}
Current domains: ${CURRENT_DOMAINS.join(", ")}

Current date context: February 2026.`;

    const userPrompt = `Analyse the current regulatory landscape and return updates using the provided tool. Include:
1. Any standards with newer editions than what we have
2. Any threshold changes in existing rules
3. Any new standards relevant to our domains
4. Any deprecated or superseded standards

For each update, provide the structured data via the tool call.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_regulatory_updates",
              description: "Submit discovered regulatory standard updates and new rules.",
              parameters: {
                type: "object",
                properties: {
                  standard_updates: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        standard_id: { type: "string", description: "e.g. ASHRAE_62.1" },
                        title: { type: "string" },
                        edition_year: { type: "integer" },
                        issuing_body: { type: "string" },
                        domains: { type: "array", items: { type: "string" } },
                        change_summary: { type: "string" },
                        is_new: { type: "boolean" },
                        clauses: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              clause_id: { type: "string" },
                              title: { type: "string" },
                              requirement: { type: "string" },
                              metrics: { type: "array", items: { type: "string" } },
                            },
                            required: ["clause_id", "title", "requirement", "metrics"],
                          },
                        },
                      },
                      required: ["standard_id", "title", "edition_year", "issuing_body", "domains", "change_summary", "is_new"],
                    },
                  },
                  rule_updates: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        rule_id: { type: "string" },
                        authority: { type: "string" },
                        standard_code: { type: "string" },
                        description: { type: "string" },
                        metric: { type: "string" },
                        threshold: { type: "number" },
                        operator: { type: "string", enum: [">=", "<=", "==", ">", "<"] },
                        severity: { type: "string", enum: ["Critical", "Medium", "Low"] },
                        domain: { type: "string" },
                        is_new: { type: "boolean" },
                        change_summary: { type: "string" },
                      },
                      required: ["rule_id", "authority", "standard_code", "description", "metric", "threshold", "operator", "severity", "domain", "is_new"],
                    },
                  },
                },
                required: ["standard_updates", "rule_updates"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_regulatory_updates" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        throw new Error("Rate limited by AI gateway — will retry next sync cycle");
      }
      if (aiResponse.status === 402) {
        throw new Error("AI credits exhausted — please top up workspace credits");
      }
      throw new Error(`AI gateway returned ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured tool call output");
    }

    const updates = JSON.parse(toolCall.function.arguments);
    const standardUpdates = updates.standard_updates ?? [];
    const ruleUpdates = updates.rule_updates ?? [];

    // ── Upsert standards ─────────────────────────────────────────────
    let standardsSynced = 0;
    for (const std of standardUpdates) {
      const { error } = await supabase
        .from("compliance_knowledge_sync")
        .upsert(
          {
            sync_type: "standard",
            entry_id: std.standard_id,
            payload: std,
            version: std.edition_year,
            source: "ai_sync",
            synced_at: new Date().toISOString(),
            is_active: true,
          },
          { onConflict: "sync_type,entry_id" }
        );

      if (!error) standardsSynced++;
      else console.error(`Failed to upsert standard ${std.standard_id}:`, error);
    }

    // ── Upsert rules ─────────────────────────────────────────────────
    let rulesSynced = 0;
    for (const rule of ruleUpdates) {
      const { error } = await supabase
        .from("compliance_knowledge_sync")
        .upsert(
          {
            sync_type: "rule",
            entry_id: rule.rule_id,
            payload: rule,
            version: 1,
            source: "ai_sync",
            synced_at: new Date().toISOString(),
            is_active: true,
          },
          { onConflict: "sync_type,entry_id" }
        );

      if (!error) rulesSynced++;
      else console.error(`Failed to upsert rule ${rule.rule_id}:`, error);
    }

    // ── Update log ───────────────────────────────────────────────────
    await supabase
      .from("compliance_sync_log")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        standards_synced: standardsSynced,
        rules_synced: rulesSynced,
      })
      .eq("id", logId);

    return new Response(
      JSON.stringify({
        success: true,
        standards_synced: standardsSynced,
        rules_synced: rulesSynced,
        total_standard_updates: standardUpdates.length,
        total_rule_updates: ruleUpdates.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    console.error("Compliance sync failed:", errorMsg);

    await supabase
      .from("compliance_sync_log")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: errorMsg,
      })
      .eq("id", logId);

    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
