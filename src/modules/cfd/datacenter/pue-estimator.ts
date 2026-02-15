// ─── PUE Estimator ─────────────────────────────────────────────────────────
// Estimates Power Usage Effectiveness (PUE) from simulation data.
// PUE = Total Facility Power / IT Equipment Power.
// Lower is better (theoretical minimum = 1.0).
// ──────────────────────────────────────────────────────────────────────────

import type {
  DataCenterSimulationConfig,
  DataCenterMetrics,
  PUEEstimate,
  PUEBreakdown,
} from "@/packages/types";

// ── Constants ──────────────────────────────────────────────────────────────

/** Typical lighting + misc overhead as fraction of IT load. */
const DEFAULT_OTHER_OVERHEAD = 0.03;

// ── Estimator ──────────────────────────────────────────────────────────────

export class PUEEstimator {
  /**
   * Estimate PUE for a data center simulation.
   *
   * @param config  Data center simulation configuration.
   * @param metrics Optional post-processed metrics (provides solver PUE impact).
   * @param actualCoolingPower  Actual cooling power consumed in kW (from solver or measured).
   */
  estimate(
    config: DataCenterSimulationConfig,
    metrics?: DataCenterMetrics,
    actualCoolingPower?: number
  ): PUEEstimate {
    const itLoad = config.rackHeatLoad.totalITLoad;

    // Cooling overhead
    const coolingPower = actualCoolingPower ?? this.estimateCoolingPower(config);
    const coolingOverhead = coolingPower / Math.max(itLoad, 0.01);

    // Fan / air movement overhead
    const airMovementPower = this.estimateAirMovementPower(config);
    const airMovementOverhead = airMovementPower / Math.max(itLoad, 0.01);

    // Other overhead
    const otherOverhead = DEFAULT_OTHER_OVERHEAD;

    const breakdown: PUEBreakdown = {
      itLoad: 1.0,
      coolingOverhead: round4(coolingOverhead),
      airMovementOverhead: round4(airMovementOverhead),
      otherOverhead,
    };

    const estimatedPUE = metrics?.predictedPUEImpact
      ?? round4(1.0 + coolingOverhead + airMovementOverhead + otherOverhead);

    const efficiencyClass = this.classifyPUE(estimatedPUE);
    const pueVsTarget = round4(estimatedPUE - config.targetPUE);
    const recommendations = this.generateRecommendations(config, estimatedPUE, breakdown);

    return {
      estimatedPUE,
      breakdown,
      pueVsTarget,
      efficiencyClass,
      recommendations,
    };
  }

  // ── Estimation Helpers ─────────────────────────────────────────────────

  /**
   * Heuristic cooling power estimate based on cooling capacity and
   * containment quality.
   * Better containment → less overcooling → lower cooling power.
   */
  private estimateCoolingPower(config: DataCenterSimulationConfig): number {
    const itLoad = config.rackHeatLoad.totalITLoad;
    const containmentBonus = config.containment.type !== "none" ? 0.15 : 0;
    // Base cooling overhead ratio: ~30-60% of IT load
    const baseRatio = 0.45 - containmentBonus;
    return itLoad * Math.max(baseRatio, 0.1);
  }

  /** Estimate fan/air-movement power (CRAC fans, containment fans). */
  private estimateAirMovementPower(config: DataCenterSimulationConfig): number {
    const itLoad = config.rackHeatLoad.totalITLoad;
    // Raised floor with plenum improves distribution, lowers fan work
    const plenumBonus = config.raisedFloorDepth > 0.3 ? 0.02 : 0;
    const baseRatio = 0.10 - plenumBonus;
    return itLoad * Math.max(baseRatio, 0.02);
  }

  // ── Classification ─────────────────────────────────────────────────────

  private classifyPUE(pue: number): "excellent" | "good" | "average" | "poor" {
    if (pue <= 1.2) return "excellent";
    if (pue <= 1.5) return "good";
    if (pue <= 2.0) return "average";
    return "poor";
  }

  // ── Recommendations ────────────────────────────────────────────────────

  private generateRecommendations(
    config: DataCenterSimulationConfig,
    pue: number,
    breakdown: PUEBreakdown
  ): string[] {
    const recs: string[] = [];

    if (pue > config.targetPUE) {
      recs.push(
        `Estimated PUE ${pue.toFixed(2)} exceeds target ${config.targetPUE.toFixed(2)} — review cooling and containment efficiency`
      );
    }

    if (breakdown.coolingOverhead > 0.4) {
      recs.push("Cooling overhead exceeds 40% of IT load — consider economizer modes, raise supply temperature, or upgrade to variable-speed compressors");
    }

    if (breakdown.airMovementOverhead > 0.12) {
      recs.push("Air movement overhead is high — optimize fan speeds with variable frequency drives and improve plenum airflow distribution");
    }

    if (config.containment.type === "none") {
      recs.push("Implementing hot/cold aisle containment can reduce PUE by 0.1–0.3");
    }

    if (config.rackHeatLoad.supplyAirTemperature < 20) {
      recs.push(`Supply air temperature ${config.rackHeatLoad.supplyAirTemperature} °C is below ASHRAE recommended 18–27 °C range — raising it can reduce cooling energy significantly`);
    }

    if (config.raisedFloorDepth > 0 && config.raisedFloorDepth < 0.3) {
      recs.push("Shallow raised floor plenum may cause high pressure drop and uneven tile airflow distribution");
    }

    if (recs.length === 0) {
      recs.push(`PUE ${pue.toFixed(2)} meets target — facility is operating efficiently`);
    }

    return recs;
  }
}

// ── Utility ───────────────────────────────────────────────────────────────

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
