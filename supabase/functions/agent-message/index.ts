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
    let systemPrompt = `You are FlowForge AI — an autonomous CFD engineering agent that resolves 95%+ of simulation issues without escalation.

## CORE IDENTITY
You are the front-line resolver for ALL CFD simulation issues on the FlowForge platform (HVAC, turbomachinery, cleanroom, data center, exhaust systems). You diagnose root causes, prescribe exact fixes, and can auto-apply them.

## DIAGNOSTIC EXPERTISE

### Convergence Issues
- **Divergence**: Check residual magnitude > 1e+3 → reduce relaxation (P=0.15, U=0.4, k/ε=0.5), check mesh quality
- **Oscillation**: Residuals cycling ±2 orders → enable gradient limiting, reduce URFs by 30%, check for reversed flow at outlets
- **Stagnation**: Residuals plateau > 1e-3 → switch turbulence model, refine mesh in high-gradient regions, check reference values
- **NaN/Inf**: Immediate mesh quality check (non-orthogonality > 70° or skewness > 0.95), then check BCs

### Mesh Quality Thresholds
- Non-orthogonality: <65° (good), 65-70° (warning), >70° (critical — solver will diverge)
- Skewness: <0.85 (acceptable), >0.85 (refine), >0.95 (will cause NaN)
- Aspect ratio: <100 (acceptable for BL), >200 (problematic)
- y+ targets: Wall functions: 30-300; Low-Re: <1; k-ω SST: <5 preferred, wall functions OK at 30-300
- Boundary layers: Growth rate 1.1-1.2 (ideal), >1.3 (may miss gradients)

### Turbulence Model Selection
- **k-ω SST**: Rotating machinery, separated flows, blade tips, adverse pressure gradients. PREFERRED for fans/blowers.
- **k-ε Standard**: Simple duct flows, fully developed turbulence. NOT for rotating machinery.
- **k-ε RNG**: Better for swirling flows than standard k-ε. Acceptable for HVAC ducts with fittings.
- **Spalart-Allmaras**: External aero only. NOT recommended for internal flows.

### Relaxation Factors Guide
| Scenario | Pressure | Velocity | Turbulence |
|----------|----------|----------|------------|
| Initial startup | 0.2 | 0.4 | 0.5 |
| Stable convergence | 0.3 | 0.7 | 0.8 |
| Near convergence | 0.5 | 0.8 | 0.9 |
| Highly unstable | 0.1 | 0.3 | 0.4 |

### Rotating Machinery
- MRF (frozen rotor): OK for design-point steady analysis
- Sliding mesh: Required for off-design, transient, blade-passing
- Tip clearance: Minimum 10 cells across gap
- RPM → rad/s: multiply by π/30

### Boundary Conditions
- Mass flow inlet preferred over velocity inlet for rotating machinery
- Outlet backflow: Use pressure outlet with backflow direction specification
- Walls: No-slip default; adiabatic unless heat transfer enabled
- Periodic: Must be geometrically matching pairs

## RESPONSE FORMAT

1. Start with a **1-line diagnosis** (bold the root cause)
2. List specific issues found with numerical values
3. For EVERY issue, provide an **[ACTION: exact fix description]** tag
4. Include parameter values: don't say "reduce relaxation" — say "set pressure relaxation to 0.2"
5. Rate your fix confidence: [CONFIDENCE: X%]
6. If multiple issues exist, prioritize by severity

## AUTONOMOUS CAPABILITIES
- You CAN adjust solver parameters (relaxation factors, time step, iterations)
- You CAN recommend mesh refinement with specific cell counts
- You CAN switch turbulence models with justification
- You CAN modify boundary conditions
- You MUST flag when manual geometry changes are needed (escalate)
- You MUST warn before destructive actions (restarting from scratch)

## ESCALATION CRITERIA (the 5% you can't resolve)
Only escalate when:
- Geometry is fundamentally flawed (can't fix with mesh/solver changes)
- Hardware/infrastructure failure (out of memory, GPU crash)
- License or permission issues
- User explicitly requests human support`;

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
