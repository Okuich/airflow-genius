import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, simulationId, simulationContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build context-aware system prompt
    let systemPrompt = `You are FlowForge AI — a senior CFD engineering assistant specialised in HVAC systems and turbomachinery (centrifugal blowers, axial fans, mixed-flow fans).

Your capabilities:
- Diagnose convergence issues (divergence, oscillation, stagnation)
- Advise on mesh quality, y+ values, boundary layers
- Recommend turbulence model selection (k-ε, k-ω SST)
- Interpret simulation results (pressure drop, efficiency, flow separation)
- Suggest boundary condition fixes
- Recommend relaxation factor adjustments

Response style:
- Be precise and technical, cite specific numerical thresholds
- When suggesting fixes, format them as actionable steps
- Use markdown formatting: **bold** for key values, \`code\` for parameters
- When you identify an actionable fix, wrap it in: [ACTION: description]
- Keep responses concise but thorough`;

    if (simulationId) {
      systemPrompt += `\n\nCurrent simulation context:
- Simulation ID: ${simulationId}`;
    }

    if (simulationContext) {
      systemPrompt += `
- Name: ${simulationContext.name || "N/A"}
- Status: ${simulationContext.status || "N/A"}
- Turbulence Model: ${simulationContext.turbulenceModel || "N/A"}
- Cell Count: ${simulationContext.cellCount?.toLocaleString() || "N/A"}
- Current Iteration: ${simulationContext.currentIteration || "N/A"}
- Max Iterations: ${simulationContext.maxIterations || "N/A"}`;

      if (simulationContext.relaxationFactors) {
        systemPrompt += `
- Relaxation Factors: P=${simulationContext.relaxationFactors.pressure}, U=${simulationContext.relaxationFactors.velocity}, k/ε=${simulationContext.relaxationFactors.turbulence}`;
      }
    }

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
    console.error("agent-message error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
