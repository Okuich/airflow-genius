// ─── Heat Stress Predictor ─────────────────────────────────────────────────
// Deterministic predictor that assesses livestock heat stress from
// zone-level temperature, humidity, and airflow data.
//
// Uses the Temperature-Humidity Index (THI) widely adopted in
// dairy / poultry / swine welfare research.
// ──────────────────────────────────────────────────────────────────────────

import type {
  AgricultureSimulationConfig,
  AgricultureVentilationMetrics,
  HeatStressAssessment,
  ZoneHeatStress,
  AirflowZone,
} from "@/packages/types";

// ── THI Thresholds (species-dependent) ─────────────────────────────────────

const THI_THRESHOLDS: Record<string, { safe: number; caution: number; danger: number }> = {
  poultry: { safe: 70, caution: 75, danger: 80 },
  swine: { safe: 72, caution: 78, danger: 84 },
  dairy: { safe: 68, caution: 72, danger: 78 },
  beef: { safe: 74, caution: 79, danger: 84 },
};

/** Wind chill correction: each 1 m/s of airflow reduces effective temperature by ~1.5 °C. */
const AIRFLOW_COOLING_FACTOR = 1.5;

// ── Predictor ──────────────────────────────────────────────────────────────

export class HeatStressPredictor {
  /**
   * Assess heat stress across all zones.
   *
   * @param config  Agriculture simulation configuration.
   * @param metrics Post-processed ventilation metrics (optional – used for overall index).
   * @param zoneAirVelocities  Per-zone airflow velocity at animal level (m/s).
   */
  assess(
    config: AgricultureSimulationConfig,
    metrics?: AgricultureVentilationMetrics,
    zoneAirVelocities?: Map<string, number>
  ): HeatStressAssessment {
    const zones = config.multiZoneModel.zones;
    const thresholds = THI_THRESHOLDS[config.livestockType] ?? THI_THRESHOLDS.dairy;

    const zoneAssessments: ZoneHeatStress[] = zones.map((zone) => {
      const airVelocity = zoneAirVelocities?.get(zone.id) ?? 0.5;
      return this.assessZone(zone, airVelocity, thresholds);
    });

    const overallIndex = metrics?.heatStressIndex ?? this.computeOverallIndex(zoneAssessments);
    const riskLevel = this.classifyRisk(overallIndex, thresholds);
    const mitigations = this.generateMitigations(config, zoneAssessments, riskLevel);

    return {
      overallIndex: round4(overallIndex),
      zoneAssessments,
      riskLevel,
      mitigations,
    };
  }

  // ── Per-Zone Assessment ─────────────────────────────────────────────────

  private assessZone(
    zone: AirflowZone,
    airVelocity: number,
    thresholds: { safe: number; caution: number; danger: number }
  ): ZoneHeatStress {
    const thi = this.computeTHI(zone.temperature, zone.relativeHumidity);
    const effectiveTemp = zone.temperature - airVelocity * AIRFLOW_COOLING_FACTOR;

    // Normalise heat stress index to [0, 1] using THI thresholds
    const hsi = this.normaliseHSI(thi, thresholds);

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      temperatureHumidityIndex: round4(thi),
      effectiveTemperature: round4(effectiveTemp),
      airVelocityAtAnimalLevel: round4(airVelocity),
      heatStressIndex: round4(hsi),
    };
  }

  /**
   * Temperature-Humidity Index (NRC 1971 formula):
   * THI = (1.8 × T + 32) − (0.55 − 0.0055 × RH%) × (1.8 × T − 26)
   */
  private computeTHI(tempC: number, rh01: number): number {
    const rhPct = rh01 * 100;
    const thi = (1.8 * tempC + 32) - (0.55 - 0.0055 * rhPct) * (1.8 * tempC - 26);
    return thi;
  }

  /** Map THI to a 0–1 heat stress index. */
  private normaliseHSI(
    thi: number,
    thresholds: { safe: number; caution: number; danger: number }
  ): number {
    if (thi <= thresholds.safe) return 0;
    if (thi >= thresholds.danger + 10) return 1;
    // Linear interpolation between safe and danger+10
    return clamp01((thi - thresholds.safe) / (thresholds.danger + 10 - thresholds.safe));
  }

  // ── Overall ─────────────────────────────────────────────────────────────

  private computeOverallIndex(zones: ZoneHeatStress[]): number {
    if (zones.length === 0) return 0;
    // Weighted by worst zone — max contributes 60%, average 40%
    const max = Math.max(...zones.map((z) => z.heatStressIndex));
    const avg = zones.reduce((s, z) => s + z.heatStressIndex, 0) / zones.length;
    return clamp01(0.6 * max + 0.4 * avg);
  }

  private classifyRisk(
    index: number,
    _thresholds: { safe: number; caution: number; danger: number }
  ): "safe" | "caution" | "danger" | "emergency" {
    if (index < 0.25) return "safe";
    if (index < 0.50) return "caution";
    if (index < 0.75) return "danger";
    return "emergency";
  }

  // ── Mitigations ─────────────────────────────────────────────────────────

  private generateMitigations(
    config: AgricultureSimulationConfig,
    zones: ZoneHeatStress[],
    riskLevel: string
  ): string[] {
    const mitigations: string[] = [];

    if (riskLevel === "emergency" || riskLevel === "danger") {
      mitigations.push("Immediately increase mechanical ventilation rate or activate emergency fans");
      mitigations.push("Deploy evaporative cooling pads or misting systems");
    }

    const hotZones = zones.filter((z) => z.heatStressIndex > 0.5);
    if (hotZones.length > 0) {
      mitigations.push(
        `${hotZones.length} zone(s) above caution threshold: ${hotZones.map((z) => z.zoneName).join(", ")}. Increase airflow velocity at animal level to ≥ 2 m/s`
      );
    }

    const lowAirflow = zones.filter((z) => z.airVelocityAtAnimalLevel < 0.5);
    if (lowAirflow.length > 0) {
      mitigations.push(
        `Stagnant air detected in ${lowAirflow.map((z) => z.zoneName).join(", ")}. Add circulation fans or redirect inlet openings`
      );
    }

    if (config.moistureTransport.enabled && config.moistureTransport.ambientHumidity > 0.8) {
      mitigations.push("High ambient humidity limits evaporative cooling effectiveness — consider tunnel ventilation with high air speed instead");
    }

    if (mitigations.length === 0) {
      mitigations.push("Heat stress within acceptable limits — no immediate action required");
    }

    return mitigations;
  }
}

// ── Utility ───────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
