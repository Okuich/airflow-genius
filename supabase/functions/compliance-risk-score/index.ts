import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Inline compliance logic ─────────────────────────────────────────────

type AirflowComplianceDomain = "hvac" | "cleanroom" | "exhaust" | "agriculture" | "data-center" | "general";

interface ComplianceRule {
  id: string; authority: string; standardCode: string; metric: string;
  threshold: number; operator: string; severity: string; description: string;
}

const RULE_LIBRARY: ComplianceRule[] = [
  { id: "ASHRAE-62.1-6.2", authority: "ASHRAE", standardCode: "62.1 §6.2", description: "Minimum outdoor air rate", metric: "outdoorAirRate", threshold: 2.5, operator: ">=", severity: "Critical" },
  { id: "ASHRAE-62.1-6.4", authority: "ASHRAE", standardCode: "62.1 §6.4", description: "Exhaust airflow", metric: "exhaustAirflow", threshold: 0.5, operator: ">=", severity: "Medium" },
  { id: "ASHRAE-55-5.3.1a", authority: "ASHRAE", standardCode: "55 §5.3.1", description: "Operative temp lower", metric: "operativeTemperature", threshold: 19.5, operator: ">=", severity: "Medium" },
  { id: "ASHRAE-55-5.3.1b", authority: "ASHRAE", standardCode: "55 §5.3.1", description: "Operative temp upper", metric: "operativeTemperature", threshold: 27.5, operator: "<=", severity: "Medium" },
  { id: "ASHRAE-55-5.3.3", authority: "ASHRAE", standardCode: "55 §5.3.3", description: "Air speed limit", metric: "maxAirSpeed", threshold: 0.8, operator: "<=", severity: "Low" },
  { id: "ISO-14644-4.3", authority: "ISO", standardCode: "14644 §4.3", description: "Air change rate ISO 5", metric: "airChangeRate", threshold: 240, operator: ">=", severity: "Critical" },
  { id: "ISO-14644-B.4", authority: "ISO", standardCode: "14644 §B.4", description: "Unidirectional flow", metric: "laminarCoverage", threshold: 0.80, operator: ">=", severity: "Critical" },
  { id: "ISO-14644-4.4", authority: "ISO", standardCode: "14644 §4.4", description: "Recovery time", metric: "recoveryTime", threshold: 1200, operator: "<=", severity: "Medium" },
  { id: "OSHA-PEL-1910.1000", authority: "OSHA", standardCode: "29 CFR 1910.1000", description: "PEL", metric: "peakConcentration", threshold: 50, operator: "<=", severity: "Critical" },
  { id: "OSHA-Z1-T1", authority: "OSHA", standardCode: "29 CFR 1910.1000 Z-1", description: "8-hr TWA", metric: "twaConcentration", threshold: 25, operator: "<=", severity: "Critical" },
  { id: "ACGIH-VS-10", authority: "OSHA", standardCode: "ACGIH VS-10", description: "Hood capture velocity", metric: "captureVelocity", threshold: 0.5, operator: ">=", severity: "Critical" },
  { id: "NFPA-45-7.8a", authority: "OSHA", standardCode: "NFPA 45 §7.8", description: "Face velocity lower", metric: "faceVelocity", threshold: 0.4, operator: ">=", severity: "Medium" },
  { id: "NFPA-45-7.8b", authority: "OSHA", standardCode: "NFPA 45 §7.8", description: "Face velocity upper", metric: "faceVelocity", threshold: 0.6, operator: "<=", severity: "Medium" },
  { id: "OSHA-NH3-PEL", authority: "OSHA", standardCode: "29 CFR 1910.1000", description: "Ammonia PEL", metric: "ammoniaConcentration", threshold: 25, operator: "<=", severity: "Critical" },
  { id: "ACGIH-NH3-TLV", authority: "OSHA", standardCode: "ACGIH TLV-TWA", description: "Ammonia TLV", metric: "ammoniaConcentration", threshold: 25, operator: "<=", severity: "Medium" },
  { id: "ASHRAE-90.4-6.3", authority: "ASHRAE", standardCode: "90.4 §6.3", description: "Max PUE", metric: "estimatedPUE", threshold: 1.4, operator: "<=", severity: "Medium" },
  { id: "TIA-942-5.3a", authority: "ISO", standardCode: "TIA 942 §5.3.4", description: "Inlet temp lower", metric: "rackInletTemp", threshold: 18, operator: ">=", severity: "Critical" },
  { id: "TIA-942-5.3b", authority: "ISO", standardCode: "TIA 942 §5.3.4", description: "Inlet temp upper", metric: "rackInletTemp", threshold: 27, operator: "<=", severity: "Critical" },
  { id: "NEBS-GR3028-3.1", authority: "ISO", standardCode: "NEBS GR-3028 §3.1", description: "Equipment inlet limit", metric: "rackInletTemp", threshold: 40, operator: "<=", severity: "Critical" },
];

