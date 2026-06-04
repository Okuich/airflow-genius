import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Inline rule library (edge functions can't import from src/) ─────────

type ComplianceAuthority = "ASHRAE" | "ISO" | "OSHA" | "EPA";
type AirflowComplianceDomain = "hvac" | "cleanroom" | "exhaust" | "agriculture" | "data-center" | "general";

interface ComplianceRule {
  id: string;
  authority: ComplianceAuthority;
  standardCode: string;
  metric: string;
  threshold: number;
  operator: ">" | "<" | ">=" | "<=";
  severity: "Low" | "Medium" | "High" | "Critical";
  description: string;
}

interface ComplianceFinding {
  ruleId: string;
  status: "Pass" | "Fail";
  measuredValue: number;
  threshold: number;
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  recommendation: string;
}

interface ComplianceRiskReport {
  overallScore: number;
  highRiskCount: number;
  projectedRemediationCost: number;
  complianceProbability: number;
}

const RULE_LIBRARY: ComplianceRule[] = [
  { id: "ASHRAE-62.1-6.2", authority: "ASHRAE", standardCode: "62.1 §6.2", description: "Minimum outdoor air rate for breathing zone", metric: "outdoorAirRate", threshold: 2.5, operator: ">=", severity: "Critical" },
  { id: "ASHRAE-62.1-6.4", authority: "ASHRAE", standardCode: "62.1 §6.4", description: "Exhaust airflow for occupied spaces", metric: "exhaustAirflow", threshold: 0.5, operator: ">=", severity: "Medium" },
  { id: "ASHRAE-55-5.3.1a", authority: "ASHRAE", standardCode: "55 §5.3.1", description: "Operative temperature lower bound", metric: "operativeTemperature", threshold: 19.5, operator: ">=", severity: "Medium" },
  { id: "ASHRAE-55-5.3.1b", authority: "ASHRAE", standardCode: "55 §5.3.1", description: "Operative temperature upper bound", metric: "operativeTemperature", threshold: 27.5, operator: "<=", severity: "Medium" },
  { id: "ASHRAE-55-5.3.3", authority: "ASHRAE", standardCode: "55 §5.3.3", description: "Air speed limit for thermal comfort", metric: "maxAirSpeed", threshold: 0.8, operator: "<=", severity: "Low" },
  { id: "ISO-14644-4.3", authority: "ISO", standardCode: "14644 §4.3", description: "Air change rate for ISO 5 cleanroom", metric: "airChangeRate", threshold: 240, operator: ">=", severity: "Critical" },
  { id: "ISO-14644-B.4", authority: "ISO", standardCode: "14644 §B.4", description: "Unidirectional flow coverage", metric: "laminarCoverage", threshold: 0.80, operator: ">=", severity: "Critical" },
  { id: "ISO-14644-4.4", authority: "ISO", standardCode: "14644 §4.4", description: "Recovery time to ISO class", metric: "recoveryTime", threshold: 1200, operator: "<=", severity: "Medium" },
  { id: "OSHA-PEL-1910.1000", authority: "OSHA", standardCode: "29 CFR 1910.1000", description: "Permissible exposure limit", metric: "peakConcentration", threshold: 50, operator: "<=", severity: "Critical" },
  { id: "OSHA-Z1-T1", authority: "OSHA", standardCode: "29 CFR 1910.1000 Z-1", description: "8-hour TWA concentration", metric: "twaConcentration", threshold: 25, operator: "<=", severity: "Critical" },
  { id: "ACGIH-VS-10", authority: "OSHA", standardCode: "ACGIH VS-10", description: "Minimum hood capture velocity", metric: "captureVelocity", threshold: 0.5, operator: ">=", severity: "Critical" },
  { id: "NFPA-45-7.8a", authority: "OSHA", standardCode: "NFPA 45 §7.8", description: "Fume hood face velocity lower bound", metric: "faceVelocity", threshold: 0.4, operator: ">=", severity: "Medium" },
  { id: "NFPA-45-7.8b", authority: "OSHA", standardCode: "NFPA 45 §7.8", description: "Fume hood face velocity upper bound", metric: "faceVelocity", threshold: 0.6, operator: "<=", severity: "Medium" },
  { id: "OSHA-NH3-PEL", authority: "OSHA", standardCode: "29 CFR 1910.1000", description: "Ammonia 8-hr TWA exposure limit", metric: "ammoniaConcentration", threshold: 25, operator: "<=", severity: "Critical" },
  { id: "ACGIH-NH3-TLV", authority: "OSHA", standardCode: "ACGIH TLV-TWA", description: "Ammonia TLV-TWA", metric: "ammoniaConcentration", threshold: 25, operator: "<=", severity: "Medium" },
  { id: "ASHRAE-90.4-6.3", authority: "ASHRAE", standardCode: "90.4 §6.3", description: "Maximum mechanical PUE", metric: "estimatedPUE", threshold: 1.4, operator: "<=", severity: "Medium" },
  { id: "TIA-942-5.3a", authority: "ISO", standardCode: "TIA 942 §5.3.4", description: "Inlet temperature lower bound", metric: "rackInletTemp", threshold: 18, operator: ">=", severity: "Critical" },
  { id: "TIA-942-5.3b", authority: "ISO", standardCode: "TIA 942 §5.3.4", description: "Inlet temperature upper bound", metric: "rackInletTemp", threshold: 27, operator: "<=", severity: "Critical" },
  { id: "NEBS-GR3028-3.1", authority: "ISO", standardCode: "NEBS GR-3028 §3.1", description: "Equipment inlet temperature limit", metric: "rackInletTemp", threshold: 40, operator: "<=", severity: "Critical" },
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

function evaluate(metrics: Record<string, number>, domain: AirflowComplianceDomain): ComplianceFinding[] {
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
        status: passed ? "Pass" as const : "Fail" as const,
        measuredValue: value,
        threshold: rule.threshold,
        riskLevel: passed ? "Low" as const : rule.severity,
        recommendation: passed
          ? "No action required."
          : `${rule.description}: measured ${value}, required ${rule.operator} ${rule.threshold} per ${rule.authority} ${rule.standardCode}.`,
      };
    });
}

