// ─── Cooling Efficiency Predictor ──────────────────────────────────────────
// Predicts overall cooling efficiency by combining containment quality,
// rack thermal analysis, and PUE estimation into a single composite score.
// Acts as the top-level orchestrator for data center airflow diagnostics.
// ──────────────────────────────────────────────────────────────────────────

import type {
  DataCenterSimulationConfig,
  DataCenterMetrics,
  HotspotAssessment,
  ContainmentAssessment,
  PUEEstimate,
} from "@/packages/types";
import { RackHeatLoadModel } from "./rack-heat-load-model";
import { ContainmentLeakDetector } from "./containment-leak-detector";
import { PUEEstimator } from "./pue-estimator";

// ── Result ─────────────────────────────────────────────────────────────────

export interface CoolingEfficiencyReport {
  /** Composite cooling efficiency score (0–1, 1 = optimal). */
  coolingEfficiencyScore: number;
  /** Hotspot assessment from rack heat load model. */
  hotspotAssessment: HotspotAssessment;
  /** Containment leak assessment. */
  containmentAssessment: ContainmentAssessment;
  /** PUE estimate and breakdown. */
  pueEstimate: PUEEstimate;
  /** Consolidated recommendations (priority-sorted). */
  topRecommendations: string[];
}

// ── Predictor ──────────────────────────────────────────────────────────────

export class CoolingEfficiencyPredictor {
  private readonly rackModel = new RackHeatLoadModel();
  private readonly leakDetector = new ContainmentLeakDetector();
  private readonly pueEstimator = new PUEEstimator();

  /**
   * Run full data center cooling efficiency analysis.
   *
   * @param config  Data center simulation configuration.
   * @param metrics Optional post-processed metrics from CFD solver.
   * @param actualCoolingPower  Measured or solver-derived cooling power in kW.
   */
  predict(
    config: DataCenterSimulationConfig,
    metrics?: DataCenterMetrics,
    actualCoolingPower?: number
  ): CoolingEfficiencyReport {
    const hotspotAssessment = this.rackModel.assess(config, metrics);
    const containmentAssessment = this.leakDetector.assess(config, metrics);
    const pueEstimate = this.pueEstimator.estimate(config, metrics, actualCoolingPower);

    const coolingEfficiencyScore = metrics?.coolingEfficiencyScore
      ?? this.computeCompositeScore(hotspotAssessment, containmentAssessment, pueEstimate);

    const topRecommendations = this.consolidateRecommendations(
      hotspotAssessment,
      containmentAssessment,
      pueEstimate
    );

    return {
      coolingEfficiencyScore: round4(coolingEfficiencyScore),
      hotspotAssessment,
      containmentAssessment,
      pueEstimate,
      topRecommendations,
    };
  }

  // ── Composite Score ────────────────────────────────────────────────────

  /**
   * Composite cooling efficiency ∈ [0, 1].
   *
   * E = w₁·thermalHealth + w₂·containment + w₃·pueNorm
   *
   * Weights: thermal=0.35, containment=0.30, pue=0.35
   */
  private computeCompositeScore(
    hotspot: HotspotAssessment,
    containment: ContainmentAssessment,
    pue: PUEEstimate
  ): number {
    // Thermal health: 1 - (hotspot ratio)
    const totalRacks = hotspot.rackTemperatures.length;
    const thermalHealth = totalRacks > 0
      ? 1 - hotspot.hotspotCount / totalRacks
      : 1;

    // Containment: already 0–1
    const containmentScore = containment.containmentScore;

    // PUE normalized: map 1.0–2.5 to 1.0–0.0
    const pueNorm = clamp01((2.5 - pue.estimatedPUE) / 1.5);

    return clamp01(
      0.35 * thermalHealth +
      0.30 * containmentScore +
      0.35 * pueNorm
    );
  }

  // ── Consolidation ──────────────────────────────────────────────────────

  private consolidateRecommendations(
    hotspot: HotspotAssessment,
    containment: ContainmentAssessment,
    pue: PUEEstimate
  ): string[] {
    // Merge all recs, deduplicate, take top 6
    const all = [
      ...hotspot.mitigations,
      ...containment.mitigations,
      ...pue.recommendations,
    ];

    const unique = [...new Set(all)];
    return unique.slice(0, 6);
  }

  /** Check whether a generic SimulationConfig is a data center config. */
  static isDataCenterConfig(config: unknown): config is DataCenterSimulationConfig {
    return (
      typeof config === "object" &&
      config !== null &&
      "rackHeatLoad" in config &&
      "containment" in config
    );
  }
}

// ── Utility ───────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