const RULE_DOMAIN_MAP: Record<string, AirflowComplianceDomain> = {
  "ASHRAE-62.1-6.2": "hvac", "ASHRAE-62.1-6.4": "hvac",
  "ASHRAE-55-5.3.1a": "hvac", "ASHRAE-55-5.3.1b": "hvac", "ASHRAE-55-5.3.3": "hvac",
  "ISO-14644-4.3": "cleanroom", "ISO-14644-B.4": "cleanroom", "ISO-14644-4.4": "cleanroom",
  "OSHA-PEL-1910.1000": "exhaust", "OSHA-Z1-T1": "exhaust", "ACGIH-VS-10": "exhaust",
  "NFPA-45-7.8a": "exhaust", "NFPA-45-7.8b": "exhaust",
  "OSHA-NH3-PEL": "agriculture", "ACGIH-NH3-TLV": "agriculture",
  "ASHRAE-90.4-6.3": "data-center", "TIA-942-5.3a": "data-center",
  "TIA-942-5.3b": "data-center", "NEBS-GR3028-3.1": "data-center",
};

const RISK_WEIGHT: Record<string, number> = { Low: 1, Medium: 3, High: 4, Critical: 5 };
const REMEDIATION_COST: Record<string, number> = { Low: 500, Medium: 2500, High: 10000, Critical: 25000 };

function checkRule(rule: ComplianceRule, value: number): boolean {
  switch (rule.operator) {
    case ">": return value > rule.threshold;
    case "<": return value < rule.threshold;
    case ">=": return value >= rule.threshold;
    case "<=": return value <= rule.threshold;
    default: return false;
  }
}

function evaluateMetrics(metrics: Record<string, number>, domain: AirflowComplianceDomain) {
  const applicable = RULE_LIBRARY.filter((r) => {
    const rd = RULE_DOMAIN_MAP[r.id];
    return rd === domain || rd === "general";
  });
  return applicable
    .filter((rule) => metrics[rule.metric] !== undefined)
    .map((rule) => {
      const value = metrics[rule.metric];
      const passed = checkRule(rule, value);
      return {
        ruleId: rule.id,
        status: passed ? "Pass" : "Fail",
        measuredValue: value,
        threshold: rule.threshold,
        riskLevel: passed ? "Low" : rule.severity,
      };
    });
}

function computeRisk(findings: { status: string; riskLevel: string }[]) {
  if (findings.length === 0) return { overallScore: 0, highRiskCount: 0, projectedRemediationCost: 0, complianceProbability: 1 };
  const failures = findings.filter((f) => f.status === "Fail");
  const totalWeight = failures.reduce((s, f) => s + (RISK_WEIGHT[f.riskLevel] || 1), 0);
  const maxWeight = findings.length * RISK_WEIGHT.Critical;
  const overallScore = maxWeight > 0 ? Math.round((totalWeight / maxWeight) * 100) : 0;
  const highRiskCount = failures.filter((f) => f.riskLevel === "High" || f.riskLevel === "Critical").length;
  const projectedRemediationCost = failures.reduce((s, f) => s + (REMEDIATION_COST[f.riskLevel] || 500), 0);
  const passWeight = findings.filter((f) => f.status === "Pass").reduce((s, f) => s + (RISK_WEIGHT[f.riskLevel] || 1), 0);
  const complianceProbability = maxWeight > 0 ? Math.round((passWeight / maxWeight) * 100) / 100 : 1;
  return { overallScore, highRiskCount, projectedRemediationCost, complianceProbability };
}

// ── Handler ─────────────────────────────────────────────────────────────

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
    if (req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use GET." }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const simulationId = url.searchParams.get("simulationId");

    if (!simulationId) {
      return new Response(JSON.stringify({ error: "Missing query parameter: simulationId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch the simulation result for this simulation
    const { data, error } = await supabase
      .from("simulation_results")
      .select("*")
      .eq("simulation_id", simulationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("DB error:", error);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data) {
      return new Response(JSON.stringify({ error: "No results found for this simulation" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = (data.config || {}) as Record<string, unknown>;
    const domain = (config.domain as AirflowComplianceDomain) || "general";
    const metrics = (config.metrics as Record<string, number>) || {};

    const findings = evaluateMetrics(metrics, domain);
    const riskReport = computeRisk(findings);

    const result = {
      simulationId,
      resultId: data.id,
      riskScore: riskReport.overallScore,
      highRiskCount: riskReport.highRiskCount,
      complianceProbability: riskReport.complianceProbability,
      projectedRemediationCost: riskReport.projectedRemediationCost,
      totalFindings: findings.length,
      violations: findings.filter((f) => f.status === "Fail").length,
      verdict: riskReport.highRiskCount > 0 || riskReport.overallScore >= 50
        ? "non_compliant"
        : findings.some((f) => f.status === "Fail") ? "conditionally_compliant" : "compliant",
      evaluatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("compliance-risk-score error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
