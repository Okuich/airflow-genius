// ─── Exhaust Optimization Engine ───────────────────────────────────────────
// Evaluates industrial exhaust system performance and generates
// actionable recommendations for hood design, duct sizing, and fan selection.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ExhaustSimulationConfig,
  ExhaustSystemMetrics,
  ExhaustOptimizationResult,
  ExhaustRecommendation,
  SpeciesRemovalBreakdown,
  BackflowAssessment,
  SimulationConfig,
  BoundaryCondition,
} from "@/packages/types";
import { BackflowRiskPredictor } from "./backflow-risk-predictor";

// ── Constants ──────────────────────────────────────────────────────────────

/** ACGIH recommended minimum capture velocity for moderate toxicity. */
const MIN_CAPTURE_VELOCITY = 0.5; // m/s
/** Excellent removal efficiency threshold. */
const EXCELLENT_REMOVAL = 0.95;
/** Good removal efficiency threshold. */
const GOOD_REMOVAL = 0.80;

// ── Engine ─────────────────────────────────────────────────────────────────

export class ExhaustOptimizationEngine {
  private readonly backflowPredictor = new BackflowRiskPredictor();

  /**
   * Analyse an exhaust simulation and produce an optimisation report.
   *
   * @param config - The exhaust simulation configuration.
   * @param metrics - Post-processed exhaust system metrics from the solver.
   * @param speciesResults - Per-species mass-fraction data at inlet/outlet.
   */
  evaluate(
    config: ExhaustSimulationConfig,
    metrics: ExhaustSystemMetrics,
    speciesResults: SpeciesRemovalBreakdown[]
  ): ExhaustOptimizationResult {
    const captureVelocityRatio = metrics.captureVelocity / config.targetCaptureVelocity;
    const predictedRemovalEfficiency = metrics.contaminantRemovalEfficiency;
    const effectivenessScore = this.computeEffectivenessScore(
      captureVelocityRatio,
      predictedRemovalEfficiency,
      metrics.negativePressureStability,
      metrics.backflowRiskScore
    );

    const recommendations = this.generateRecommendations(
      config,
      metrics,
      captureVelocityRatio,
      speciesResults
    );

    const backflowAssessment = this.backflowPredictor.assess(config, metrics);

    return {
      effectivenessScore: round4(effectivenessScore),
      captureVelocityRatio: round4(captureVelocityRatio),
      predictedRemovalEfficiency: round4(predictedRemovalEfficiency),
      recommendations,
      speciesBreakdown: speciesResults,
      backflowAssessment,
    };
  }

  // ── Effectiveness Score ─────────────────────────────────────────────────

  /**
   * Composite effectiveness score ∈ [0, 1].
   *
   * E = w₁·min(captureRatio, 1) + w₂·removal + w₃·pressureStability + w₄·(1 - backflowRisk)
   *
   * Weights: capture=0.30, removal=0.35, stability=0.20, backflow=0.15
   */
  private computeEffectivenessScore(
    captureRatio: number,
    removal: number,
    pressureStability: number,
    backflowRisk: number
  ): number {
    const cappedCapture = clamp01(captureRatio);
    const score =
      0.30 * cappedCapture +
      0.35 * clamp01(removal) +
      0.20 * clamp01(pressureStability) +
      0.15 * clamp01(1 - backflowRisk);
    return clamp01(score);
  }

  // ── Recommendations ─────────────────────────────────────────────────────

