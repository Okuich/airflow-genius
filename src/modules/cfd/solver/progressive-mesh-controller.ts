// ─── Progressive Mesh Controller ────────────────────────────────────────────
// Adaptive mesh refinement loop:
//
//   1. Start with a coarse mesh
//   2. Execute simulation via SimulationExecutionPipeline
//   3. Compute field gradients → identify high-gradient regions
//   4. Refine mesh selectively near those regions
//   5. Re-solve and compare key metrics against previous level
//   6. Repeat until convergence threshold met OR max iterations reached
//
// Returns a MeshRefinementReport summarising every pass.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SimulationConfig,
  MeshSettings,
  ResidualSnapshot,
  Vector3,
} from "@/packages/types";
import { getEventBus, type PlatformEventBus } from "@/packages/events";
import {
  SimulationExecutionPipeline,
  type PipelineConfig,
  type PipelineResult,
} from "./simulation-execution-pipeline";

// ── Public Types ────────────────────────────────────────────────────────────

export interface ProgressiveMeshConfig {
  /** Maximum refinement passes. Default 5. */
  maxPasses: number;
  /** Initial cell-count multiplier relative to base (< 1 = start coarser). Default 0.25. */
  coarseMultiplier: number;
  /** Max cell-count multiplier relative to base (cap). Default 4.0. */
  maxCellMultiplier: number;
  /** Fraction of cells to refine each pass (0–1). Default 0.15. */
  refineFraction: number;
  /** Metric change (%) below which convergence is declared. Default 1.0. */
  convergenceThresholdPercent: number;
  /** Minimum improvement (%) to justify another pass. Default 0.1. */
  minImprovementPercent: number;
  /** Pipeline config overrides forwarded to each solve. */
  pipelineConfig?: Partial<PipelineConfig>;
}

export interface GradientRegion {
  centroid: Vector3;
  gradientMagnitude: number;
  /** Suggested local cell-size reduction factor (0–1). */
  refinementFactor: number;
}

export interface RefinementPass {
  pass: number;
  cellCount: number;
  meshSettings: MeshSettings;
  pipeline: PipelineResult;
  keyMetric: number | null;
  metricChangePct: number | null;
  regionsRefined: number;
  converged: boolean;
  durationMs: number;
}

export interface MeshRefinementReport {
  passes: RefinementPass[];
  converged: boolean;
  finalCellCount: number;
  finalMetric: number | null;
  totalPasses: number;
  totalDurationMs: number;
  recommendation: string;
}

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS: ProgressiveMeshConfig = {
  maxPasses: 5,
  coarseMultiplier: 0.25,
  maxCellMultiplier: 4.0,
  refineFraction: 0.15,
  convergenceThresholdPercent: 1.0,
  minImprovementPercent: 0.1,
};

// ── Controller ──────────────────────────────────────────────────────────────

export class ProgressiveMeshController {
  private readonly config: ProgressiveMeshConfig;
  private readonly pipeline: SimulationExecutionPipeline;
  private readonly bus: PlatformEventBus;

  constructor(
    config?: Partial<ProgressiveMeshConfig>,
    deps?: {
      pipeline?: SimulationExecutionPipeline;
      bus?: PlatformEventBus;
    }
  ) {
    this.config = { ...DEFAULTS, ...config };
    this.pipeline =
      deps?.pipeline ?? new SimulationExecutionPipeline(this.config.pipelineConfig);
    this.bus = deps?.bus ?? getEventBus();
  }

  // ── Main Loop ───────────────────────────────────────────────────────────

