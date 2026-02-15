// ─── Benchmark Engine ──────────────────────────────────────────────────────
// Cross-simulation intelligence: clusters simulations by geometry type,
// computes percentile rankings, and returns anonymized industry insights.
//
// All logic is deterministic — no randomness, no external calls.
// ──────────────────────────────────────────────────────────────────────────

import type {
  SimulationConfig,
  FeatureVector,
  MeshStats,
  EfficiencyRating,
  CleanroomMetrics,
  CleanroomSimulationConfig,
} from "@/packages/types";
import { FlowType } from "@/packages/types";

// ── Public Types ──────────────────────────────────────────────────────────

export type GeometryCluster =
  | "internal-flow"
  | "external-flow"
  | "rotating-machinery"
  | "heat-exchanger"
  | "cleanroom"
  | "generic";

export interface BenchmarkReport {
  /** Percentile rank within the geometry cluster [0–100]. */
  percentileRank: number;
  /** Anonymized industry average for the primary metric. */
  industryAverage: number;
  /** Estimated improvement potential (fraction, 0–1). */
  improvementPotential: number;
}

export interface DetailedBenchmarkReport extends BenchmarkReport {
  geometryCluster: GeometryCluster;
  sampleSize: number;
  metrics: BenchmarkMetrics;
  comparisons: PerformanceComparison[];
  insights: AnonymizedInsight[];
}

export interface BenchmarkMetrics {
  pressureDrop: MetricStats;
  meshQuality: MetricStats;
  convergenceSpeed: MetricStats;
  efficiency: MetricStats;
}

export interface MetricStats {
  value: number;
  p25: number;
  p50: number;
  p75: number;
  min: number;
  max: number;
  percentile: number;
}

export interface PerformanceComparison {
  metric: string;
  userValue: number;
  clusterMedian: number;
  clusterBest: number;
  delta: number;
  rating: "below-average" | "average" | "above-average" | "top-tier";
}

export interface AnonymizedInsight {
  category: "mesh" | "solver" | "efficiency" | "convergence";
  message: string;
  relevance: number;
}

export interface BenchmarkEntry {
  id: string;
  organizationId: string;
  config: SimulationConfig;
  features: FeatureVector;
  meshStats: MeshStats;
  pressureDrop: number;
  efficiencyRating: EfficiencyRating;
  converged: boolean;
  totalIterations: number;
  timestamp: string;
  cleanroomMetrics?: CleanroomMetrics;
}

export interface ISOClassDistribution {
  isoClass: string;
  count: number;
  percentile: number;
}

export interface CleanroomBenchmarkReport extends DetailedBenchmarkReport {
  isoClassDistribution: ISOClassDistribution[];
  avgAirChangeRate: number;
  avgParticleRetentionRate: number;
  avgLaminarStabilityScore: number;
}

// ── Engine ────────────────────────────────────────────────────────────────

export class BenchmarkEngine {
  private entries: BenchmarkEntry[] = [];

  /** Ingest a completed simulation into the benchmark pool. */
  addEntry(entry: BenchmarkEntry): void {
    this.entries.push(entry);
  }

  /** Bulk-load entries (e.g. from DB). */
  loadEntries(entries: BenchmarkEntry[]): void {
    this.entries = [...entries];
  }

  get entryCount(): number {
    return this.entries.length;
  }

  // ════════════════════════════════════════════════════════════════════
  //  Geometry Clustering
  // ════════════════════════════════════════════════════════════════════