function computeRisk(findings: ComplianceFinding[]): ComplianceRiskReport {
  if (findings.length === 0) return { overallScore: 0, highRiskCount: 0, projectedRemediationCost: 0, complianceProbability: 1 };
  const failures = findings.filter((f) => f.status === "Fail");
  const totalWeight = failures.reduce((s, f) => s + RISK_WEIGHT[f.riskLevel], 0);
  const maxWeight = findings.length * RISK_WEIGHT.Critical;
  const overallScore = maxWeight > 0 ? Math.round((totalWeight / maxWeight) * 100) : 0;
  const highRiskCount = failures.filter((f) => f.riskLevel === "High" || f.riskLevel === "Critical").length;
  const projectedRemediationCost = failures.reduce((s, f) => s + REMEDIATION_COST[f.riskLevel], 0);
  const passWeight = findings.filter((f) => f.status === "Pass").reduce((s, f) => s + RISK_WEIGHT[f.riskLevel], 0);
  const complianceProbability = maxWeight > 0 ? Math.round((passWeight / maxWeight) * 100) / 100 : 1;
  return { overallScore, highRiskCount, projectedRemediationCost, complianceProbability };
}

// ── In-memory report store (per-instance) ──────────────────────────────

const reportStore = new Map<string, unknown>();

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
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { domain, metrics, simulationId, organizationId, region, industry, effectiveDate } = body;

    if (!domain || !metrics || typeof metrics !== "object") {
      return new Response(JSON.stringify({ error: "Missing required fields: domain, metrics" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const findings = evaluate(metrics, domain as AirflowComplianceDomain);
    const riskReport = computeRisk(findings);

    const reportId = `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = {
      reportId,
      simulationId: simulationId || null,
      organizationId: organizationId || null,
      domain,
      region: region || null,
      industry: industry || null,
      effectiveDate: effectiveDate || null,
      findings,
      riskReport,
      verdict: riskReport.highRiskCount > 0 || riskReport.overallScore >= 50
        ? "non_compliant"
        : findings.some((f) => f.status === "Fail")
          ? "conditionally_compliant"
          : "compliant",
      evaluatedAt: new Date().toISOString(),
    };

    // Store for retrieval by GET /compliance/report/:id
    reportStore.set(reportId, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("compliance-evaluate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
