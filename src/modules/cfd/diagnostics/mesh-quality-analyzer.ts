// ─── Mesh Quality Analyzer ──────────────────────────────────────────────────

export interface MeshQualityReport {
  skewnessIssues: number;
  aspectRatioIssues: number;
  wallResolutionQuality: "Poor" | "Acceptable" | "Good";
  suggestions: string[];
  /** Fraction of cells exceeding skewness threshold */
  skewnessFailRate: number;
  /** Fraction of cells exceeding aspect-ratio threshold */
  aspectRatioFailRate: number;
  /** Statistical summary of y+ distribution */
  yPlusStats: { min: number; max: number; mean: number; median: number };
}

export interface MeshQualityThresholds {
  maxSkewness: number;
  maxAspectRatio: number;
  yPlusLow: number;
  yPlusHigh: number;
  /** If true the user intends wall-resolved LES / low-Re model (y+ < 1) */
  wallResolved: boolean;
}

const DEFAULT_THRESHOLDS: MeshQualityThresholds = {
  maxSkewness: 0.85,
  maxAspectRatio: 20,
  yPlusLow: 30,
  yPlusHigh: 300,
  wallResolved: false,
};

export class MeshQualityAnalyzer {
  private readonly t: MeshQualityThresholds;

  constructor(thresholds?: Partial<MeshQualityThresholds>) {
    this.t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  analyse(
    cellSkewness: number[],
    aspectRatios: number[],
    yPlusValues: number[]
  ): MeshQualityReport {
    const skewnessIssues = cellSkewness.filter((s) => s > this.t.maxSkewness).length;
    const aspectRatioIssues = aspectRatios.filter((a) => a > this.t.maxAspectRatio).length;

    const skewnessFailRate = cellSkewness.length > 0 ? skewnessIssues / cellSkewness.length : 0;
    const aspectRatioFailRate = aspectRatios.length > 0 ? aspectRatioIssues / aspectRatios.length : 0;

    const yPlusStats = this.computeStats(yPlusValues);
    const wallResolutionQuality = this.rateWallResolution(yPlusValues, yPlusStats);

    const suggestions = this.generateSuggestions(
      skewnessIssues,
      skewnessFailRate,
      cellSkewness,
      aspectRatioIssues,
      aspectRatioFailRate,
      aspectRatios,
      wallResolutionQuality,
      yPlusStats
    );

    return {
      skewnessIssues,
      aspectRatioIssues,
      wallResolutionQuality,
      suggestions,
      skewnessFailRate,
      aspectRatioFailRate,
      yPlusStats,
    };
  }

  // ── Wall Resolution Rating ────────────────────────────────────────────

  private rateWallResolution(
    yPlus: number[],
    stats: MeshQualityReport["yPlusStats"]
  ): MeshQualityReport["wallResolutionQuality"] {
    if (yPlus.length === 0) return "Poor";

    if (this.t.wallResolved) {
      // Wall-resolved: want y+ < 1 everywhere
      if (stats.max <= 1) return "Good";
      if (stats.mean <= 1 && stats.max <= 5) return "Acceptable";
      return "Poor";
    }

    // Wall-function mode: want y+ in [yPlusLow, yPlusHigh]
    const inRange = yPlus.filter(
      (v) => v >= this.t.yPlusLow && v <= this.t.yPlusHigh
    ).length;
    const fraction = inRange / yPlus.length;

    if (fraction >= 0.9) return "Good";
    if (fraction >= 0.7) return "Acceptable";
    return "Poor";
  }

  // ── Suggestion Engine ─────────────────────────────────────────────────

  private generateSuggestions(
    skewnessIssues: number,
    skewnessFailRate: number,
    cellSkewness: number[],
    aspectRatioIssues: number,
    aspectRatioFailRate: number,
    aspectRatios: number[],
    wallQuality: MeshQualityReport["wallResolutionQuality"],
    yStats: MeshQualityReport["yPlusStats"]
  ): string[] {
    const suggestions: string[] = [];

    // ── Skewness ──────────────────────────────────────────────────────
    if (skewnessIssues > 0) {
      const maxSkew = Math.max(...cellSkewness);
      suggestions.push(
        `${skewnessIssues} cell(s) (${(skewnessFailRate * 100).toFixed(1)}%) exceed the skewness threshold of ${this.t.maxSkewness}. ` +
          `Max skewness: ${maxSkew.toFixed(3)}. ` +
          (maxSkew > 0.95
            ? "Highly degenerate cells detected — consider re-meshing the affected region with a smaller base size or smoothing passes."
            : "Apply 2–3 Laplacian smoothing iterations or increase refinement near curved surfaces.")
      );
    }

    // ── Aspect Ratio ─────────────────────────────────────────────────
    if (aspectRatioIssues > 0) {
      const maxAR = Math.max(...aspectRatios);
      suggestions.push(
        `${aspectRatioIssues} cell(s) (${(aspectRatioFailRate * 100).toFixed(1)}%) exceed aspect-ratio limit of ${this.t.maxAspectRatio}. ` +
          `Max AR: ${maxAR.toFixed(1)}. ` +
          (maxAR > 100
            ? "Extreme stretching found — likely in boundary-layer or near thin surfaces. Reduce BL growth rate or add local size control."
            : "Reduce the boundary-layer growth rate from its current value toward 1.1–1.15.")
      );
    }

    // ── Wall Resolution ──────────────────────────────────────────────
    if (wallQuality === "Poor") {
      if (this.t.wallResolved) {
        suggestions.push(
          `Wall-resolved mode requires y+ < 1, but y+ ranges from ${yStats.min.toFixed(1)} to ${yStats.max.toFixed(1)} (mean ${yStats.mean.toFixed(1)}). ` +
            "Reduce the first-cell height to bring y+ below 1 across all wall surfaces."
        );
      } else {
        const below = yStats.min < this.t.yPlusLow;
        const above = yStats.max > this.t.yPlusHigh;
        if (below && above) {
          suggestions.push(
            `y+ distribution spans ${yStats.min.toFixed(1)}–${yStats.max.toFixed(1)}, crossing both the lower (${this.t.yPlusLow}) and upper (${this.t.yPlusHigh}) bounds. ` +
              "Adjust boundary-layer first-cell height to target y+ ≈ 50 and reduce growth rate for more uniform distribution."
          );
        } else if (below) {
          suggestions.push(
            `y+ values drop to ${yStats.min.toFixed(1)}, below the wall-function minimum of ${this.t.yPlusLow}. ` +
              "Increase first-cell height or switch to a wall-resolved turbulence model (e.g. k-ω SST with low-Re correction)."
          );
        } else {
          suggestions.push(
            `y+ values reach ${yStats.max.toFixed(1)}, exceeding the wall-function maximum of ${this.t.yPlusHigh}. ` +
              "Add more boundary-layer cells or reduce the first-cell height to keep y+ within 30–300."
          );
        }
      }
    } else if (wallQuality === "Acceptable") {
      suggestions.push(
        "Near-wall resolution is acceptable but could be improved. Fine-tune first-cell height for more consistent y+ values."
      );
    }

    if (suggestions.length === 0) {
      suggestions.push("Mesh quality metrics are within acceptable limits. No changes recommended.");
    }

    return suggestions;
  }

  // ── Statistics Helper ─────────────────────────────────────────────────

  private computeStats(values: number[]): MeshQualityReport["yPlusStats"] {
    if (values.length === 0) return { min: 0, max: 0, mean: 0, median: 0 };

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];

    return { min, max, mean, median };
  }
}