  /** Deterministic geometry classification based on config features. */
  classifyGeometry(config: SimulationConfig): GeometryCluster {
    // Cleanroom: has particle transport or cleanroom flow types
    if (this.isCleanroomConfig(config)) return "cleanroom";

    // Rotating machinery: has rotating frame or rotating walls
    if (config.rotatingFrame?.enabled) return "rotating-machinery";
    const hasRotatingWall = config.boundaryConditions.some(
      (bc) => bc.type === "rotating_wall"
    );
    if (hasRotatingWall) return "rotating-machinery";

    // Heat exchanger: heat transfer enabled with multiple inlets/outlets
    if (config.enableHeatTransfer) {
      const inlets = config.boundaryConditions.filter(
        (bc) => bc.type === "inlet" || bc.type === "velocity_inlet" || bc.type === "pressure_inlet"
      );
      const outlets = config.boundaryConditions.filter(
        (bc) => bc.type === "outlet" || bc.type === "pressure_outlet"
      );
      if (inlets.length >= 2 || outlets.length >= 2) return "heat-exchanger";
    }

    // Internal vs external: ratio of wall BCs to total BCs
    const walls = config.boundaryConditions.filter(
      (bc) => bc.type === "wall"
    );
    const wallRatio = config.boundaryConditions.length > 0
      ? walls.length / config.boundaryConditions.length
      : 0;

    // High wall ratio + enclosed → internal flow
    if (wallRatio > 0.5) return "internal-flow";

    // Symmetry boundaries suggest external flow
    const hasSymmetry = config.boundaryConditions.some(
      (bc) => bc.type === "symmetry"
    );
    if (hasSymmetry) return "external-flow";

    return "generic";
  }

  private isCleanroomConfig(config: SimulationConfig): boolean {
    return (
      "particleTransport" in config ||
      config.flowType === FlowType.ParticleDispersion ||
      config.flowType === FlowType.ContaminantDecay ||
      config.flowType === FlowType.LaminarFlowValidation
    );
  }

  /** Get all entries in a given geometry cluster. */
  getCluster(cluster: GeometryCluster): BenchmarkEntry[] {
    return this.entries.filter(
      (e) => this.classifyGeometry(e.config) === cluster
    );
  }

  // ════════════════════════════════════════════════════════════════════
  //  Percentile Rankings
  // ════════════════════════════════════════════════════════════════════

  /** Compute the percentile rank of a value within a sorted array. */
  private percentileOf(value: number, sorted: number[]): number {
    if (sorted.length === 0) return 50;
    let count = 0;
    for (const v of sorted) {
      if (v < value) count++;
      else if (v === value) count += 0.5;
    }
    return Math.round((count / sorted.length) * 100 * 100) / 100;
  }

