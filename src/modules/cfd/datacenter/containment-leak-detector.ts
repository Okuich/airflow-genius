// ─── Containment Leak Detector ─────────────────────────────────────────────
// Identifies airflow bypass and hot-air recirculation caused by
// containment system deficiencies (missing blanking panels, unsealed
// cable cutouts, poor door seals, above-rack gaps).
// ──────────────────────────────────────────────────────────────────────────

import type {
  DataCenterSimulationConfig,
  DataCenterMetrics,
  ContainmentAssessment,
  LeakSource,
  ContainmentConfig,
} from "@/packages/types";

// ── Detector ──────────────────────────────────────────────────────────────

export class ContainmentLeakDetector {
  /**
   * Assess containment quality and detect leak sources.
   *
   * @param config  Data center simulation configuration.
   * @param metrics Optional post-processed metrics from CFD solver.
   */
  assess(
    config: DataCenterSimulationConfig,
    metrics?: DataCenterMetrics
  ): ContainmentAssessment {
    const { containment } = config;
    const leakSources = this.detectLeaks(containment);

    const bypassAirFraction = this.estimateBypass(containment, config);
    const recirculationFraction = this.estimateRecirculation(containment, leakSources);

    const containmentScore = metrics?.airflowContainmentScore
      ?? this.computeContainmentScore(containment, leakSources);

    const mitigations = this.generateMitigations(containment, leakSources, bypassAirFraction);

    return {
      containmentScore: round4(containmentScore),
      leakSources,
      bypassAirFraction: round4(bypassAirFraction),
      recirculationFraction: round4(recirculationFraction),
      mitigations,
    };
  }

  // ── Leak Detection ─────────────────────────────────────────────────────

  private detectLeaks(containment: ContainmentConfig): LeakSource[] {
    const leaks: LeakSource[] = [];

    if (containment.blankingPanelCoverage < 0.95) {
      const deficit = 1 - containment.blankingPanelCoverage;
      leaks.push({
        location: "Rack face — missing blanking panels",
        severity: clamp01(deficit * 1.5),
        leakageRate: deficit * 0.15, // m³/s estimate per uncovered U
        fixCategory: "blanking_panel",
      });
    }

    if (containment.cableCutoutSealFraction < 0.9) {
      const deficit = 1 - containment.cableCutoutSealFraction;
      leaks.push({
        location: "Cable cutouts — unsealed openings",
        severity: clamp01(deficit * 1.2),
        leakageRate: deficit * 0.08,
        fixCategory: "cable_cutout",
      });
    }

    if (containment.doorSealQuality < 0.85) {
      const deficit = 1 - containment.doorSealQuality;
      leaks.push({
        location: "End-of-row doors — poor seal quality",
        severity: clamp01(deficit * 1.3),
        leakageRate: deficit * 0.12,
        fixCategory: "door_seal",
      });
    }

    if (containment.aboveRackGap > 0.05) {
      const severity = clamp01(containment.aboveRackGap / 0.3);
      leaks.push({
        location: `Above-rack gap (${(containment.aboveRackGap * 100).toFixed(0)} cm)`,
        severity,
        leakageRate: containment.aboveRackGap * 0.5,
        fixCategory: "above_rack",
      });
    }

    if (containment.type === "none") {
      leaks.push({
        location: "No physical containment — open data hall",
        severity: 1.0,
        leakageRate: 0.5,
        fixCategory: "door_seal",
      });
    }

    return leaks;
  }

  // ── Estimates ──────────────────────────────────────────────────────────

  private estimateBypass(containment: ContainmentConfig, config: DataCenterSimulationConfig): number {
    // Bypass fraction: air that doesn't pass through IT equipment
    if (containment.type === "none") return 0.35;

    const totalLeakage = 1 - containment.blankingPanelCoverage * 0.4
      - containment.cableCutoutSealFraction * 0.2
      - containment.doorSealQuality * 0.2
      - clamp01(1 - containment.aboveRackGap / 0.3) * 0.2;

    return clamp01(totalLeakage);
  }

  private estimateRecirculation(containment: ContainmentConfig, leaks: LeakSource[]): number {
    if (containment.type === "none") return 0.25;
    const totalSeverity = leaks.reduce((s, l) => s + l.severity, 0);
    return clamp01(totalSeverity / Math.max(leaks.length * 2, 1));
  }

  private computeContainmentScore(containment: ContainmentConfig, leaks: LeakSource[]): number {
    if (containment.type === "none") return 0.2;
    const avgLeak = leaks.length > 0
      ? leaks.reduce((s, l) => s + l.severity, 0) / leaks.length
      : 0;
    return clamp01(1 - avgLeak);
  }

  // ── Mitigations ────────────────────────────────────────────────────────

  private generateMitigations(
    containment: ContainmentConfig,
    leaks: LeakSource[],
    bypassFraction: number
  ): string[] {
    const mits: string[] = [];

    if (containment.type === "none") {
      mits.push("No containment system — implement hot-aisle or cold-aisle containment to reduce bypass air by up to 30%");
    }

    for (const leak of leaks.filter((l) => l.severity > 0.3)) {
      switch (leak.fixCategory) {
        case "blanking_panel":
          mits.push("Install blanking panels in all unused rack U-slots — lowest-cost highest-impact containment improvement");
          break;
        case "cable_cutout":
          mits.push("Seal cable cutouts with brush grommets or foam blocks to prevent hot air bypass");
          break;
        case "door_seal":
          mits.push("Replace or add magnetic seals on end-of-row containment doors");
          break;
        case "above_rack":
          mits.push(`Reduce above-rack gap (currently ${(containment.aboveRackGap * 100).toFixed(0)} cm) with rack-top baffles or containment curtains`);
          break;
        case "floor_tile":
          mits.push("Replace damaged floor tiles and seal tile gaps with gaskets");
          break;
      }
    }

    if (bypassFraction > 0.2) {
      mits.push(`Bypass air fraction ${(bypassFraction * 100).toFixed(0)}% — review raised floor plenum for tile placement and obstructions`);
    }

    if (mits.length === 0) {
      mits.push("Containment integrity is excellent — no significant leak sources detected");
    }

    return mits;
  }
}

// ── Utility ───────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
