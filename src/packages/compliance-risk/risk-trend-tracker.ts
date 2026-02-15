// ─── Risk Trend Tracker ─────────────────────────────────────────────────────
// In-memory tracker for risk score history and trend analysis.
// ──────────────────────────────────────────────────────────────────────────

import type { RiskTrendPoint, RiskTrendAnalysis, RiskTrend } from "./types";

export class RiskTrendTracker {
  private readonly history: Map<string, RiskTrendPoint[]> = new Map();

  /** Record a new risk snapshot for an organization. */
  record(organizationId: string, overallScore: number, violations: number): void {
    const points = this.history.get(organizationId) ?? [];
    points.push({ timestamp: new Date().toISOString(), overallScore, violations });
    this.history.set(organizationId, points);
  }

  /** Analyse the risk trend for an organization. */
  analyse(organizationId: string): RiskTrendAnalysis {
    const points = this.history.get(organizationId) ?? [];

    if (points.length < 2) {
      return { trend: "stable", points, deltaScore: 0, deltaViolations: 0 };
    }

    const first = points[0];
    const last = points[points.length - 1];
    const deltaScore = last.overallScore - first.overallScore;
    const deltaViolations = last.violations - first.violations;

    let trend: RiskTrend = "stable";
    if (deltaScore < -5) trend = "improving";
    else if (deltaScore > 5) trend = "degrading";

    return { trend, points, deltaScore, deltaViolations };
  }

  /** Get raw history for an organization. */
  getHistory(organizationId: string): RiskTrendPoint[] {
    return this.history.get(organizationId) ?? [];
  }

  /** Clear history for an organization (useful for tests). */
  clear(organizationId: string): void {
    this.history.delete(organizationId);
  }
}
