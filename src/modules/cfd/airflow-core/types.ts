// ─── Airflow Core Engine Types ─────────────────────────────────────────────
// Unified domain classification and analysis result types for the
// AirflowCoreEngine orchestrator.
// ──────────────────────────────────────────────────────────────────────────

import type {
  SimulationConfig,
  FanSimulationConfig,
  CleanroomSimulationConfig,
  ExhaustSimulationConfig,
  AgricultureSimulationConfig,
  DataCenterSimulationConfig,
  EfficiencyMetrics,
  CleanroomMetrics,
  ExhaustSystemMetrics,
  AgricultureVentilationMetrics,
  DataCenterMetrics,
  HumanReadableSummary,
  ExhaustOptimizationResult,
  HeatStressAssessment,
  AmmoniaRiskAssessment,
  RotatingMeshAdjustments,
  VelocityFieldEntry,
  PressureFieldEntry,
  TemperatureFieldEntry,
  SpeciesRemovalBreakdown,
} from "@/packages/types";
import type { CoolingEfficiencyReport } from "../datacenter/cooling-efficiency-predictor";

// ── Domain Classification ──────────────────────────────────────────────────

export type AirflowDomain =
  | "hvac"
  | "fan-blower"
  | "cleanroom"
  | "industrial-exhaust"
  | "agriculture"
  | "data-center"
  | "generic";

// ── Unified Config Union ───────────────────────────────────────────────────

export type AnySimulationConfig =
  | SimulationConfig
  | FanSimulationConfig
  | CleanroomSimulationConfig
  | ExhaustSimulationConfig
  | AgricultureSimulationConfig
  | DataCenterSimulationConfig;

// ── Per-Domain Metrics Union ───────────────────────────────────────────────

export interface DomainMetrics {
  efficiency?: EfficiencyMetrics;
  cleanroom?: CleanroomMetrics;
  exhaust?: ExhaustSystemMetrics;
  agriculture?: AgricultureVentilationMetrics;
  dataCenter?: DataCenterMetrics;
}

// ── Per-Domain Analysis Result ─────────────────────────────────────────────

export interface HVACAnalysis {
  domain: "hvac";
  summary: HumanReadableSummary;
}

export interface FanBlowerAnalysis {
  domain: "fan-blower";
  summary: HumanReadableSummary;
  meshAdjustments: RotatingMeshAdjustments;
}

export interface CleanroomAnalysis {
  domain: "cleanroom";
  summary: HumanReadableSummary;
  isoClassEstimate: string;
  laminarStabilityScore: number;
}

export interface IndustrialExhaustAnalysis {
  domain: "industrial-exhaust";
  summary: HumanReadableSummary;
  optimization: ExhaustOptimizationResult;
}

export interface AgricultureAnalysis {
  domain: "agriculture";
  summary: HumanReadableSummary;
  heatStress: HeatStressAssessment;
  ammoniaRisk: AmmoniaRiskAssessment;
}

export interface DataCenterAnalysis {
  domain: "data-center";
  summary: HumanReadableSummary;
  coolingReport: CoolingEfficiencyReport;
}

export interface GenericAnalysis {
  domain: "generic";
  summary: HumanReadableSummary;
}

export type DomainAnalysis =
  | HVACAnalysis
  | FanBlowerAnalysis
  | CleanroomAnalysis
  | IndustrialExhaustAnalysis
  | AgricultureAnalysis
  | DataCenterAnalysis
  | GenericAnalysis;

// ── Core Engine Result ─────────────────────────────────────────────────────

export interface AirflowAnalysisResult {
  /** Detected airflow domain. */
  domain: AirflowDomain;
  /** Confidence in domain classification (0–1). */
  classificationConfidence: number;
  /** Domain-specific analysis. */
  analysis: DomainAnalysis;
  /** Consolidated recommendations across all analyses (priority-sorted). */
  topRecommendations: string[];
  /** Overall health score (0–1, 1 = optimal). */
  overallHealthScore: number;
  /** Timestamp of analysis. */
  analyzedAt: string;
}

// ── Field Data Bundle ──────────────────────────────────────────────────────

export interface FieldData {
  velocity: VelocityFieldEntry[];
  pressure: PressureFieldEntry[];
  temperature: TemperatureFieldEntry[];
}

// ── Exhaust Solver Data ────────────────────────────────────────────────────

export interface ExhaustSolverData {
  metrics: ExhaustSystemMetrics;
  speciesResults: SpeciesRemovalBreakdown[];
}
