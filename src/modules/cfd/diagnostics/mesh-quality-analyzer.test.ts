import { describe, it, expect } from "vitest";
import { MeshQualityAnalyzer } from "./mesh-quality-analyzer";

describe("MeshQualityAnalyzer", () => {
  // ── Clean Mesh ──────────────────────────────────────────────────────
  it("reports no issues for a clean mesh", () => {
    const analyzer = new MeshQualityAnalyzer();
    const report = analyzer.analyse(
      [0.1, 0.2, 0.3, 0.15],
      [2, 3, 5, 4],
      [45, 60, 80, 55]
    );

    expect(report.skewnessIssues).toBe(0);
    expect(report.aspectRatioIssues).toBe(0);
    expect(report.wallResolutionQuality).toBe("Good");
    expect(report.suggestions).toHaveLength(1);
    expect(report.suggestions[0]).toContain("within acceptable limits");
  });

  // ── Skewness Issues ────────────────────────────────────────────────
  it("detects skewness violations", () => {
    const analyzer = new MeshQualityAnalyzer({ maxSkewness: 0.8 });
    const report = analyzer.analyse([0.5, 0.85, 0.92, 0.3], [5, 5], [50, 60]);

    expect(report.skewnessIssues).toBe(2);
    expect(report.skewnessFailRate).toBeCloseTo(0.5);
    expect(report.suggestions.some((s) => s.includes("skewness"))).toBe(true);
  });

  it("flags degenerate cells above 0.95", () => {
    const analyzer = new MeshQualityAnalyzer();
    const report = analyzer.analyse([0.97], [5], [50]);

    expect(report.skewnessIssues).toBe(1);
    expect(report.suggestions.some((s) => s.includes("degenerate"))).toBe(true);
  });

  // ── Aspect Ratio Issues ───────────────────────────────────────────
  it("detects aspect-ratio violations", () => {
    const analyzer = new MeshQualityAnalyzer({ maxAspectRatio: 10 });
    const report = analyzer.analyse([0.1], [5, 12, 150], [50]);

    expect(report.aspectRatioIssues).toBe(2);
    expect(report.suggestions.some((s) => s.includes("aspect-ratio"))).toBe(true);
  });

  it("flags extreme stretching above AR 100", () => {
    const analyzer = new MeshQualityAnalyzer();
    const report = analyzer.analyse([0.1], [120], [50]);

    expect(report.suggestions.some((s) => s.includes("Extreme stretching"))).toBe(true);
  });

  // ── Wall Resolution: Wall-Function Mode ────────────────────────────
  it("rates Good when y+ is within 30-300", () => {
    const analyzer = new MeshQualityAnalyzer();
    const report = analyzer.analyse([0.1], [5], [35, 50, 80, 120, 200]);
    expect(report.wallResolutionQuality).toBe("Good");
  });

  it("rates Poor when y+ is mostly out of range", () => {
    const analyzer = new MeshQualityAnalyzer();
    const report = analyzer.analyse([0.1], [5], [5, 8, 10, 12, 500]);
    expect(report.wallResolutionQuality).toBe("Poor");
  });

  it("rates Acceptable at 70-90% in range", () => {
    const analyzer = new MeshQualityAnalyzer();
    // 8 out of 10 in range = 80%
    const yPlus = [35, 40, 50, 60, 70, 80, 90, 100, 5, 400];
    const report = analyzer.analyse([0.1], [5], yPlus);
    expect(report.wallResolutionQuality).toBe("Acceptable");
  });

  // ── Wall Resolution: Wall-Resolved Mode ────────────────────────────
  it("rates Good when y+ < 1 in wall-resolved mode", () => {
    const analyzer = new MeshQualityAnalyzer({ wallResolved: true });
    const report = analyzer.analyse([0.1], [5], [0.3, 0.5, 0.8, 0.9]);
    expect(report.wallResolutionQuality).toBe("Good");
  });

  it("rates Poor when y+ > 5 in wall-resolved mode", () => {
    const analyzer = new MeshQualityAnalyzer({ wallResolved: true });
    const report = analyzer.analyse([0.1], [5], [0.5, 2, 8, 15]);
    expect(report.wallResolutionQuality).toBe("Poor");
  });

  // ── Empty Inputs ──────────────────────────────────────────────────
  it("handles empty arrays gracefully", () => {
    const analyzer = new MeshQualityAnalyzer();
    const report = analyzer.analyse([], [], []);

    expect(report.skewnessIssues).toBe(0);
    expect(report.aspectRatioIssues).toBe(0);
    expect(report.wallResolutionQuality).toBe("Poor");
    expect(report.yPlusStats.min).toBe(0);
  });

  // ── Custom Thresholds ─────────────────────────────────────────────
  it("respects custom thresholds", () => {
    const analyzer = new MeshQualityAnalyzer({
      maxSkewness: 0.5,
      maxAspectRatio: 5,
      yPlusLow: 50,
      yPlusHigh: 200,
    });
    const report = analyzer.analyse([0.55], [6], [40]);

    expect(report.skewnessIssues).toBe(1);
    expect(report.aspectRatioIssues).toBe(1);
    expect(report.wallResolutionQuality).toBe("Poor");
  });

  // ── Y+ Stats ──────────────────────────────────────────────────────
  it("computes correct y+ statistics", () => {
    const analyzer = new MeshQualityAnalyzer();
    const report = analyzer.analyse([0.1], [5], [10, 20, 30, 40, 50]);

    expect(report.yPlusStats.min).toBe(10);
    expect(report.yPlusStats.max).toBe(50);
    expect(report.yPlusStats.mean).toBe(30);
    expect(report.yPlusStats.median).toBe(30);
  });

  it("computes median for even-length array", () => {
    const analyzer = new MeshQualityAnalyzer();
    const report = analyzer.analyse([0.1], [5], [10, 20, 30, 40]);

    expect(report.yPlusStats.median).toBe(25);
  });
});
