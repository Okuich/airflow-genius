// ─── Rack Heat Load Model ──────────────────────────────────────────────────
// Deterministic thermal analysis of server rack heat dissipation.
// Computes per-rack inlet/exhaust temperatures and identifies hotspots
// using supply temperature, airflow demand, and heat load data.
// ──────────────────────────────────────────────────────────────────────────

import type {
  DataCenterSimulationConfig,
  DataCenterMetrics,
  HotspotAssessment,
  RackTemperature,
  RackLoad,
} from "@/packages/types";

// ── Constants ──────────────────────────────────────────────────────────────

/** Specific heat capacity of air at ~25 °C in kJ/(kg·K). */
const CP_AIR = 1.005;
/** Air density at ~25 °C in kg/m³. */
const RHO_AIR = 1.18;

// ── Model ──────────────────────────────────────────────────────────────────

export class RackHeatLoadModel {
  /**
   * Assess hotspot risk across all racks.
   *
   * @param config  Data center simulation configuration.
   * @param metrics Optional post-processed metrics from CFD solver.
   */
  assess(
    config: DataCenterSimulationConfig,
    metrics?: DataCenterMetrics
  ): HotspotAssessment {
    const { rackHeatLoad, containment } = config;
    const supplyTemp = rackHeatLoad.supplyAirTemperature;
    const threshold = rackHeatLoad.hotspotThreshold;

    const rackTemperatures: RackTemperature[] = rackHeatLoad.rackLoads.map((rack) => {
      const deltaT = this.computeDeltaT(rack);
      // Recirculation penalty: poor containment causes hot exhaust to mix back
      const recircPenalty = this.recirculationPenalty(containment.blankingPanelCoverage, containment.doorSealQuality);
      const inletTemp = supplyTemp + recircPenalty;
      const exhaustTemp = inletTemp + deltaT;
      const isHotspot = exhaustTemp - rackHeatLoad.returnAirThreshold > threshold;

      return {
        rackId: rack.id,
        rackName: rack.name,
        inletTemperature: round2(inletTemp),
        exhaustTemperature: round2(exhaustTemp),
        deltaT: round2(deltaT),
        isHotspot,
      };
    });

    const criticalRacks = rackTemperatures.filter((r) => r.isHotspot).map((r) => r.rackName);
    const hotspotCount = metrics?.rackHotspotCount ?? criticalRacks.length;
    const thermalRisk = this.classifyRisk(hotspotCount, rackHeatLoad.rackLoads.length);
    const mitigations = this.generateMitigations(config, rackTemperatures, criticalRacks);

    return {
      hotspotCount,
      rackTemperatures,
      criticalRacks,
      thermalRisk,
      mitigations,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Compute temperature rise across a rack: ΔT = Q / (ṁ · cp)
   * where ṁ = ρ · V̇
   */
  private computeDeltaT(rack: RackLoad): number {
    const massFlow = RHO_AIR * Math.max(rack.airflowDemand, 0.01); // kg/s
    return rack.heatLoad / (massFlow * CP_AIR);
  }

  /** Estimate recirculation-induced temperature rise at rack inlet. */
  private recirculationPenalty(blankingCoverage: number, doorSealQuality: number): number {
    // Poor blanking + poor seals → up to 5 °C recirculation penalty
    const blankingDeficit = 1 - blankingCoverage;
    const sealDeficit = 1 - doorSealQuality;
    return 5 * (blankingDeficit * 0.6 + sealDeficit * 0.4);
  }

  private classifyRisk(
    hotspotCount: number,
    totalRacks: number
  ): "safe" | "caution" | "warning" | "critical" {
    if (totalRacks === 0) return "safe";
    const ratio = hotspotCount / totalRacks;
    if (ratio === 0) return "safe";
    if (ratio < 0.1) return "caution";
    if (ratio < 0.3) return "warning";
    return "critical";
  }

  private generateMitigations(
    config: DataCenterSimulationConfig,
    racks: RackTemperature[],
    criticalRacks: string[]
  ): string[] {
    const mits: string[] = [];

    if (criticalRacks.length > 0) {
      mits.push(
        `${criticalRacks.length} rack(s) exceeding thermal threshold: ${criticalRacks.join(", ")}. Increase local airflow or redistribute IT load`
      );
    }

    const highDeltaT = racks.filter((r) => r.deltaT > 15);
    if (highDeltaT.length > 0) {
      mits.push(
        `${highDeltaT.length} rack(s) with ΔT > 15 °C — likely insufficient airflow. Check perforated tile placement and plenum balance`
      );
    }

    if (config.containment.blankingPanelCoverage < 0.9) {
      mits.push("Blanking panel coverage below 90% — install blanking panels in all unused U-slots to prevent hot air bypass");
    }

    if (config.totalCoolingCapacity < config.rackHeatLoad.totalITLoad * 1.2) {
      mits.push("Cooling capacity below 1.2× IT load — consider adding supplemental cooling units");
    }

    if (mits.length === 0) {
      mits.push("All racks within thermal limits — no immediate action required");
    }

    return mits;
  }
}

// ── Utility ───────────────────────────────────────────────────────────────

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
