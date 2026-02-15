// ─── Compliance API Package Types ───────────────────────────────────────────
// Client-side types for the compliance edge function API.
// ──────────────────────────────────────────────────────────────────────────

import type { AirflowComplianceDomain, ComplianceFinding, ComplianceRiskReport } from "@/packages/types";

export type ComplianceVerdict = "compliant" | "conditionally_compliant" | "non_compliant";

export interface EvaluateRequest {
  domain: AirflowComplianceDomain;
  metrics: Record<string, number>;
  simulationId?: string;
  organizationId?: string;
  region?: "US" | "EU" | "Asia";
  industry?: "Cleanroom" | "Exhaust" | "DataCenter";
  effectiveDate?: string;
}

export interface EvaluateResponse {
  reportId: string;
  simulationId: string | null;
  organizationId: string | null;
  domain: AirflowComplianceDomain;
  region: string | null;
  industry: string | null;
  effectiveDate: string | null;
  findings: ComplianceFinding[];
  riskReport: ComplianceRiskReport;
  verdict: ComplianceVerdict;
  evaluatedAt: string;
}

export interface ReportResponse {
  reportId: string;
  simulationId: string | null;
  organizationId: string;
  domain: AirflowComplianceDomain;
  findings: ComplianceFinding[];
  riskReport: ComplianceRiskReport;
  verdict: ComplianceVerdict;
  simulationResult: {
    converged: boolean;
    totalIterations: number;
    pressureDrop: number;
    efficiencyRating: string;
    solveTimeSeconds: number;
  };
  generatedAt: string;
}

export interface RiskScoreResponse {
  simulationId: string;
  resultId: string;
  riskScore: number;
  highRiskCount: number;
  complianceProbability: number;
  projectedRemediationCost: number;
  totalFindings: number;
  violations: number;
  verdict: ComplianceVerdict;
  evaluatedAt: string;
}

export interface ComplianceApiError {
  error: string;
}
