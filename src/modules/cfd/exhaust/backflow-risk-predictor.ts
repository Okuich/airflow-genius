// ─── Backflow Risk Predictor ───────────────────────────────────────────────
// Deterministic predictor that assesses backflow risk at exhaust boundaries
// using simulation config geometry, boundary conditions, and post-processed
// metrics. No ML — purely physics-based heuristics.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ExhaustSimulationConfig,
  ExhaustSystemMetrics,
  BackflowAssessment,
  BoundaryBackflowRisk,
  BoundaryCondition,
  Vector3,
} from "@/packages/types";
import { BoundaryType } from "@/packages/types";

// ── Constants ──────────────────────────────────────────────────────────────

/** Minimum duct transport velocity to prevent settling & backflow (m/s). */
const MIN_TRANSPORT_VELOCITY = 10;
/** Pressure margin below ambient required to prevent backflow (Pa). */
const MIN_NEGATIVE_PRESSURE_PA = -25;
/** Velocity ratio (reverse / forward) threshold for concern. */
const REVERSE_VELOCITY_THRESHOLD = 0.05;

// ── Risk Level Thresholds ──────────────────────────────────────────────────

const RISK_LOW = 0.2;
const RISK_MEDIUM = 0.5;
const RISK_HIGH = 0.8;

// ── Predictor ──────────────────────────────────────────────────────────────

export class BackflowRiskPredictor {
  /**
   * Assess backflow risk across all exhaust boundaries.
   *
   * @param config - The exhaust simulation configuration.
   * @param metrics - Post-processed exhaust system metrics.
   * @param boundaryResults - Optional per-boundary reverse-flow data from post-processing.
   */
  assess(
    config: ExhaustSimulationConfig,
    metrics: ExhaustSystemMetrics,
    boundaryResults?: BoundaryBackflowRisk[]
  ): BackflowAssessment {
    const boundaryRisks =
      boundaryResults ?? this.predictBoundaryRisks(config, metrics);

    const overallRisk = this.computeOverallRisk(metrics, boundaryRisks);
    const rootCauses = this.identifyRootCauses(config, metrics, boundaryRisks);
    const mitigations = this.generateMitigations(config, metrics, rootCauses);

    return {
      overallRisk: round4(overallRisk),
      boundaryRisks,
      rootCauses,
      mitigations,
    };
  }

  // ── Overall Risk ────────────────────────────────────────────────────────

  /**
   * Overall risk is a weighted combination of:
   * - Metrics-level backflow risk score (40%)
   * - Max per-boundary risk (30%)
   * - Pressure instability (30%)
   */
  private computeOverallRisk(
    metrics: ExhaustSystemMetrics,
    boundaryRisks: BoundaryBackflowRisk[]
  ): number {
    const maxBoundaryRisk =
      boundaryRisks.length > 0
        ? Math.max(...boundaryRisks.map((b) => b.riskScore))
        : 0;

    const pressureInstability = 1 - metrics.negativePressureStability;

    const risk =
      0.4 * metrics.backflowRiskScore +
      0.3 * maxBoundaryRisk +
      0.3 * pressureInstability;

    return clamp01(risk);
  }

  // ── Per-Boundary Risk Prediction ────────────────────────────────────────

  /**
   * When solver post-processing hasn't provided per-boundary data,
   * predict risk from config heuristics.
   */
  private predictBoundaryRisks(
    config: ExhaustSimulationConfig,
    metrics: ExhaustSystemMetrics
  ): BoundaryBackflowRisk[] {
    const exhaustBCs = config.boundaryConditions.filter((bc) =>
      config.exhaustBoundaryIds.includes(bc.id)
    );

    return exhaustBCs.map((bc) => {
      const risk = this.estimateSingleBoundaryRisk(bc, config, metrics);
      return {
        boundaryId: bc.id,
        boundaryName: bc.name,
        riskScore: round4(risk),
        reverseFlowFraction: risk > RISK_MEDIUM ? round4(risk * 0.3) : 0,
        meanReverseVelocity: risk > RISK_MEDIUM ? round4(risk * 2) : 0,
      };
    });
  }