  private generateRecommendations(
    config: ExhaustSimulationConfig,
    metrics: ExhaustSystemMetrics,
    captureRatio: number,
    speciesResults: SpeciesRemovalBreakdown[]
  ): ExhaustRecommendation[] {
    const recs: ExhaustRecommendation[] = [];

    // ── Capture velocity ────────────────────────────────────────────────
    if (captureRatio < 0.8) {
      recs.push({
        category: "hood_design",
        message: `Capture velocity (${metrics.captureVelocity.toFixed(2)} m/s) is ${((1 - captureRatio) * 100).toFixed(0)}% below target. Reduce hood-to-source distance or increase hood face area.`,
        priority: "critical",
        estimatedImprovement: `Increase capture velocity to ≥ ${config.targetCaptureVelocity.toFixed(2)} m/s`,
      });
    } else if (captureRatio < 1.0) {
      recs.push({
        category: "fan_selection",
        message: `Capture velocity slightly below target — consider increasing fan speed or upgrading to a higher-capacity fan.`,
        priority: "medium",
        estimatedImprovement: `Close the ${((1 - captureRatio) * 100).toFixed(0)}% velocity gap`,
      });
    }

    if (metrics.captureVelocity < MIN_CAPTURE_VELOCITY) {
      recs.push({
        category: "hood_design",
        message: `Capture velocity (${metrics.captureVelocity.toFixed(2)} m/s) is below ACGIH minimum of ${MIN_CAPTURE_VELOCITY} m/s for moderate-toxicity contaminants.`,
        priority: "critical",
        estimatedImprovement: "Achieve regulatory compliance",
      });
    }

    // ── Removal efficiency ──────────────────────────────────────────────
    if (metrics.contaminantRemovalEfficiency < GOOD_REMOVAL) {
      recs.push({
        category: "duct_sizing",
        message: `Removal efficiency ${(metrics.contaminantRemovalEfficiency * 100).toFixed(1)}% is below acceptable threshold. Check for duct leaks, insufficient transport velocity, or re-entrainment.`,
        priority: "high",
        estimatedImprovement: `Improve removal to ≥ ${GOOD_REMOVAL * 100}%`,
      });
    } else if (metrics.contaminantRemovalEfficiency < EXCELLENT_REMOVAL) {
      recs.push({
        category: "duct_sizing",
        message: `Removal efficiency ${(metrics.contaminantRemovalEfficiency * 100).toFixed(1)}% is acceptable but could be improved with optimized duct routing.`,
        priority: "low",
        estimatedImprovement: `Target ≥ ${EXCELLENT_REMOVAL * 100}%`,
      });
    }

    // ── Negative pressure stability ─────────────────────────────────────
    if (metrics.negativePressureStability < 0.7) {
      recs.push({
        category: "baffle_placement",
        message: `Negative pressure stability is low (${(metrics.negativePressureStability * 100).toFixed(0)}%). Cross-drafts or door openings may be disrupting containment. Add baffles or curtains.`,
        priority: "high",
        estimatedImprovement: "Stabilize enclosure pressure differential",
      });
    }

    // ── Backflow ────────────────────────────────────────────────────────
    if (metrics.backflowRiskScore > 0.5) {
      recs.push({
        category: "fan_selection",
        message: `High backflow risk (${(metrics.backflowRiskScore * 100).toFixed(0)}%). Exhaust fan may be undersized or duct losses exceed available static pressure.`,
        priority: "critical",
        estimatedImprovement: "Eliminate reverse flow at exhaust openings",
      });
    }

    // ── Species-specific ────────────────────────────────────────────────
    for (const sp of speciesResults) {
      if (sp.exceedsExposureLimit) {
        recs.push({
          category: "source_control",
          message: `${sp.speciesName} outlet concentration exceeds the occupational exposure limit. Increase exhaust flow rate or add local source enclosure.`,
          priority: "critical",
          estimatedImprovement: `Reduce ${sp.speciesName} exposure below TLV`,
        });
      }
    }

    // ── Buoyancy ────────────────────────────────────────────────────────
    if (config.buoyancy?.enabled) {
      const hasOverheadExhaust = this.hasOverheadExhaust(config);
      if (!hasOverheadExhaust) {
        recs.push({
          category: "hood_design",
          message: "Buoyancy-driven flow is enabled but no overhead exhaust detected. Hot contaminant plumes rise — consider a canopy hood or high-level extraction point.",
          priority: "high",
          estimatedImprovement: "Capture buoyant plume before it disperses",
        });
      }
    }

    return recs;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private hasOverheadExhaust(config: ExhaustSimulationConfig): boolean {
    // Heuristic: if any exhaust boundary has a velocity component in the +y direction
    // (upward) or is named with "canopy"/"overhead"/"high", treat as overhead.
    for (const bc of config.boundaryConditions) {
      if (!config.exhaustBoundaryIds.includes(bc.id)) continue;
      if (bc.velocity && bc.velocity.y > 0) return true;
      if (/canopy|overhead|high|ceiling/i.test(bc.name)) return true;
    }
    return false;
  }

  /** Check whether a generic SimulationConfig is an exhaust config. */
  static isExhaustConfig(config: SimulationConfig): config is ExhaustSimulationConfig {
    return "speciesTransport" in config && "exhaustBoundaryIds" in config;
  }
}

// ── Utility ───────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
