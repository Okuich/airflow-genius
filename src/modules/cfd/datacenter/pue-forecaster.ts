// ─── PUE Forecaster ────────────────────────────────────────────────────────
// Projects future PUE values based on workload growth trends, seasonal
// cooling variation, and planned infrastructure changes.
// Uses a simple time-series model: linear workload growth + sinusoidal
// seasonal cooling factor + step-function infrastructure upgrades.
// ──────────────────────────────────────────────────────────────────────────

import type { DataCenterSimulationConfig } from "@/packages/types";
import { PUEEstimator } from "./pue-estimator";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WorkloadTrend {
  /** Current IT load utilisation (0–1). */
  currentUtilisation: number;
  /** Monthly growth rate as a fraction (e.g. 0.02 = 2%/month). */
  monthlyGrowthRate: number;
  /** Maximum IT load capacity in kW. */
  maxCapacity: number;
}

export interface SeasonalProfile {
  /** Baseline outdoor temperature °C (annual mean). */
  baselineOutdoorTemp: number;
  /** Peak summer temperature delta above baseline. */
  summerDelta: number;
  /** Month index of peak summer (0-indexed, 0 = Jan). */
  peakMonth: number;
}

export interface PlannedUpgrade {
  /** Month offset from now when upgrade takes effect. */
  monthOffset: number;
  /** Description of the upgrade. */
  description: string;
  /** Estimated PUE reduction from this upgrade. */
  pueReduction: number;
}

export interface ForecastPoint {
  /** Month offset from current (0 = now). */
  month: number;
  /** Label (e.g. "Mar 2026"). */
  label: string;
  /** Forecasted PUE value. */
  pue: number;
  /** Forecasted IT load in kW. */
  itLoad: number;
  /** Forecasted cooling power in kW. */
  coolingPower: number;
  /** Whether an upgrade was applied at this point. */
  upgradeApplied?: string;
  /** Confidence band width (±). */
  confidence: number;
}

export interface PUEForecast {
  /** Current PUE baseline. */
  baselinePUE: number;
  /** Forecast horizon in months. */
  horizonMonths: number;
  /** Time series of forecast points. */
  points: ForecastPoint[];
  /** Summary stats. */
  summary: {
    minPUE: number;
    maxPUE: number;
    avgPUE: number;
    trendDirection: "improving" | "stable" | "degrading";
    monthsUntilTarget: number | null;
    peakLoadMonth: number;
  };
}

export interface ForecastOptions {
  horizonMonths?: number;
  workloadTrend?: WorkloadTrend;
  seasonalProfile?: SeasonalProfile;
  plannedUpgrades?: PlannedUpgrade[];
}

// ── Default Profiles ──────────────────────────────────────────────────────

const DEFAULT_WORKLOAD: WorkloadTrend = {
  currentUtilisation: 0.65,
  monthlyGrowthRate: 0.015,
  maxCapacity: 1000,
};

const DEFAULT_SEASONAL: SeasonalProfile = {
  baselineOutdoorTemp: 18,
  summerDelta: 12,
  peakMonth: 6, // July
};

// ── Forecaster ────────────────────────────────────────────────────────────

export class PUEForecaster {
  private readonly pueEstimator = new PUEEstimator();

  forecast(
    config: DataCenterSimulationConfig,
    options: ForecastOptions = {}
  ): PUEForecast {
    const horizon = options.horizonMonths ?? 12;
    const trend = options.workloadTrend ?? DEFAULT_WORKLOAD;
    const seasonal = options.seasonalProfile ?? DEFAULT_SEASONAL;
    const upgrades = options.plannedUpgrades ?? [];

    // Baseline PUE from current config
    const baselineEstimate = this.pueEstimator.estimate(config);
    const baselinePUE = baselineEstimate.estimatedPUE;
    const baseITLoad = config.rackHeatLoad.totalITLoad;

    const now = new Date();
    const points: ForecastPoint[] = [];
    let cumulativeUpgradeReduction = 0;

    for (let m = 0; m <= horizon; m++) {
      // Workload growth (capped at max capacity)
      const growthFactor = Math.min(
        1 + trend.monthlyGrowthRate * m,
        trend.maxCapacity / baseITLoad
      );
      const itLoad = round2(baseITLoad * trend.currentUtilisation * growthFactor);

      // Seasonal cooling penalty
      const monthIndex = (now.getMonth() + m) % 12;
      const seasonalAngle = ((monthIndex - seasonal.peakMonth) / 12) * 2 * Math.PI;
      const seasonalFactor = 1 + 0.03 * seasonal.summerDelta * (0.5 + 0.5 * Math.cos(seasonalAngle)) / 12;

      // Upgrades
      const appliedUpgrade = upgrades.find((u) => u.monthOffset === m);
      if (appliedUpgrade) {
        cumulativeUpgradeReduction += appliedUpgrade.pueReduction;
      }

      // Workload-driven PUE increase (higher utilisation → slightly worse PUE due to diminishing cooling margin)
      const loadPenalty = 0.05 * Math.max(0, (itLoad / trend.maxCapacity) - 0.7);

      const pue = round3(
        Math.max(1.0, (baselinePUE + loadPenalty) * seasonalFactor - cumulativeUpgradeReduction)
      );

      const coolingPower = round2(itLoad * (pue - 1));

      // Confidence widens with time
      const confidence = round3(0.02 + 0.005 * m);

      const date = new Date(now.getFullYear(), now.getMonth() + m);
      const label = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

      points.push({
        month: m,
        label,
        pue,
        itLoad,
        coolingPower,
        upgradeApplied: appliedUpgrade?.description,
        confidence,
      });
    }

    const pueValues = points.map((p) => p.pue);
    const minPUE = Math.min(...pueValues);
    const maxPUE = Math.max(...pueValues);
    const avgPUE = round3(pueValues.reduce((a, b) => a + b, 0) / pueValues.length);

    const first = points[0].pue;
    const last = points[points.length - 1].pue;
    const trendDirection: "improving" | "stable" | "degrading" =
      last < first - 0.02 ? "improving" : last > first + 0.02 ? "degrading" : "stable";

    const targetPUE = config.targetPUE;
    const monthsUntilTarget =
      points.findIndex((p) => p.pue <= targetPUE);

    const peakLoadMonth = points.reduce(
      (best, p) => (p.itLoad > (points[best]?.itLoad ?? 0) ? p.month : best),
      0
    );

    return {
      baselinePUE,
      horizonMonths: horizon,
      points,
      summary: {
        minPUE,
        maxPUE,
        avgPUE,
        trendDirection,
        monthsUntilTarget: monthsUntilTarget >= 0 ? monthsUntilTarget : null,
        peakLoadMonth,
      },
    };
  }
}

// ── Utility ───────────────────────────────────────────────────────────────

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
