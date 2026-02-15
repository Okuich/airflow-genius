// ─── Airflow Core Engine ───────────────────────────────────────────────────
// Unified orchestrator for all airflow domains:
// HVAC · Fan/Blower · Cleanroom · Industrial Exhaust · Agriculture · Data Center
// ──────────────────────────────────────────────────────────────────────────

export { AirflowCoreEngine } from "./airflow-core-engine";
export type {
  AirflowDomain,
  AnySimulationConfig,
  DomainMetrics,
  AirflowAnalysisResult,
  DomainAnalysis,
  HVACAnalysis,
  FanBlowerAnalysis,
  CleanroomAnalysis,
  IndustrialExhaustAnalysis,
  AgricultureAnalysis,
  DataCenterAnalysis,
  GenericAnalysis,
  FieldData,
  ExhaustSolverData,
} from "./types";
