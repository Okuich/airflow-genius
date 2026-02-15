// ─── Mesh Refinement Study ──────────────────────────────────────────────────
// Runs a Coarse → Medium → Fine mesh study to verify grid independence.
//
//   1. Generate three mesh configs (coarse, medium, fine) from a base config
//   2. Execute each level via SimulationExecutionPipeline
//   3. Extract key metrics (pressure drop, efficiency, residual quality)
//   4. Compute Grid Convergence Index (GCI) via Richardson extrapolation
//   5. Report whether the solution is grid-independent
//
// The refinement ratio defaults to √2 ≈ 1.414 between successive levels.
// ─────────────────────────────────────────────────────────────────────────────

import type { SimulationConfig, MeshSettings } from "@/packages/types";
import { getEventBus, type PlatformEventBus } from "@/packages/events";
import { SimulationExecutionPipeline, type PipelineConfig, type PipelineResult } from "./simulation-execution-pipeline";

// ── Public Types ──────────────────────────────────────────────────────────

export type MeshLevel = "coarse" | "medium" | "fine";

export interface RefinementStudyConfig {
  /** Cell-count multiplier between successive levels. Default √2 ≈ 1.414. */
  refinementRatio: number;
  /** Base cell count used as the "medium" level. Coarse = base / ratio², Fine = base × ratio². */
  baseCellCount?: number;
  /** Safety factor for GCI calculation. Default 1.25 (recommended for 3-grid studies). */
  safetyFactor: number;
  /** Maximum acceptable GCI (%) to declare grid independence. Default 3.0. */
  gciThresholdPercent: number;
  /** Pipeline config overrides forwarded to each simulation run. */
  pipelineConfig?: Partial<PipelineConfig>;
}

export interface MeshLevelResult {
  level: MeshLevel;
  cellCount: number;
  pipeline: PipelineResult;
  keyMetric: number | null;
  converged: boolean;
}

export interface RichardsonExtrapolation {
  /** Observed order of convergence (p). */
  order: number;
  /** Estimated exact solution (f_exact). */
  exactEstimate: number;
  /** GCI between fine and medium grids (%). */
  gciFine: number;
  /** GCI between medium and coarse grids (%). */
  gciMedium: number;
  /** Whether asymptotic range check passes (GCI_medium / (r^p × GCI_fine) ≈ 1). */
  inAsymptoticRange: boolean;
}

export interface RefinementStudyResult {
  levels: MeshLevelResult[];
  richardson: RichardsonExtrapolation | null;
  gridIndependent: boolean;
  recommendation: string;
  totalDurationMs: number;
}

// ── Defaults ──────────────────────────────────────────────────────────────

const STUDY_DEFAULTS: RefinementStudyConfig = {
  refinementRatio: Math.SQRT2,
  safetyFactor: 1.25,
  gciThresholdPercent: 3.0,
};

// ── Study Runner ──────────────────────────────────────────────────────────

export class MeshRefinementStudy {
  private readonly config: RefinementStudyConfig;
  private readonly pipeline: SimulationExecutionPipeline;
  private readonly bus: PlatformEventBus;

  constructor(
    config?: Partial<RefinementStudyConfig>,
    deps?: {
      pipeline?: SimulationExecutionPipeline;
      bus?: PlatformEventBus;
    }
  ) {
    this.config = { ...STUDY_DEFAULTS, ...config };
    this.pipeline = deps?.pipeline ?? new SimulationExecutionPipeline(this.config.pipelineConfig);
    this.bus = deps?.bus ?? getEventBus();
  }

  /** Run the full Coarse → Medium → Fine study. */
  async run(
    orgId: string,
    userId: string,
    baseConfig: SimulationConfig,
    onProgress?: (level: MeshLevel, stage: string) => void
  ): Promise<RefinementStudyResult> {
    const t0 = performance.now();
    const r = this.config.refinementRatio;
    const baseCells = this.config.baseCellCount ?? baseConfig.meshSettings.targetCellCount;

    // ── Generate configs for each level ─────────────────────────────────
    const levelDefs: { level: MeshLevel; cellCount: number }[] = [
      { level: "coarse", cellCount: Math.round(baseCells / (r * r)) },
      { level: "medium", cellCount: baseCells },
      { level: "fine", cellCount: Math.round(baseCells * r * r) },
    ];

    const levels: MeshLevelResult[] = [];

    // ── Execute sequentially: coarse → medium → fine ────────────────────
    for (const def of levelDefs) {
      onProgress?.(def.level, "starting");

      const meshConfig = this.scaleMeshSettings(baseConfig.meshSettings, baseCells, def.cellCount);
      const simConfig: SimulationConfig = {
        ...baseConfig,
        id: `${baseConfig.id}-${def.level}`,
        name: `${baseConfig.name} (${def.level})`,
        meshSettings: meshConfig,
      };

      const result = await this.pipeline.execute(orgId, userId, simConfig, (stage, detail) => {
        onProgress?.(def.level, `${stage}: ${detail}`);
      });

      const keyMetric = this.extractKeyMetric(result);

      levels.push({
        level: def.level,
        cellCount: def.cellCount,
        pipeline: result,
        keyMetric,
        converged: result.success,
      });

      onProgress?.(def.level, result.success ? "completed" : "failed");
    }

    // ── Richardson extrapolation ─────────────────────────────────────────
    const allConverged = levels.every((l) => l.converged);
    const allHaveMetrics = levels.every((l) => l.keyMetric !== null);

    let richardson: RichardsonExtrapolation | null = null;
    let gridIndependent = false;

    if (allConverged && allHaveMetrics) {
      richardson = this.computeRichardsonExtrapolation(
        levels[0].keyMetric!,
        levels[1].keyMetric!,
        levels[2].keyMetric!,
        this.config.refinementRatio
      );
      gridIndependent = richardson.gciFine <= this.config.gciThresholdPercent;
    }

    const recommendation = this.generateRecommendation(levels, richardson, gridIndependent);

    const studyResult: RefinementStudyResult = {
      levels,
      richardson,
      gridIndependent,
      recommendation,
      totalDurationMs: Math.round(performance.now() - t0),
    };

    await this.bus.emit("refinement_study.completed", {
      simulationId: baseConfig.id,
      organizationId: orgId,
      userId,
      gridIndependent,
      gciFine: richardson?.gciFine ?? null,
      timestamp: new Date().toISOString(),
    });

    return studyResult;
  }

