// ─── Cooling Topology Optimizer ────────────────────────────────────────────
// Iterative optimizer that nudges cooling topology parameters to minimise
// PUE and reduce hotspot count.  Uses a gradient-free hill-climbing approach
// over a discrete set of "nudges" (supply-temp, containment type, blanking
// coverage, door seals, cable seals, raised-floor depth, cooling units).
//
// Each iteration:
//  1. Generate candidate nudges from current config.
//  2. Score each candidate via the CoolingEfficiencyPredictor.
//  3. Accept the best-scoring candidate if it improves.
//  4. Repeat until budget exhausted or converged.
// ──────────────────────────────────────────────────────────────────────────

import type {
  DataCenterSimulationConfig,
  ContainmentConfig,
} from "@/packages/types";
import {
  CoolingEfficiencyPredictor,
  type CoolingEfficiencyReport,
} from "./cooling-efficiency-predictor";

// ── Public types ──────────────────────────────────────────────────────────

export interface OptimizationResult {
  /** Starting configuration score. */
  initialScore: number;
  /** Final optimised score. */
  finalScore: number;
  /** Improvement delta (final − initial). */
  improvement: number;
  /** Number of iterations executed. */
  iterations: number;
  /** Optimised configuration (deep-copied). */
  optimisedConfig: DataCenterSimulationConfig;
  /** Full cooling report for the optimised state. */
  finalReport: CoolingEfficiencyReport;
  /** Change log describing each accepted nudge. */
  changeLog: NudgeRecord[];
}

export interface NudgeRecord {
  iteration: number;
  parameter: string;
  from: string | number;
  to: string | number;
  scoreBefore: number;
  scoreAfter: number;
}

export interface OptimizerOptions {
  /** Maximum optimisation iterations (default 20). */
  maxIterations?: number;
  /** Minimum score improvement to accept a nudge (default 0.002). */
  minImprovement?: number;
  /** Maximum consecutive stalls before stopping (default 4). */
  maxStalls?: number;
}

// ── Nudge definitions ─────────────────────────────────────────────────────

interface Nudge {
  name: string;
  apply(cfg: DataCenterSimulationConfig): DataCenterSimulationConfig | null;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

const CONTAINMENT_ORDER: ContainmentConfig["type"][] = ["none", "hot-aisle", "cold-aisle", "chimney"];

function buildNudges(): Nudge[] {
  return [
    // ── Supply temperature adjustments ────────────────────────────────
    {
      name: "Raise supply temp +1 °C",
      apply(cfg) {
        const next = deepClone(cfg);
        const t = next.rackHeatLoad.supplyAirTemperature + 1;
        if (t > 27) return null; // ASHRAE upper
        next.rackHeatLoad.supplyAirTemperature = t;
        return next;
      },
    },
    {
      name: "Raise supply temp +2 °C",
      apply(cfg) {
        const next = deepClone(cfg);
        const t = next.rackHeatLoad.supplyAirTemperature + 2;
        if (t > 27) return null;
        next.rackHeatLoad.supplyAirTemperature = t;
        return next;
      },
    },

    // ── Containment upgrade ───────────────────────────────────────────
    {
      name: "Upgrade containment type",
      apply(cfg) {
        const idx = CONTAINMENT_ORDER.indexOf(cfg.containment.type);
        if (idx >= CONTAINMENT_ORDER.length - 1) return null;
        const next = deepClone(cfg);
        next.containment.type = CONTAINMENT_ORDER[idx + 1];
        return next;
      },
    },

    // ── Blanking panels ───────────────────────────────────────────────
    {
      name: "Improve blanking panel coverage +10%",
      apply(cfg) {
        if (cfg.containment.blankingPanelCoverage >= 0.99) return null;
        const next = deepClone(cfg);
        next.containment.blankingPanelCoverage = clamp(
          cfg.containment.blankingPanelCoverage + 0.1, 0, 1
        );
        return next;
      },
    },
    {
      name: "Maximise blanking panel coverage to 98%",
      apply(cfg) {
        if (cfg.containment.blankingPanelCoverage >= 0.98) return null;
        const next = deepClone(cfg);
        next.containment.blankingPanelCoverage = 0.98;
        return next;
      },
    },

    // ── Door seals ────────────────────────────────────────────────────
    {
      name: "Improve door seal quality +15%",
      apply(cfg) {
        if (cfg.containment.doorSealQuality >= 0.99) return null;
        const next = deepClone(cfg);
        next.containment.doorSealQuality = clamp(
          cfg.containment.doorSealQuality + 0.15, 0, 1
        );
        return next;
      },
    },

    // ── Cable cutout seals ────────────────────────────────────────────
    {
      name: "Seal cable cutouts +15%",
      apply(cfg) {
        if (cfg.containment.cableCutoutSealFraction >= 0.99) return null;
        const next = deepClone(cfg);
        next.containment.cableCutoutSealFraction = clamp(
          cfg.containment.cableCutoutSealFraction + 0.15, 0, 1
        );
        return next;
      },
    },

    // ── Above-rack gap ────────────────────────────────────────────────
    {
      name: "Reduce above-rack gap by 50%",
      apply(cfg) {
        if (cfg.containment.aboveRackGap <= 0.02) return null;
        const next = deepClone(cfg);
        next.containment.aboveRackGap = Math.max(0, cfg.containment.aboveRackGap * 0.5);
        return next;
      },
    },

    // ── Raised floor depth ────────────────────────────────────────────
    {
      name: "Increase raised floor depth to 0.45 m",
      apply(cfg) {
        if (cfg.raisedFloorDepth >= 0.45) return null;
        const next = deepClone(cfg);
        next.raisedFloorDepth = 0.45;
        return next;
      },
    },

    // ── Cooling capacity ──────────────────────────────────────────────
    {
      name: "Add cooling unit (+25% capacity)",
      apply(cfg) {
        const next = deepClone(cfg);
        next.coolingUnitCount += 1;
        next.totalCoolingCapacity *= 1.25;
        return next;
      },
    },

    // ── Tile open area ────────────────────────────────────────────────
    {
      name: "Increase tile open area +10%",
      apply(cfg) {
        if (cfg.tileOpenAreaFraction >= 0.50) return null;
        const next = deepClone(cfg);
        next.tileOpenAreaFraction = clamp(cfg.tileOpenAreaFraction + 0.1, 0, 0.5);
        return next;
      },
    },
  ];
}

// ── Optimizer ─────────────────────────────────────────────────────────────

export class CoolingTopologyOptimizer {
  private readonly predictor = new CoolingEfficiencyPredictor();
  private readonly nudges = buildNudges();

