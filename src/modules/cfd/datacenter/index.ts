// ─── Data Center Airflow Module ────────────────────────────────────────────
// Server room / data hall CFD analysis: rack thermal management,
// containment leak detection, PUE estimation, and cooling efficiency.
// ──────────────────────────────────────────────────────────────────────────

export { RackHeatLoadModel } from "./rack-heat-load-model";
export { ContainmentLeakDetector } from "./containment-leak-detector";
export { PUEEstimator } from "./pue-estimator";
export { CoolingEfficiencyPredictor } from "./cooling-efficiency-predictor";
export type { CoolingEfficiencyReport } from "./cooling-efficiency-predictor";
