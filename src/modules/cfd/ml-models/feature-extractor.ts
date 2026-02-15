// ─── Step 2: Feature Extraction ────────────────────────────────────────────
// Converts simulation configs and results into numeric feature vectors
// suitable for surrogate model training & inference.
//
// Two extraction modes:
//   1. extract(config)         → SimulationFeatureVector (pre-run, from config)
//   2. extractFromResults(r)   → FeatureVector           (post-run, deterministic)
// ──────────────────────────────────────────────────────────────────────────

import type {
  SimulationConfig,
  SimulationFeatureVector,
  SimulationCompletedEvent,
  SimulationResults,
  FeatureVector,
  BoundaryType,
  MeshStats,
  ResidualData,
  CleanroomSimulationConfig,
  ParticleDispersionMetrics,
  CleanroomMetrics,
} from "@/packages/types";
import { FlowType, TurbulenceType } from "@/packages/types";

const TURBULENCE_INDEX: Record<string, number> = {
  [TurbulenceType.KEpsilon]: 0,
  [TurbulenceType.KEpsilonRNG]: 1,
  [TurbulenceType.SST]: 2,
  [TurbulenceType.SpalartAllmaras]: 3,
};

const EFFICIENCY_NUMERIC: Record<string, number> = {
  Poor: 0,
  Average: 0.33,
  Good: 0.67,
  Excellent: 1.0,
};

export class FeatureExtractor {
  // ── Config-based feature names (pre-run) ────────────────────────────

  static readonly FEATURE_NAMES: (keyof SimulationFeatureVector)[] = [
    "cellCount", "baseSize", "refinementLevels", "boundaryLayerCount",
    "boundaryLayerGrowthRate", "qualityThreshold",
    "flowType", "turbulenceModel", "maxIterations", "convergenceCriteria",
    "relaxationPressure", "relaxationVelocity", "relaxationTurbulence",
    "fluidDensity", "fluidViscosity", "reynoldsNumber",
    "inletCount", "outletCount", "wallCount",
    "maxInletVelocity", "avgInletVelocity",
    "hasRotatingFrame", "rpm",
  ];

  // ── Results-based feature names (post-run) ──────────────────────────

  static readonly RESULT_FEATURE_NAMES: (keyof FeatureVector)[] = [
    "reynoldsNumber", "turbulenceIntensity", "pressureDrop",
    "efficiency", "meshQualityScore", "convergenceSpeed",
  ];

  // ════════════════════════════════════════════════════════════════════
  //  POST-RUN: Extract FeatureVector from SimulationResults
  // ════════════════════════════════════════════════════════════════════

  /** Deterministic feature extraction from completed simulation results. */
  extractFromResults(results: SimulationResults): FeatureVector {
    return {
      reynoldsNumber: this.computeReynoldsNumber(results.config),
      turbulenceIntensity: this.computeTurbulenceIntensity(results.config),
      pressureDrop: results.pressureDrop,
      efficiency: this.computeEfficiency(results.efficiencyRating),
      meshQualityScore: this.computeMeshQualityScore(results.meshStats),
      convergenceSpeed: this.computeConvergenceSpeed(results),
    };
  }

  /** Convert a FeatureVector to a flat number array. */
  resultToArray(features: FeatureVector): number[] {
    return FeatureExtractor.RESULT_FEATURE_NAMES.map((k) => features[k]);
  }

  // ── Deterministic Calculations ──────────────────────────────────────

  /**
   * Reynolds number: Re = ρ · V · L / μ
   * Uses average inlet velocity and mesh base size as characteristic length.
   */
  private computeReynoldsNumber(config: SimulationConfig): number {
    const bcs = config.boundaryConditions;
    const inlets = bcs.filter((bc) =>
      bc.type === ("inlet" as BoundaryType) ||
      bc.type === ("velocity_inlet" as BoundaryType) ||
      bc.type === ("pressure_inlet" as BoundaryType)
    );

    const velocities = inlets
      .filter((bc) => bc.velocity)
      .map((bc) => Math.sqrt(bc.velocity!.x ** 2 + bc.velocity!.y ** 2 + bc.velocity!.z ** 2));

    const avgVelocity = velocities.length > 0
      ? velocities.reduce((a, b) => a + b, 0) / velocities.length
      : 0;

    const charLength = config.meshSettings.baseSize;
    const re = config.fluidDensity * avgVelocity * charLength / config.fluidViscosity;

    return Math.round(re * 100) / 100;
  }

  /**
   * Turbulence intensity from the turbulence model config.
   * If explicit value is set, use it; otherwise estimate from Re.
   * Empirical correlation: I ≈ 0.16 · Re^(-1/8)
   */
  private computeTurbulenceIntensity(config: SimulationConfig): number {
    // Use explicitly configured value if available
    if (config.turbulenceModel.turbulentIntensity > 0) {
      return Math.round(config.turbulenceModel.turbulentIntensity * 10000) / 10000;
    }

    // Empirical estimate: I = 0.16 * Re^(-1/8)
    const re = this.computeReynoldsNumber(config);
    if (re <= 0) return 0.05; // default 5% for zero-flow

    const intensity = 0.16 * Math.pow(re, -1 / 8);
    return Math.round(intensity * 10000) / 10000;
  }

