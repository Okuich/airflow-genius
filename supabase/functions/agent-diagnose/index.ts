import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SimulationContext {
  simulationId?: string;
  name?: string;
  status?: string;
  turbulenceModel?: string;
  cellCount?: number;
  currentIteration?: number;
  maxIterations?: number;
  relaxationFactors?: { pressure?: number; velocity?: number; turbulence?: number };
  residuals?: { iteration: number; continuity: number; xMomentum: number; yMomentum: number; zMomentum: number; kTurbulent?: number; epsilonOrOmega?: number }[];
  meshConfig?: Record<string, unknown>;
  solverConfig?: Record<string, unknown>;
  fluidProperties?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth: require valid JWT ───────────────────────────────────────────
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
    const { simulationContext } = await req.json() as { simulationContext: SimulationContext };
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are FlowForge AI — an expert CFD diagnostic engine. You MUST analyze the simulation data provided and return a structured diagnostic report by calling the "report_diagnostics" tool. Do not respond with plain text.

Analyze every aspect:
1. **Convergence Health**: Check residual trends for divergence, oscillation, or stagnation. Flag if latest residuals > 1e-4.
2. **Mesh Quality**: Evaluate cell count vs geometry complexity. Check boundary layer config (y+ adequacy, growth rate).
3. **Solver Settings**: Validate relaxation factors (pressure < 0.3 = too conservative, > 0.5 = risky). Check CFL/Courant implications.
4. **Turbulence Model**: Assess model suitability for the flow regime (rotating machinery → k-ω SST preferred; duct flow → k-ε RNG acceptable).
5. **Boundary Conditions**: Check for missing/misconfigured BCs. Validate mass balance feasibility.
6. **Performance Risks**: Detect potential non-physical results, negative pressures, backflow.

Severity scale: "info" (minor note), "warning" (should fix), "critical" (will cause failure), "ok" (no issue).
Confidence: 0.0–1.0 based on data completeness.`;

    const simDataStr = JSON.stringify(simulationContext, null, 2);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Run full diagnostics on this simulation:\n\n${simDataStr}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_diagnostics",
              description: "Return the structured diagnostic report for the simulation",
              parameters: {
                type: "object",
                properties: {
                  overallHealth: {
                    type: "string",
                    enum: ["healthy", "warning", "critical"],
                    description: "Overall simulation health status",
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence in the diagnosis (0-1)",
                  },
                  summary: {
                    type: "string",
                    description: "2-3 sentence executive summary of simulation health",
                  },
                  issues: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Unique issue ID like 'CONV-001'" },
                        category: {
                          type: "string",
                          enum: ["convergence", "mesh", "solver", "turbulence", "boundary", "performance"],
                        },
                        severity: {
                          type: "string",
                          enum: ["ok", "info", "warning", "critical"],
                        },
                        title: { type: "string", description: "Short issue title" },
                        detail: { type: "string", description: "Technical explanation with specific values" },
                        autoFixAvailable: { type: "boolean", description: "Whether this can be auto-fixed" },
                        fix: {
                          type: "object",
                          properties: {
                            description: { type: "string" },
                            action: {
                              type: "string",
                              enum: [
                                "adjust_relaxation_factors",
                                "change_turbulence_model",
                                "refine_mesh",
                                "adjust_boundary_condition",
                                "reduce_time_step",
                                "restart_solver",
                                "add_boundary_layers",
                                "increase_iterations",
                                "none",
                              ],
                            },
                            parameters: {
                              type: "object",
                              description: "Key-value parameters for the fix",
                              additionalProperties: true,
                            },
                            expectedImprovement: { type: "string" },
                          },
                          required: ["description", "action", "expectedImprovement"],
                        },
                      },
                      required: ["id", "category", "severity", "title", "detail", "autoFixAvailable"],
                    },
                  },
                  quickWins: {
                    type: "array",
                    items: { type: "string" },
                    description: "Top 1-3 highest-impact fixes that can be applied immediately",
                  },
                  estimatedResolutionConfidence: {
                    type: "number",
                    description: "Probability the issues can be auto-resolved (0-1)",
                  },
                },
                required: ["overallHealth", "confidence", "summary", "issues", "quickWins", "estimatedResolutionConfidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_diagnostics" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached." }), {
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

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No diagnostic report generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const diagnostics = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(diagnostics), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-diagnose error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