  /** Get value at a given percentile from a sorted array. */
  private valueAtPercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.min(
      sorted.length - 1,
      Math.floor((p / 100) * sorted.length)
    );
    return sorted[idx];
  }

  /** Build metric stats for a value against a pool of values. */
  private buildMetricStats(value: number, pool: number[]): MetricStats {
    const sorted = [...pool].sort((a, b) => a - b);
    return {
      value,
      p25: this.valueAtPercentile(sorted, 25),
      p50: this.valueAtPercentile(sorted, 50),
      p75: this.valueAtPercentile(sorted, 75),
      min: sorted.length > 0 ? sorted[0] : 0,
      max: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
      percentile: this.percentileOf(value, sorted),
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //  Core Report Generation
  // ════════════════════════════════════════════════════════════════════

  /** Generate a simple BenchmarkReport for a simulation's features. */
  report(
    config: SimulationConfig,
    features: FeatureVector
  ): BenchmarkReport {
    const cluster = this.classifyGeometry(config);
    const pool = this.getCluster(cluster);

    if (pool.length === 0) {
      return {
        percentileRank: 50,
        industryAverage: features.efficiency,
        improvementPotential: 0,
      };
    }

    // Primary metric: composite score (higher = better)
    const compositeScore = this.computeComposite(features);
    const poolScores = pool
      .map((e) => this.computeComposite(e.features))
      .sort((a, b) => a - b);

    const percentileRank = this.percentileOf(compositeScore, poolScores);
    const industryAverage = poolScores.reduce((a, b) => a + b, 0) / poolScores.length;

    // Improvement potential: gap to 90th percentile
    const p90 = this.valueAtPercentile(poolScores, 90);
    const improvementPotential = compositeScore > 0
      ? Math.max(0, Math.round(((p90 - compositeScore) / compositeScore) * 10000) / 10000)
      : 0;

    return {
      percentileRank,
      industryAverage: Math.round(industryAverage * 10000) / 10000,
      improvementPotential,
    };
  }

  /** Generate a detailed benchmark report with comparisons and insights. */
  detailedReport(
    config: SimulationConfig,
    features: FeatureVector,
    meshStats: MeshStats
  ): DetailedBenchmarkReport {
    const cluster = this.classifyGeometry(config);
    const pool = this.getCluster(cluster);
    const base = this.report(config, features);

    const metrics: BenchmarkMetrics = {
      pressureDrop: this.buildMetricStats(
        features.pressureDrop,
        pool.map((e) => e.features.pressureDrop)
      ),
      meshQuality: this.buildMetricStats(
        features.meshQualityScore,
        pool.map((e) => e.features.meshQualityScore)
      ),
      convergenceSpeed: this.buildMetricStats(
        features.convergenceSpeed,
        pool.map((e) => e.features.convergenceSpeed)
      ),
      efficiency: this.buildMetricStats(
        features.efficiency,
        pool.map((e) => e.features.efficiency)
      ),
    };

    const comparisons = this.buildComparisons(features, pool);
    const insights = this.generateInsights(features, metrics, cluster);

    return {
      ...base,
      geometryCluster: cluster,
      sampleSize: pool.length,
      metrics,
      comparisons,
      insights,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //  Performance Comparisons
  // ════════════════════════════════════════════════════════════════════

  private buildComparisons(
    features: FeatureVector,
    pool: BenchmarkEntry[]
  ): PerformanceComparison[] {
    if (pool.length === 0) return [];

    const metricDefs: { key: keyof FeatureVector; label: string; higherBetter: boolean }[] = [
      { key: "efficiency", label: "Efficiency", higherBetter: true },
      { key: "convergenceSpeed", label: "Convergence Speed", higherBetter: true },
      { key: "meshQualityScore", label: "Mesh Quality", higherBetter: true },
      { key: "pressureDrop", label: "Pressure Drop", higherBetter: false },
    ];

    return metricDefs.map(({ key, label, higherBetter }) => {
      const userValue = features[key];
      const poolValues = pool.map((e) => e.features[key]).sort((a, b) => a - b);
      const median = this.valueAtPercentile(poolValues, 50);
      const best = higherBetter
        ? poolValues[poolValues.length - 1]
        : poolValues[0];

      const delta = median !== 0
        ? Math.round(((userValue - median) / Math.abs(median)) * 10000) / 10000
        : 0;

      const percentile = this.percentileOf(
        userValue,
        higherBetter ? poolValues : [...poolValues].reverse()
      );

      let rating: PerformanceComparison["rating"];
      if (percentile >= 90) rating = "top-tier";
      else if (percentile >= 60) rating = "above-average";
      else if (percentile >= 40) rating = "average";
      else rating = "below-average";

      return { metric: label, userValue, clusterMedian: median, clusterBest: best, delta, rating };
    });
  }

  // ════════════════════════════════════════════════════════════════════
  //  Anonymized Industry Insights
  // ════════════════════════════════════════════════════════════════════

  private generateInsights(
    features: FeatureVector,
    metrics: BenchmarkMetrics,
    cluster: GeometryCluster
  ): AnonymizedInsight[] {
    const insights: AnonymizedInsight[] = [];

    // Mesh quality insights
    if (metrics.meshQuality.percentile < 25) {
      insights.push({
        category: "mesh",
        message: `Mesh quality is in the bottom quartile for ${cluster} simulations. ${Math.round(75 - metrics.meshQuality.percentile)}% of similar setups achieve better mesh scores.`,
        relevance: 0.9,
      });
    } else if (metrics.meshQuality.percentile > 90) {
      insights.push({
        category: "mesh",
        message: `Mesh quality is in the top 10% for ${cluster} simulations. Consider whether this resolution is needed or if a coarser mesh would save compute.`,
        relevance: 0.6,
      });
    }

    // Convergence insights
    if (metrics.convergenceSpeed.percentile < 30) {
      insights.push({
        category: "convergence",
        message: `Convergence speed is slower than ${Math.round(100 - metrics.convergenceSpeed.percentile)}% of comparable simulations. Adjusting relaxation factors may help.`,
        relevance: 0.85,
      });
    }

    // Efficiency insights
    if (metrics.efficiency.percentile < 40) {
      insights.push({
        category: "efficiency",
        message: `Efficiency is below the cluster median (${metrics.efficiency.p50.toFixed(2)} vs your ${features.efficiency.toFixed(2)}). Industry benchmarks suggest a ${Math.round(metrics.efficiency.p75 * 100)}% target is achievable.`,
        relevance: 0.8,
      });
    }

    // Pressure drop insights — cluster-specific
    if (cluster === "internal-flow" && metrics.pressureDrop.percentile > 75) {
      insights.push({
        category: "solver",
        message: `Pressure drop is higher than 75% of internal-flow benchmarks. Check for mesh resolution near constrictions or sharp turns.`,
        relevance: 0.75,
      });
    }

    if (cluster === "rotating-machinery" && features.convergenceSpeed < 0.3) {
      insights.push({
        category: "convergence",
        message: `Rotating machinery simulations with low convergence speed often benefit from ramping RPM gradually or using MRF initialization.`,
        relevance: 0.7,
      });
    }

    // Cleanroom-specific insights
    if (cluster === "cleanroom") {
      insights.push({
        category: "efficiency",
        message: `Cleanroom simulation detected. Ensure HEPA filter face velocity is modelled accurately; ±5% deviation can shift ISO class estimates.`,
        relevance: 0.85,
      });
      if (features.meshQualityScore < 0.6) {
        insights.push({
          category: "mesh",
          message: `Mesh quality may be insufficient for particle tracking — sub-micron particles require fine mesh near injection surfaces and walls.`,
          relevance: 0.9,
        });
      }
    }

    // Sort by relevance
    insights.sort((a, b) => b.relevance - a.relevance);
    return insights;
  }

  // ════════════════════════════════════════════════════════════════════
  //  Composite Score
  // ════════════════════════════════════════════════════════════════════

  /**
   * Composite performance score ∈ [0, 1].
   *
   * Weighted blend:
   *   40% efficiency + 25% convergence + 25% mesh quality + 10% (1 - normalized pressureDrop)
   *
   * Pressure drop is inverted & normalized: lower is better, capped at 5000 Pa.
   */
  private computeComposite(features: FeatureVector): number {
    const pdNorm = Math.max(0, 1 - features.pressureDrop / 5000);
    const score =
      0.4 * features.efficiency +
      0.25 * features.convergenceSpeed +
      0.25 * features.meshQualityScore +
      0.1 * pdNorm;
    return Math.round(Math.max(0, Math.min(1, score)) * 10000) / 10000;
  }

  // ════════════════════════════════════════════════════════════════════
  //  ISO Class Clustering (Cleanroom)
  // ════════════════════════════════════════════════════════════════════

  /** Generate a cleanroom-specific benchmark report with ISO class distribution. */
  cleanroomReport(
    config: SimulationConfig,
    features: FeatureVector,
    meshStats: MeshStats
  ): CleanroomBenchmarkReport {
    const base = this.detailedReport(config, features, meshStats);
    const pool = this.getCluster("cleanroom");

    const isoClassDistribution = this.computeISOClassDistribution(pool);

    const cleanroomEntries = pool.filter((e) => e.cleanroomMetrics);
    const avgAirChangeRate = this.avg(cleanroomEntries.map((e) => e.cleanroomMetrics!.airChangeRate));
    const avgParticleRetentionRate = this.avg(cleanroomEntries.map((e) => e.cleanroomMetrics!.particleRetentionRate));
    const avgLaminarStabilityScore = this.avg(cleanroomEntries.map((e) => e.cleanroomMetrics!.laminarStabilityScore));

    return {
      ...base,
      isoClassDistribution,
      avgAirChangeRate: round4(avgAirChangeRate),
      avgParticleRetentionRate: round4(avgParticleRetentionRate),
      avgLaminarStabilityScore: round4(avgLaminarStabilityScore),
    };
  }

  private computeISOClassDistribution(pool: BenchmarkEntry[]): ISOClassDistribution[] {
    const counts = new Map<string, number>();
    for (const e of pool) {
      const iso = e.cleanroomMetrics?.isoClassEstimate ?? "unknown";
      counts.set(iso, (counts.get(iso) ?? 0) + 1);
    }

    const total = pool.length || 1;
    return [...counts.entries()]
      .map(([isoClass, count]) => ({
        isoClass,
        count,
        percentile: round4((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }

  private avg(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }
}

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
