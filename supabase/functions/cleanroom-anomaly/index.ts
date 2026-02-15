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

// ── Statistical anomaly pre-filter ──────────────────────────────────────────

interface Sample {
  zone_name: string;
  timestamp: string;
  air_change_rate: number;
  particle_retention: number;
  laminar_stability: number;
}

interface StatAnomaly {
  zone: string;
  metric: string;
  value: number;
  mean: number;
  stdDev: number;
  zScore: number;
  timestamp: string;
  direction: "spike" | "drop";
}

function detectStatisticalAnomalies(samples: Sample[], zScoreThreshold = 2.0): StatAnomaly[] {
  // Group by zone
  const zones: Record<string, Sample[]> = {};
  for (const s of samples) {
    if (!zones[s.zone_name]) zones[s.zone_name] = [];
    zones[s.zone_name].push(s);
  }

  const anomalies: StatAnomaly[] = [];
  const metrics = ["air_change_rate", "particle_retention", "laminar_stability"] as const;

  for (const [zone, zoneSamples] of Object.entries(zones)) {
    if (zoneSamples.length < 4) continue; // need enough data for stats

    for (const metric of metrics) {
      const values = zoneSamples.map((s) => Number(s[metric]));
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev === 0) continue;

      // Check the most recent samples (last 3) for anomalies
      const recentCount = Math.min(3, zoneSamples.length);
      for (let i = zoneSamples.length - recentCount; i < zoneSamples.length; i++) {
        const val = Number(zoneSamples[i][metric]);
        const zScore = Math.abs((val - mean) / stdDev);
        if (zScore >= zScoreThreshold) {
          anomalies.push({
            zone,
            metric,
            value: val,
            mean: Number(mean.toFixed(4)),
            stdDev: Number(stdDev.toFixed(4)),
            zScore: Number(zScore.toFixed(2)),
            timestamp: zoneSamples[i].timestamp,
            direction: val > mean ? "spike" : "drop",
          });
        }
      }
    }
  }

  return anomalies;
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json();
    const orgId = body?.org_id;
    const hoursBack = Math.min(Number(body?.hours_back ?? 24), 168);
    const zScoreThreshold = Number(body?.z_score_threshold ?? 2.0);

    if (!orgId) return json({ error: "org_id is required" }, 400);

    // Fetch recent samples
    const since = new Date(Date.now() - hoursBack * 3600_000).toISOString();
    const { data: samples, error: dbError } = await supabase
      .from("cleanroom_samples")
      .select("zone_name, timestamp, air_change_rate, particle_retention, laminar_stability")
      .eq("organization_id", orgId)
      .gte("timestamp", since)
      .order("timestamp", { ascending: true })
      .limit(1000);

    if (dbError) return json({ error: dbError.message }, 500);
    if (!samples || samples.length < 4) {
      return json({
        anomalies: [],
        aiAnalysis: null,
        message: "Insufficient data for anomaly detection (need ≥ 4 samples)",
        sampleCount: samples?.length ?? 0,
      });
    }

    // Step 1: Statistical pre-filter
    const statAnomalies = detectStatisticalAnomalies(samples as Sample[], zScoreThreshold);

    if (statAnomalies.length === 0) {
      return json({
        anomalies: [],
        aiAnalysis: null,
        message: "No statistical anomalies detected in the observation window",
        sampleCount: samples.length,
      });
    }

    // Step 2: AI analysis of detected anomalies
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Return stat anomalies without AI enrichment
      return json({
        anomalies: statAnomalies,
        aiAnalysis: null,
        message: "Statistical anomalies detected (AI analysis unavailable)",
        sampleCount: samples.length,
      });
    }

    const anomalySummary = statAnomalies.map((a) =>
      `${a.zone}: ${a.metric} ${a.direction} to ${a.value} (mean=${a.mean}, z=${a.zScore}) at ${a.timestamp}`
    ).join("\n");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a cleanroom environmental monitoring expert. Analyze the following anomalies detected in cleanroom telemetry data and provide:
1. A severity rating for each anomaly (critical, warning, info)
2. Likely root cause
3. Recommended corrective action
4. Whether the ISO classification may be affected

Respond using the provided tool.`,
          },
          {
            role: "user",
            content: `The following anomalies were detected in the last ${hoursBack} hours from ${samples.length} telemetry samples:\n\n${anomalySummary}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_anomaly_analysis",
              description: "Report structured analysis of cleanroom anomalies",
              parameters: {
                type: "object",
                properties: {
                  alerts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        zone: { type: "string" },
                        metric: { type: "string" },
                        severity: { type: "string", enum: ["critical", "warning", "info"] },
                        rootCause: { type: "string" },
                        recommendation: { type: "string" },
                        isoImpact: { type: "boolean" },
                      },
                      required: ["zone", "metric", "severity", "rootCause", "recommendation", "isoImpact"],
                      additionalProperties: false,
                    },
                  },
                  overallAssessment: { type: "string" },
                },
                required: ["alerts", "overallAssessment"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_anomaly_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return json({
          anomalies: statAnomalies,
          aiAnalysis: null,
          message: "AI rate limit exceeded — showing statistical anomalies only",
          sampleCount: samples.length,
        });
      }
      if (status === 402) {
        return json({
          anomalies: statAnomalies,
          aiAnalysis: null,
          message: "AI credits exhausted — showing statistical anomalies only",
          sampleCount: samples.length,
        });
      }
      console.error("AI gateway error:", status, await aiResponse.text());
      return json({
        anomalies: statAnomalies,
        aiAnalysis: null,
        message: "AI analysis failed — showing statistical anomalies only",
        sampleCount: samples.length,
      });
    }

    const aiData = await aiResponse.json();
    let aiAnalysis = null;

    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        aiAnalysis = JSON.parse(toolCall.function.arguments);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
    }

    return json({
      anomalies: statAnomalies,
      aiAnalysis,
      sampleCount: samples.length,
    });
  } catch (e) {
    console.error("Anomaly detection error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
