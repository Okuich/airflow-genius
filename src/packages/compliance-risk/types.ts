// ─── Compliance Risk Package Types ──────────────────────────────────────────
// Extended risk analysis types beyond the core ComplianceRiskReport.
// ──────────────────────────────────────────────────────────────────────────

import type { ComplianceFinding, AirflowComplianceDomain } from "@/packages/types";

export type RiskTrend = "improving" | "stable" | "degrading";
export type RiskCategory = "regulatory" | "operational" | "financial" | "reputational";

export interface RiskWeightConfig {
  Low: number;
  Medium: number;
  High: number;
  Critical: number;
}

export interface RemediationCostConfig {
  Low: number;
  Medium: number;
  High: number;
  Critical: number;
}

export interface RiskBreakdown {
  category: RiskCategory;
  score: number;
  findingCount: number;
  topFindings: string[];
}

export interface RiskTrendPoint {
  timestamp: string;
  overallScore: number;
  violations: number;
}

export interface RiskTrendAnalysis {
  trend: RiskTrend;
  points: RiskTrendPoint[];
  deltaScore: number;
  deltaViolations: number;
}

export interface RiskMatrixEntry {
  ruleId: string;
  likelihood: number;
  impact: number;
  riskLevel: ComplianceFinding["riskLevel"];
  domain: AirflowComplianceDomain;
}

export interface RiskMatrixResult {
  entries: RiskMatrixEntry[];
  highRiskQuadrant: RiskMatrixEntry[];
  aggregateRisk: number;
}

export interface RemediationPriority {
  ruleId: string;
  description: string;
  severity: ComplianceFinding["riskLevel"];
  estimatedCost: number;
  riskReduction: number;
  costEffectiveness: number;
  deadline: string | null;
}

export interface RemediationPlan {
  priorities: RemediationPriority[];
  totalCost: number;
  estimatedRiskReduction: number;
  estimatedTimelineDays: number;
}