  /**
   * Run the optimisation loop.
   *
   * @param config  Starting data center configuration.
   * @param options Tuning knobs for iteration budget etc.
   */
  optimise(
    config: DataCenterSimulationConfig,
    options: OptimizerOptions = {}
  ): OptimizationResult {
    const maxIter = options.maxIterations ?? 20;
    const minImprove = options.minImprovement ?? 0.002;
    const maxStalls = options.maxStalls ?? 4;

    let current = deepClone(config);
    let currentReport = this.predictor.predict(current);
    let currentScore = currentReport.coolingEfficiencyScore;
    const initialScore = currentScore;
    const changeLog: NudgeRecord[] = [];
    let stalls = 0;

    for (let iter = 0; iter < maxIter; iter++) {
      // Evaluate all nudges, pick the best
      let bestCandidate: DataCenterSimulationConfig | null = null;
      let bestScore = currentScore;
      let bestReport: CoolingEfficiencyReport | null = null;
      let bestNudgeName = "";
      let bestFrom: string | number = "";
      let bestTo: string | number = "";

      for (const nudge of this.nudges) {
        const candidate = nudge.apply(current);
        if (!candidate) continue;

        const report = this.predictor.predict(candidate);
        if (report.coolingEfficiencyScore > bestScore + minImprove) {
          bestScore = report.coolingEfficiencyScore;
          bestCandidate = candidate;
          bestReport = report;
          bestNudgeName = nudge.name;
          bestFrom = this.describeParam(nudge.name, current);
          bestTo = this.describeParam(nudge.name, candidate);
        }
      }

      if (!bestCandidate || !bestReport) {
        stalls++;
        if (stalls >= maxStalls) break;
        continue;
      }

      stalls = 0;
      changeLog.push({
        iteration: iter + 1,
        parameter: bestNudgeName,
        from: bestFrom,
        to: bestTo,
        scoreBefore: round4(currentScore),
        scoreAfter: round4(bestScore),
      });

      current = bestCandidate;
      currentReport = bestReport;
      currentScore = bestScore;
    }

    return {
      initialScore: round4(initialScore),
      finalScore: round4(currentScore),
      improvement: round4(currentScore - initialScore),
      iterations: changeLog.length,
      optimisedConfig: current,
      finalReport: currentReport,
      changeLog,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private describeParam(nudgeName: string, cfg: DataCenterSimulationConfig): string | number {
    if (nudgeName.includes("supply temp")) return cfg.rackHeatLoad.supplyAirTemperature;
    if (nudgeName.includes("containment type")) return cfg.containment.type;
    if (nudgeName.includes("blanking")) return round4(cfg.containment.blankingPanelCoverage);
    if (nudgeName.includes("door seal")) return round4(cfg.containment.doorSealQuality);
    if (nudgeName.includes("cable cutout")) return round4(cfg.containment.cableCutoutSealFraction);
    if (nudgeName.includes("above-rack")) return round4(cfg.containment.aboveRackGap);
    if (nudgeName.includes("raised floor")) return cfg.raisedFloorDepth;
    if (nudgeName.includes("cooling unit")) return cfg.coolingUnitCount;
    if (nudgeName.includes("tile open")) return round4(cfg.tileOpenAreaFraction);
    return "—";
  }
}

// ── Utility ───────────────────────────────────────────────────────────────

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