  /**
   * Heuristic risk for a single exhaust boundary:
   *
   * Factors:
   * 1. Is the BC a pressure outlet? (higher risk if gauge pressure ≈ 0)
   * 2. Low capture velocity at the hood → indicates insufficient suction.
   * 3. Cross-draft exposure — if inlet velocities are high relative to exhaust.
   * 4. Buoyancy mismatch — if exhaust is at floor level for hot contaminants.
   */
  private estimateSingleBoundaryRisk(
    bc: BoundaryCondition,
    config: ExhaustSimulationConfig,
    metrics: ExhaustSystemMetrics
  ): number {
    let risk = 0;

    // Factor 1: Pressure outlet with low gauge pressure
    if (
      bc.type === BoundaryType.PressureOutlet &&
      bc.pressure !== undefined &&
      Math.abs(bc.pressure) < Math.abs(MIN_NEGATIVE_PRESSURE_PA)
    ) {
      risk += 0.3;
    }

    // Factor 2: Low capture velocity
    if (metrics.captureVelocity < config.targetCaptureVelocity * 0.7) {
      risk += 0.25;
    }

    // Factor 3: Cross-draft — high inlet velocities
    const inletBCs = config.boundaryConditions.filter(
      (b) =>
        b.type === BoundaryType.Inlet ||
        b.type === BoundaryType.VelocityInlet
    );
    const maxInletSpeed = Math.max(
      0,
      ...inletBCs.map((b) => (b.velocity ? magnitude(b.velocity) : 0))
    );
    if (maxInletSpeed > metrics.captureVelocity * 0.5) {
      risk += 0.2;
    }

    // Factor 4: Buoyancy mismatch — hot gas + low exhaust
    if (config.buoyancy?.enabled) {
      const isLowExhaust =
        bc.velocity && bc.velocity.y <= 0 && !/overhead|canopy|ceiling/i.test(bc.name);
      if (isLowExhaust) {
        risk += 0.25;
      }
    }

    return clamp01(risk);
  }

  // ── Root Cause Analysis ─────────────────────────────────────────────────

  private identifyRootCauses(
    config: ExhaustSimulationConfig,
    metrics: ExhaustSystemMetrics,
    boundaryRisks: BoundaryBackflowRisk[]
  ): string[] {
    const causes: string[] = [];

    if (metrics.captureVelocity < config.targetCaptureVelocity * 0.8) {
      causes.push(
        `Capture velocity (${metrics.captureVelocity.toFixed(2)} m/s) is significantly below target (${config.targetCaptureVelocity.toFixed(2)} m/s) — insufficient suction at hood face`
      );
    }

    if (metrics.negativePressureStability < 0.6) {
      causes.push(
        "Enclosure negative pressure is unstable — potential air ingress through gaps, doors, or unsealed penetrations"
      );
    }

    const highRiskBoundaries = boundaryRisks.filter((b) => b.riskScore > RISK_HIGH);
    if (highRiskBoundaries.length > 0) {
      causes.push(
        `${highRiskBoundaries.length} exhaust boundary(ies) at critical backflow risk: ${highRiskBoundaries.map((b) => b.boundaryName).join(", ")}`
      );
    }

    if (config.buoyancy?.enabled) {
      causes.push(
        "Buoyancy-driven flow active — thermal plume dynamics can cause transient backflow if exhaust placement doesn't align with buoyant contaminant trajectory"
      );
    }

    const inletBCs = config.boundaryConditions.filter(
      (b) => b.type === BoundaryType.Inlet || b.type === BoundaryType.VelocityInlet
    );
    const totalInletArea = inletBCs.length; // proxy — in real system would compute area
    if (totalInletArea > config.exhaustBoundaryIds.length * 2) {
      causes.push(
        "Large number of inlet openings relative to exhaust points — makeup air may be overwhelming exhaust capacity"
      );
    }

    return causes;
  }

  // ── Mitigations ─────────────────────────────────────────────────────────

  private generateMitigations(
    config: ExhaustSimulationConfig,
    metrics: ExhaustSystemMetrics,
    rootCauses: string[]
  ): string[] {
    const mitigations: string[] = [];

    if (metrics.backflowRiskScore > RISK_MEDIUM) {
      mitigations.push(
        "Increase exhaust fan capacity or add a secondary exhaust point to improve static pressure margin"
      );
      mitigations.push(
        "Install backdraft dampers on exhaust openings to physically prevent reverse flow"
      );
    }

    if (metrics.negativePressureStability < 0.7) {
      mitigations.push(
        "Seal enclosure gaps and add interlocked door switches to maintain negative pressure during access"
      );
    }

    if (metrics.captureVelocity < config.targetCaptureVelocity) {
      mitigations.push(
        "Move exhaust hood closer to the contaminant source or add flanges to reduce entrainment of ambient air"
      );
    }

    if (config.buoyancy?.enabled) {
      mitigations.push(
        "Relocate exhaust points above the thermal plume centerline — canopy hoods are preferred for buoyant sources"
      );
    }

    if (mitigations.length === 0) {
      mitigations.push("No critical mitigations required — system operating within acceptable parameters");
    }

    return mitigations;
  }
}

// ── Utility ───────────────────────────────────────────────────────────────

function magnitude(v: Vector3): number {
  return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