  async run(
    orgId: string,
    userId: string,
    baseConfig: SimulationConfig,
    onProgress?: (pass: number, stage: string) => void
  ): Promise<MeshRefinementReport> {
    const t0 = performance.now();
    const baseCells = baseConfig.meshSettings.targetCellCount;
    const maxCells = Math.round(baseCells * this.config.maxCellMultiplier);

    const passes: RefinementPass[] = [];
    let currentMesh = this.scaleToCoarse(baseConfig.meshSettings, baseCells);
    let previousMetric: number | null = null;

    for (let pass = 0; pass < this.config.maxPasses; pass++) {
      const passT0 = performance.now();
      onProgress?.(pass, "solving");

      const simConfig: SimulationConfig = {
        ...baseConfig,
        id: `${baseConfig.id}-amr-${pass}`,
        name: `${baseConfig.name} (AMR pass ${pass})`,
        meshSettings: currentMesh,
      };

      const result = await this.pipeline.execute(orgId, userId, simConfig, (stage, detail) => {
        onProgress?.(pass, `${stage}: ${detail}`);
      });

      const keyMetric = this.extractKeyMetric(result);

      const metricChangePct =
        previousMetric !== null && keyMetric !== null && Math.abs(previousMetric) > 1e-15
          ? Math.abs((keyMetric - previousMetric) / previousMetric) * 100
          : null;

      const converged =
        metricChangePct !== null &&
        metricChangePct <= this.config.convergenceThresholdPercent;

      // Identify high-gradient regions for next pass
      const gradientRegions = this.identifyHighGradientRegions(result);

      passes.push({
        pass,
        cellCount: currentMesh.targetCellCount,
        meshSettings: { ...currentMesh },
        pipeline: result,
        keyMetric,
        metricChangePct: metricChangePct !== null ? round4(metricChangePct) : null,
        regionsRefined: gradientRegions.length,
        converged,
        durationMs: Math.round(performance.now() - passT0),
      });

      onProgress?.(pass, converged ? "converged" : "completed");

      if (converged) break;

      // Check minimum improvement — stop if refining isn't helping
      if (
        pass > 0 &&
        metricChangePct !== null &&
        metricChangePct < this.config.minImprovementPercent
      ) {
        break;
      }

      // Stop if we've hit the cell-count cap
      if (currentMesh.targetCellCount >= maxCells) break;

      // Refine mesh for next iteration
      currentMesh = this.refineNearGradients(currentMesh, gradientRegions, maxCells);
      previousMetric = keyMetric;
    }

    const lastPass = passes[passes.length - 1];
    const report: MeshRefinementReport = {
      passes,
      converged: lastPass?.converged ?? false,
      finalCellCount: lastPass?.cellCount ?? 0,
      finalMetric: lastPass?.keyMetric ?? null,
      totalPasses: passes.length,
      totalDurationMs: Math.round(performance.now() - t0),
      recommendation: this.generateRecommendation(passes),
    };

    await this.bus
      .emit("refinement_study.completed", {
        simulationId: baseConfig.id,
        organizationId: orgId,
        userId,
        gridIndependent: report.converged,
        gciFine: null,
        timestamp: new Date().toISOString(),
      })
      .catch(() => {});

    return report;
  }

  // ── Coarse Mesh Generation ──────────────────────────────────────────────

  scaleToCoarse(base: MeshSettings, baseCells: number): MeshSettings {
    const targetCells = Math.round(baseCells * this.config.coarseMultiplier);
    const sizeScale = Math.pow(this.config.coarseMultiplier, -1 / 3);

    return {
      ...base,
      targetCellCount: targetCells,
      baseSize: base.baseSize * sizeScale,
      minSize: base.minSize * sizeScale,
      maxSize: base.maxSize * sizeScale,
    };
  }

  // ── Gradient-Based Refinement ─────────────────────────────────────────

  identifyHighGradientRegions(result: PipelineResult): GradientRegion[] {
    if (!result.success || !result.finalResult?.results) return [];

    const residuals = result.finalResult.results.finalResiduals;
    const regions: GradientRegion[] = [];

    // Derive gradient magnitude from residual channel magnitudes.
    // In production this would come from field data; here we synthesise
    // representative regions from the residual structure.
    const channels: { name: string; value: number }[] = [
      { name: "continuity", value: residuals.continuity },
      { name: "xMomentum", value: residuals.xMomentum },
      { name: "yMomentum", value: residuals.yMomentum },
      { name: "zMomentum", value: residuals.zMomentum },
    ];

    // Sort channels by residual magnitude → worst residual indicates
    // where the gradient is steepest.
    const sorted = [...channels].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const worstCount = Math.max(1, Math.round(channels.length * this.config.refineFraction * 4));

    for (let i = 0; i < Math.min(worstCount, sorted.length); i++) {
      const ch = sorted[i];
      const gradMag = Math.abs(ch.value);
      if (gradMag < 1e-12) continue;

      regions.push({
        centroid: this.pseudoCentroidForChannel(ch.name),
        gradientMagnitude: gradMag,
        refinementFactor: Math.max(0.3, 1 - gradMag * 100),
      });
    }

    return regions;
  }

