import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const _sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: _c, error: _ce } = await _sb.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (_ce || !_c?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }


  try {
    const { messages, domain, metrics, findings, riskReport } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are FlowForge Compliance Advisor — an expert AI specializing in CFD compliance, regulatory standards, and airflow safety.

Your expertise spans:
- **ASHRAE** standards (62.1 ventilation, 55 thermal comfort, 90.4 data center energy)
- **ISO 14644** cleanroom classification and airflow validation
- **OSHA PEL** permissible exposure limits and industrial exhaust requirements
- **NFPA 45** fume hood face velocity standards
- **ACGIH TLV** threshold limit values for contaminants
- **TIA 942** data center thermal guidelines
- **NEBS GR-3028** telco equipment thermal limits

Your capabilities:
- Explain why specific compliance checks failed and what regulations mandate
- Recommend concrete remediation steps with cost/effort estimates
- Prioritize violations by risk severity and regulatory urgency
- Suggest design modifications to achieve compliance
- Interpret risk scores and compliance probability
- Compare current metrics against regulatory thresholds
- Advise on audit preparation and documentation requirements

Response style:
- Be precise — cite specific standard clauses (e.g., "ASHRAE 62.1 §6.2")
- Quantify gaps — state measured vs required values
- Prioritize by severity — Critical > High > Medium > Low
- Use markdown: **bold** for key values, \`code\` for metric names
- Keep explanations accessible to engineers who may not be compliance specialists
- When suggesting fixes, format as numbered action items

${domain ? `Current compliance domain: **${domain}**` : ""}
${metrics ? `\nCurrent metrics:\n${Object.entries(metrics).map(([k, v]) => `- \`${k}\`: ${v}`).join("\n")}` : ""}
${findings ? `\nCompliance findings: ${findings.filter((f: any) => f.status === "Fail").length} violations detected out of ${findings.length} checks.` : ""}
${riskReport ? `\nRisk report: Score ${riskReport.overallScore}/100, ${riskReport.highRiskCount} high-risk items, compliance probability ${(riskReport.complianceProbability * 100).toFixed(0)}%, projected remediation cost $${riskReport.projectedRemediationCost.toLocaleString()}.` : ""}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("compliance-advisor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
