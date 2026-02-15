// ─── Benchmarking Module ──────────────────────────────────────────────────
// Barrel export for cross-simulation benchmarking.
// ──────────────────────────────────────────────────────────────────────────

export { BenchmarkEngine } from "./benchmark-engine";
export type {
  BenchmarkReport,
  DetailedBenchmarkReport,
  BenchmarkEntry,
  BenchmarkMetrics,
  MetricStats,
  PerformanceComparison,
  AnonymizedInsight,
  GeometryCluster,
} from "./benchmark-engine";