  /**
   * Map EfficiencyRating to a continuous [0, 1] score.
   * Poor=0, Average=0.33, Good=0.67, Excellent=1.0
   */
  private computeEfficiency(rating: string): number {
    return EFFICIENCY_NUMERIC[rating] ?? 0;
  }

  /**
   * Composite mesh quality score ∈ [0, 1].
   *
   * MQS = w₁·(1 - skewness) + w₂·orthogonality + w₃·(1 - AR_norm) + w₄·(1 - nonOrtho%)
   *
   * Weights: skewness=0.3, orthogonality=0.3, aspect_ratio=0.2, nonOrtho=0.2
   * All sub-scores clamped to [0, 1].
   */
  private computeMeshQualityScore(stats: MeshStats): number {
    const skewnessScore = clamp01(1 - stats.maxSkewness);
    const orthoScore = clamp01(stats.avgOrthogonality);
    const arNorm = clamp01(stats.maxAspectRatio / 100); // normalize: 100 → worst
    const arScore = clamp01(1 - arNorm);
    const nonOrthoScore = clamp01(1 - stats.nonOrthogonalCellPercent / 100);

    const mqs = 0.3 * skewnessScore + 0.3 * orthoScore + 0.2 * arScore + 0.2 * nonOrthoScore;
    return Math.round(mqs * 10000) / 10000;
  }

  /**
   * Convergence speed ∈ [0, 1].
   *
   * Measures how quickly residuals dropped to the convergence target.
   *   CS = 1 - (actualIterations / maxIterations)
   *
   * Bonus: if the last-quarter residual slope is steep (fast convergence),
   * apply a 10% bonus. Penalize if simulation did not converge.
   */
  private computeConvergenceSpeed(results: SimulationResults): number {
    const { config, residuals, totalIterations, converged } = results;
    const maxIter = config.solverSettings.maxIterations;

    if (!converged) return 0;
    if (maxIter <= 0) return 0;

    // Base score: fraction of iterations saved
    let cs = 1 - totalIterations / maxIter;
    cs = clamp01(cs);

    // Slope bonus: measure log₁₀(continuity) drop rate in last 25%
    if (residuals.length >= 8) {
      const quarter = Math.max(2, Math.floor(residuals.length * 0.25));
      const tail = residuals.slice(-quarter);
      const slope = this.computeResidualSlope(tail);

      // Negative slope = converging. Steeper = faster.
      if (slope < -0.01) {
        cs = Math.min(1, cs + 0.1);
      }
    }

    return Math.round(cs * 10000) / 10000;
  }