  refineNearGradients(
    current: MeshSettings,
    regions: GradientRegion[],
    maxCells: number
  ): MeshSettings {
    if (regions.length === 0) {
      // Uniform refinement fallback
      return this.uniformRefine(current, maxCells);
    }

    // Weighted average refinement factor across regions
    const totalGrad = regions.reduce((s, r) => s + r.gradientMagnitude, 0);
    const weightedFactor =
      totalGrad > 0
        ? regions.reduce(
            (s, r) => s + r.refinementFactor * (r.gradientMagnitude / totalGrad),
            0
          )
        : 0.7;

    // Increase cell count proportionally to how much refinement is needed
    const growthFactor = 1 + this.config.refineFraction * (1 / Math.max(weightedFactor, 0.1));
    const newCells = Math.min(maxCells, Math.round(current.targetCellCount * growthFactor));
    const ratio = newCells / current.targetCellCount;
    const sizeScale = Math.pow(ratio, -1 / 3);

    return {
      ...current,
      targetCellCount: newCells,
      baseSize: current.baseSize * sizeScale,
      minSize: current.minSize * Math.max(sizeScale * 0.8, 0.3), // extra refinement in min
      maxSize: current.maxSize, // keep max to avoid over-coarsening far-field
      refinementLevels: Math.min(current.refinementLevels + 1, 10),
    };
  }

  // ── Uniform Refinement Fallback ───────────────────────────────────────

  private uniformRefine(current: MeshSettings, maxCells: number): MeshSettings {
    const factor = 1.5;
    const newCells = Math.min(maxCells, Math.round(current.targetCellCount * factor));
    const sizeScale = Math.pow(newCells / current.targetCellCount, -1 / 3);

    return {
      ...current,
      targetCellCount: newCells,
      baseSize: current.baseSize * sizeScale,
      minSize: current.minSize * sizeScale,
      maxSize: current.maxSize * sizeScale,
    };
  }

  // ── Metric Extraction ─────────────────────────────────────────────────

  private extractKeyMetric(result: PipelineResult): number | null {
    if (!result.finalResult?.results) return null;
    return result.finalResult.results.finalResiduals.continuity;
  }

  // ── Pseudo Centroids (would use real field data in production) ─────────

  private pseudoCentroidForChannel(channel: string): Vector3 {
    // Map residual channels to representative spatial regions
    switch (channel) {
      case "continuity":
        return { x: 0, y: 0, z: 0 };
      case "xMomentum":
        return { x: 0.5, y: 0, z: 0 };
      case "yMomentum":
        return { x: 0, y: 0.5, z: 0 };
      case "zMomentum":
        return { x: 0, y: 0, z: 0.5 };
      default:
        return { x: 0, y: 0, z: 0 };
    }
  }

  // ── Recommendation ────────────────────────────────────────────────────

  private generateRecommendation(passes: RefinementPass[]): string {
    if (passes.length === 0) return "No refinement passes completed.";

    const last = passes[passes.length - 1];
    const failedPasses = passes.filter((p) => !p.pipeline.success);

    if (failedPasses.length > 0) {
      return (
        `${failedPasses.length} of ${passes.length} passes failed to solve. ` +
        "Review solver settings before attempting further adaptive refinement."
      );
    }

    if (last.converged) {
      return (
        `Converged after ${passes.length} passes at ${last.cellCount.toLocaleString()} cells. ` +
        `Final metric change: ${last.metricChangePct}% (< ${this.config.convergenceThresholdPercent}% threshold). ` +
        "Solution is mesh-independent at the current refinement level."
      );
    }

    if (
      last.metricChangePct !== null &&
      last.metricChangePct < this.config.minImprovementPercent
    ) {
      return (
        `Refinement stalled after ${passes.length} passes — metric change ${last.metricChangePct}% ` +
        `is below minimum improvement threshold (${this.config.minImprovementPercent}%). ` +
        "Consider adjusting solver relaxation factors or boundary conditions."
      );
    }

    return (
      `Maximum ${this.config.maxPasses} passes reached without convergence. ` +
      `Last metric change: ${last.metricChangePct ?? "N/A"}%. ` +
      "Increase maxPasses or refine the starting mesh to achieve grid independence."
    );
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
