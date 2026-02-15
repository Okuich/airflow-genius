// ─── Ammonia Risk Estimator ────────────────────────────────────────────────
// Deterministic estimator that calculates zone-level ammonia concentrations
// from emission rates, ventilation rates, and zone volumes. Uses a
// steady-state well-mixed reactor model for each zone.
// ──────────────────────────────────────────────────────────────────────────

import type {
  AgricultureSimulationConfig,
  AgricultureVentilationMetrics,
  AmmoniaRiskAssessment,
  ZoneAmmoniaLevel,
  AirflowZone,
} from "@/packages/types";

// ── Constants ──────────────────────────────────────────────────────────────

/** OSHA 8-hour TWA limit for ammonia (ppm). */
const OSHA_AMMONIA_LIMIT_PPM = 25;
/** Conversion: mg/m³ to ppm for NH₃ at 25 °C, 1 atm. MW = 17.03 g/mol. */
const NH3_MG_M3_TO_PPM = 24.45 / 17.03; // ≈ 1.436

// ── Estimator ──────────────────────────────────────────────────────────────

export class AmmoniaRiskEstimator {
  /**
   * Estimate ammonia risk across all zones.
   *
   * @param config  Agriculture simulation configuration.
   * @param metrics Optional post-processed ventilation metrics.
   * @param zoneVentilationRates  Per-zone volumetric ventilation rate in m³/s.
   */
  estimate(
    config: AgricultureSimulationConfig,
    metrics?: AgricultureVentilationMetrics,
    zoneVentilationRates?: Map<string, number>
  ): AmmoniaRiskAssessment {
    const zones = config.multiZoneModel.zones;
    const limit = config.ammoniaLimit > 0 ? config.ammoniaLimit : OSHA_AMMONIA_LIMIT_PPM;

    const zoneConcentrations: ZoneAmmoniaLevel[] = zones.map((zone) => {
      const ventRate = zoneVentilationRates?.get(zone.id) ?? this.estimateVentilationRate(zone, config);
      return this.assessZone(zone, ventRate, limit);
    });

    const exceedingZones = zoneConcentrations
      .filter((z) => z.exceedsLimit)
      .map((z) => z.zoneName);

    const overallRisk = this.computeOverallRisk(zoneConcentrations, limit, metrics);
    const dailyEmission = this.computeDailyEmission(zones);
    const mitigations = this.generateMitigations(config, zoneConcentrations, exceedingZones);

    return {
      overallRisk: round4(overallRisk),
      zoneConcentrations,
      exceedingZones,
      dailyEmission: round4(dailyEmission),
      mitigations,
    };
  }

  // ── Per-Zone Assessment ─────────────────────────────────────────────────

  private assessZone(
    zone: AirflowZone,
    ventilationRate: number,
    limit: number
  ): ZoneAmmoniaLevel {
    // Steady-state well-mixed: C = E / Q  (mg/m³)
    // where E = emission rate (mg/s), Q = ventilation rate (m³/s)
    const concentration_mg_m3 = ventilationRate > 0
      ? zone.ammoniaEmissionRate / ventilationRate
      : zone.ammoniaEmissionRate > 0 ? 9999 : 0;

    const concentration_ppm = concentration_mg_m3 * NH3_MG_M3_TO_PPM;

    // Peak estimate: 1.5× average for poorly mixed zones
    const peakConcentration = concentration_ppm * 1.5;

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      concentration: round4(concentration_ppm),
      peakConcentration: round4(peakConcentration),
      exceedsLimit: concentration_ppm > limit,
    };
  }

  /**
   * Estimate ventilation rate from zone volume and a default air change rate.
   * Typical agricultural buildings: 4–60 ACH depending on season.
   * Uses 15 ACH as a moderate default.
   */
  private estimateVentilationRate(zone: AirflowZone, config: AgricultureSimulationConfig): number {
    const defaultACH = 15;
    return (zone.volume * defaultACH) / 3600; // m³/s
  }

  // ── Overall Risk ────────────────────────────────────────────────────────

  private computeOverallRisk(
    zones: ZoneAmmoniaLevel[],
    limit: number,
    metrics?: AgricultureVentilationMetrics
  ): number {
    if (metrics && metrics.ammoniaConcentration > 0) {
      // If solver provides actual concentration, use it directly
      return clamp01(metrics.ammoniaConcentration / limit);
    }

    if (zones.length === 0) return 0;
    const maxRatio = Math.max(...zones.map((z) => z.concentration / limit));
    return clamp01(maxRatio);
  }

  // ── Daily Emission ──────────────────────────────────────────────────────

  /** Total daily ammonia emission from all zones in kg/day. */
  private computeDailyEmission(zones: AirflowZone[]): number {
    const totalMgPerSec = zones.reduce((s, z) => s + z.ammoniaEmissionRate, 0);
    return (totalMgPerSec * 86400) / 1e6; // mg/s → kg/day
  }

  // ── Mitigations ─────────────────────────────────────────────────────────

  private generateMitigations(
    config: AgricultureSimulationConfig,
    zones: ZoneAmmoniaLevel[],
    exceedingZones: string[]
  ): string[] {
    const mitigations: string[] = [];

    if (exceedingZones.length > 0) {
      mitigations.push(
        `Ammonia exceeds ${config.ammoniaLimit || OSHA_AMMONIA_LIMIT_PPM} ppm in: ${exceedingZones.join(", ")}. Increase ventilation rate immediately`
      );
      mitigations.push("Increase manure removal frequency to reduce ammonia source strength");
    }

    const highZones = zones.filter((z) => z.concentration > (config.ammoniaLimit || OSHA_AMMONIA_LIMIT_PPM) * 0.7);
    if (highZones.length > 0 && exceedingZones.length === 0) {
      mitigations.push(
        `${highZones.length} zone(s) approaching ammonia limit — proactive ventilation increase recommended`
      );
    }

    if (config.multiZoneModel.enableStackEffect) {
      mitigations.push("Stack effect is active — verify that ammonia-laden air from manure pits is not short-circuiting to animal zones");
    }

    // Dietary intervention
    mitigations.push("Consider dietary crude protein reduction to lower ammonia emission at source");

    // Scrubber suggestion for high emitters
    const totalDaily = this.computeDailyEmission(config.multiZoneModel.zones);
    if (totalDaily > 50) {
      mitigations.push("Daily ammonia emission exceeds 50 kg — evaluate acid scrubber or biofilter on exhaust air");
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