  /**
   * Linear regression slope of log₁₀(continuity) vs iteration index.
   * Returns negative values for converging residuals.
   */
  private computeResidualSlope(residuals: ResidualData[]): number {
    const n = residuals.length;
    if (n < 2) return 0;

    const ys = residuals.map((r) => Math.log10(Math.max(r.continuity, 1e-20)));
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += ys[i];
      sumXY += i * ys[i];
      sumX2 += i * i;
    }

    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 1e-12) return 0;

    return (n * sumXY - sumX * sumY) / denom;
  }

  // ════════════════════════════════════════════════════════════════════
  //  PRE-RUN: Extract SimulationFeatureVector from config
  // ════════════════════════════════════════════════════════════════════

  /** Extract feature vector from a simulation config. */
  extract(config: SimulationConfig): SimulationFeatureVector {
    const bcs = config.boundaryConditions;

    const inlets = bcs.filter((bc) =>
      bc.type === ("inlet" as BoundaryType) ||
      bc.type === ("velocity_inlet" as BoundaryType) ||
      bc.type === ("pressure_inlet" as BoundaryType)
    );
    const outlets = bcs.filter((bc) =>
      bc.type === ("outlet" as BoundaryType) ||
      bc.type === ("pressure_outlet" as BoundaryType)
    );
    const walls = bcs.filter((bc) =>
      bc.type === ("wall" as BoundaryType) ||
      bc.type === ("rotating_wall" as BoundaryType)
    );

    const inletVelocities = inlets
      .filter((bc) => bc.velocity)
      .map((bc) => Math.sqrt(bc.velocity!.x ** 2 + bc.velocity!.y ** 2 + bc.velocity!.z ** 2));

    const maxInletVelocity = inletVelocities.length > 0 ? Math.max(...inletVelocities) : 0;
    const avgInletVelocity = inletVelocities.length > 0
      ? inletVelocities.reduce((a, b) => a + b, 0) / inletVelocities.length : 0;

    const charLength = config.meshSettings.baseSize;
    const reynoldsNumber = config.fluidDensity * avgInletVelocity * charLength / config.fluidViscosity;

    return {
      cellCount: config.meshSettings.targetCellCount,
      baseSize: config.meshSettings.baseSize,
      refinementLevels: config.meshSettings.refinementLevels,
      boundaryLayerCount: config.meshSettings.boundaryLayerCount,
      boundaryLayerGrowthRate: config.meshSettings.boundaryLayerGrowthRate,
      qualityThreshold: config.meshSettings.qualityThreshold,
      flowType: this.encodeFlowType(config.flowType),
      turbulenceModel: TURBULENCE_INDEX[config.turbulenceModel.type] ?? 0,
      maxIterations: config.solverSettings.maxIterations,
      convergenceCriteria: config.solverSettings.convergenceCriteria,
      relaxationPressure: config.solverSettings.relaxationPressure,
      relaxationVelocity: config.solverSettings.relaxationVelocity,
      relaxationTurbulence: config.solverSettings.relaxationTurbulence,
      fluidDensity: config.fluidDensity,
      fluidViscosity: config.fluidViscosity,
      reynoldsNumber,
      inletCount: inlets.length,
      outletCount: outlets.length,
      wallCount: walls.length,
      maxInletVelocity,
      avgInletVelocity,
      hasRotatingFrame: config.rotatingFrame?.enabled ? 1 : 0,
      rpm: config.rotatingFrame?.rotationSpeed ?? 0,
    };
  }

  // ── Cleanroom / Particle Dispersion Features ────────────────────────

  /**
   * Extract particle-dispersion-specific features from cleanroom simulation results.
   * Returns null if the config is not a cleanroom simulation.
   */
  extractCleanroomFeatures(
    config: SimulationConfig,
    dispersion?: ParticleDispersionMetrics,
    cleanroom?: CleanroomMetrics
  ): CleanroomFeatureSet | null {
    if (!isCleanroomConfig(config)) return null;
    const cr = config as CleanroomSimulationConfig;

    return {
      particleDiameter: cr.particleTransport.particleDiameter,
      particleDensity: cr.particleTransport.particleDensity,
      parcelCount: cr.particleTransport.parcelCount,
      gravitySedimentation: cr.particleTransport.gravitySedimentation ? 1 : 0,
      brownianDiffusion: cr.particleTransport.brownianDiffusion ? 1 : 0,
      roomVolume: cr.roomVolume,
      filterFaceVelocity: cr.filterFaceVelocity,
      targetISOClass: isoClassToNumeric(cr.targetISOClass),
      airChangeRate: cleanroom?.airChangeRate ?? 0,
      particleRetentionRate: cleanroom?.particleRetentionRate ?? 0,
      laminarStabilityScore: cleanroom?.laminarStabilityScore ?? 0,
      meanResidenceTime: dispersion?.meanResidenceTime ?? 0,
      removalEfficiency: dispersion?.removalEfficiency ?? 0,
      peakConcentration: dispersion?.peakConcentration ?? 0,
      uniformityIndex: dispersion?.uniformityIndex ?? 0,
    };
  }

  /** Encode FlowType to a numeric value for the feature vector. */
  private encodeFlowType(ft: FlowType): number {
    switch (ft) {
      case FlowType.Steady: return 0;
      case FlowType.Transient: return 1;
      case FlowType.LaminarFlowValidation: return 2;
      case FlowType.ParticleDispersion: return 3;
      case FlowType.ContaminantDecay: return 4;
      case FlowType.ExhaustVentilation: return 5;
      case FlowType.BuoyancyDriven: return 6;
      case FlowType.AgricultureVentilation: return 7;
      default: return 0;
    }
  }

  /** Extract from a completed-event payload (convenience). */
  extractFromEvent(event: SimulationCompletedEvent): SimulationFeatureVector {
    return this.extract(event.config);
  }

  /** Convert a SimulationFeatureVector to a flat number array. */
  toArray(features: SimulationFeatureVector): number[] {
    return FeatureExtractor.FEATURE_NAMES.map((k) => features[k]);
  }
}

// ── Utility ───────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ── Cleanroom Helpers ─────────────────────────────────────────────────────

export interface CleanroomFeatureSet {
  particleDiameter: number;
  particleDensity: number;
  parcelCount: number;
  gravitySedimentation: number;
  brownianDiffusion: number;
  roomVolume: number;
  filterFaceVelocity: number;
  targetISOClass: number;
  airChangeRate: number;
  particleRetentionRate: number;
  laminarStabilityScore: number;
  meanResidenceTime: number;
  removalEfficiency: number;
  peakConcentration: number;
  uniformityIndex: number;
}

function isCleanroomConfig(config: SimulationConfig): config is CleanroomSimulationConfig {
  return "particleTransport" in config && "roomVolume" in config;
}

function isoClassToNumeric(iso: string): number {
  const match = iso.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 7;
}