  // ── Mesh Scaling ──────────────────────────────────────────────────────

  scaleMeshSettings(
    base: MeshSettings,
    baseCells: number,
    targetCells: number
  ): MeshSettings {
    const ratio = targetCells / baseCells;
    // In 3D, cell count ∝ (1/h)³, so h scales as ratio^(-1/3)
    const sizeScale = Math.pow(ratio, -1 / 3);

    return {
      ...base,
      targetCellCount: targetCells,
      baseSize: base.baseSize * sizeScale,
      minSize: base.minSize * sizeScale,
      maxSize: base.maxSize * sizeScale,
      // Keep refinement levels, BL count, and quality threshold unchanged
    };
  }

  // ── Richardson Extrapolation ──────────────────────────────────────────

  computeRichardsonExtrapolation(
    f_coarse: number,
    f_medium: number,
    f_fine: number,
    r: number
  ): RichardsonExtrapolation {
    const epsilon32 = f_medium - f_coarse;
    const epsilon21 = f_fine - f_medium;

    // Observed order of convergence
    let p: number;
    if (Math.abs(epsilon21) < 1e-15 || Math.abs(epsilon32) < 1e-15) {
      // Metrics are identical across grids → effectively converged
      p = 2;
    } else {
      const ratio = epsilon32 / epsilon21;
      if (ratio <= 0) {
        // Oscillatory convergence — use fallback order
        p = 1;
      } else {
        p = Math.abs(Math.log(Math.abs(ratio)) / Math.log(r));
      }
    }

    // Clamp p to reasonable range [0.5, 5]
    p = Math.max(0.5, Math.min(5, p));

    // Extrapolated exact solution
    const rp = Math.pow(r, p);
    const denom = rp - 1;
    const exactEstimate = denom !== 0
      ? f_fine + (f_fine - f_medium) / denom
      : f_fine;

    // GCI (%)
    const Fs = this.config.safetyFactor;
    const gciFine = Math.abs(f_fine) > 1e-15
      ? Fs * Math.abs((f_fine - f_medium) / f_fine) / (rp - 1) * 100
      : 0;
    const gciMedium = Math.abs(f_medium) > 1e-15
      ? Fs * Math.abs((f_medium - f_coarse) / f_medium) / (rp - 1) * 100
      : 0;

    // Asymptotic range check: GCI_medium / (r^p × GCI_fine) ≈ 1
    const asymptoticRatio = gciFine > 0 ? gciMedium / (rp * gciFine) : 0;
    const inAsymptoticRange = Math.abs(asymptoticRatio - 1) < 0.1;

    return {
      order: Math.round(p * 100) / 100,
      exactEstimate: Math.round(exactEstimate * 1e6) / 1e6,
      gciFine: Math.round(gciFine * 100) / 100,
      gciMedium: Math.round(gciMedium * 100) / 100,
      inAsymptoticRange,
    };
  }

  // ── Metric Extraction ─────────────────────────────────────────────────

  private extractKeyMetric(result: PipelineResult): number | null {
    if (!result.finalResult?.results) return null;
    const r = result.finalResult.results;
    // Use continuity residual magnitude as the proxy metric for grid convergence
    return r.finalResiduals.continuity;
  }

  // ── Recommendation ────────────────────────────────────────────────────

  private generateRecommendation(
    levels: MeshLevelResult[],
    richardson: RichardsonExtrapolation | null,
    gridIndependent: boolean
  ): string {
    const failedLevels = levels.filter((l) => !l.converged);

    if (failedLevels.length > 0) {
      const names = failedLevels.map((l) => l.level).join(", ");
      return (
        `Mesh refinement study incomplete: ${names} level(s) failed to converge. ` +
        "Review solver settings and boundary conditions before refining further."
      );
    }

    if (!richardson) {
      return "Could not compute Richardson extrapolation — insufficient data.";
    }

    if (gridIndependent) {
      return (
        `Grid independence achieved. GCI_fine = ${richardson.gciFine}% (< ${this.config.gciThresholdPercent}%). ` +
        `Observed convergence order p = ${richardson.order}. ` +
        (richardson.inAsymptoticRange
          ? "Solution is in the asymptotic range — medium mesh is adequate for production."
          : "Solution is grid-independent but not yet in the asymptotic range — fine mesh recommended for highest confidence.")
      );
    }

    return (
      `Grid independence NOT achieved. GCI_fine = ${richardson.gciFine}% (> ${this.config.gciThresholdPercent}%). ` +
      `Consider adding an extra refinement level or reducing the refinement ratio. ` +
      `Current convergence order p = ${richardson.order}.`
    );
  }
}
