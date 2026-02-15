// Re-export results types from the unified types package.
// Keep interpreter logic here.
export {
  type FieldPoint,
  type VelocityFieldEntry,
  type PressureFieldEntry,
  type TemperatureFieldEntry,
  type EfficiencyMetrics,
  type EfficiencyRating,
  type HumanReadableSummary,
} from "@/packages/types";

// ── AI Text Generator Interface (pluggable) ───────────────────────────────

import type { HumanReadableSummary, VelocityFieldEntry, PressureFieldEntry, TemperatureFieldEntry, EfficiencyMetrics } from "@/packages/types";

export interface AISummaryGenerator {
  generateNarrative(summary: HumanReadableSummary, context: string): Promise<string>;
}

/** Placeholder that returns a deterministic template. */
export class PlaceholderAIGenerator implements AISummaryGenerator {
  async generateNarrative(summary: HumanReadableSummary, context: string): Promise<string> {
    return [
      `[AI Summary — ${context}]`,
      `Efficiency: ${summary.efficiencyRating}. Pressure loss: ${summary.pressureLossEstimate.toFixed(1)} Pa.`,
      `Detected ${summary.flowSeparationZones} separation zone(s).`,
      `Key findings: ${summary.keyFindings.join("; ")}.`,
      `Recommendations: ${summary.recommendations.join("; ")}.`,
    ].join(" ");
  }
}

// ── Deterministic helpers ───────────────────────────────────────────────────

export function computeFieldStats(values: number[]): {
  min: number; max: number; mean: number; stdDev: number;
} {
  const n = values.length;
  if (n === 0) return { min: 0, max: 0, mean: 0, stdDev: 0 };
  let min = Infinity, max = -Infinity, sum = 0;
  for (const v of values) { if (v < min) min = v; if (v > max) max = v; sum += v; }
  const mean = sum / n;
  let sqSum = 0;
  for (const v of values) sqSum += (v - mean) ** 2;
  return { min, max, mean, stdDev: Math.sqrt(sqSum / n) };
}

export function detectSeparationZones(velocityField: VelocityFieldEntry[]): number {
  const magnitudes = velocityField.map((v) => v.magnitude);
  const { mean } = computeFieldStats(magnitudes);
  const threshold = mean * 0.05;
  let zones = 0, inZone = false;
  for (const entry of velocityField) {
    const isLow = entry.magnitude < threshold;
    if (isLow && !inZone) { zones++; inZone = true; }
    else if (!isLow) { inZone = false; }
  }
  return zones;
}

export function computePressureLoss(
  pressureField: PressureFieldEntry[], metrics: EfficiencyMetrics
): number {
  return Math.abs(metrics.inletTotalPressure - metrics.outletTotalPressure);
}

export function rateEfficiency(metrics: EfficiencyMetrics): import("@/packages/types").EfficiencyRating {
  if (metrics.shaftPower === null || metrics.shaftPower <= 0) {
    const recoveryRatio = Math.abs(metrics.outletStaticPressure - metrics.inletStaticPressure) /
      Math.max(Math.abs(metrics.inletTotalPressure - metrics.inletStaticPressure), 1e-10);
    if (recoveryRatio > 0.85) return "Excellent";
    if (recoveryRatio > 0.65) return "Good";
    if (recoveryRatio > 0.45) return "Average";
    return "Poor";
  }
  const eff = (metrics.volumeFlowRate * Math.abs(metrics.totalPressureRiseOrDrop)) / metrics.shaftPower;
  if (eff > 0.85) return "Excellent";
  if (eff > 0.70) return "Good";
  if (eff > 0.50) return "Average";
  return "Poor";
}

// ── Interpreter ─────────────────────────────────────────────────────────────

export class CFDResultsInterpreter {
  private readonly aiGenerator: AISummaryGenerator;
  constructor(aiGenerator?: AISummaryGenerator) {
    this.aiGenerator = aiGenerator ?? new PlaceholderAIGenerator();
  }

  interpret(
    velocityField: VelocityFieldEntry[],
    pressureField: PressureFieldEntry[],
    temperatureField: TemperatureFieldEntry[],
    metrics: EfficiencyMetrics
  ): HumanReadableSummary {
    const velStats = computeFieldStats(velocityField.map((v) => v.magnitude));
    const presStats = computeFieldStats(pressureField.map((p) => p.staticPressure));
    const tempStats = temperatureField.length > 0
      ? computeFieldStats(temperatureField.map((t) => t.temperature)) : null;
    const pressureLoss = computePressureLoss(pressureField, metrics);
    const rating = rateEfficiency(metrics);
    const separationZones = detectSeparationZones(velocityField);

    const findings: string[] = [];
    findings.push(`Velocity range: ${velStats.min.toFixed(2)}–${velStats.max.toFixed(2)} m/s (mean ${velStats.mean.toFixed(2)} m/s)`);
    findings.push(`Static pressure range: ${presStats.min.toFixed(0)}–${presStats.max.toFixed(0)} Pa`);
    if (tempStats) {
      findings.push(`Temperature spread: ${(tempStats.max - tempStats.min).toFixed(1)} K (${tempStats.min.toFixed(1)}–${tempStats.max.toFixed(1)} K)`);
    }
    findings.push(`Total pressure loss: ${pressureLoss.toFixed(1)} Pa`);
    findings.push(`Overall efficiency rating: ${rating}`);
    if (separationZones > 0) findings.push(`Detected ${separationZones} flow separation zone${separationZones > 1 ? "s" : ""}`);
    if (metrics.shaftPower !== null && metrics.shaftPower > 0) {
      const eff = (metrics.volumeFlowRate * Math.abs(metrics.totalPressureRiseOrDrop)) / metrics.shaftPower;
      findings.push(`Computed total-to-total efficiency: ${(eff * 100).toFixed(1)}%`);
    }

    const recommendations: string[] = [];
    if (rating === "Poor") recommendations.push("Efficiency is below acceptable levels — review blade geometry, tip clearance, and volute design");
    if (separationZones > 2) recommendations.push("Multiple separation zones detected — consider redesigning diffuser/blade angles");
    else if (separationZones > 0) recommendations.push("Minor flow separation detected — investigate local blade incidence and wall contours");
    if (velStats.stdDev / velStats.mean > 0.6) recommendations.push("High velocity non-uniformity at outlet — add flow straighteners");
    if (pressureLoss > Math.abs(metrics.totalPressureRiseOrDrop) * 0.3) recommendations.push("Pressure losses exceed 30% of total pressure rise — check for recirculation");
    if (tempStats && tempStats.max - tempStats.min > 50) recommendations.push("Large temperature gradient (>50 K) — verify thermal boundary conditions");
    if (recommendations.length === 0) recommendations.push("Results appear nominal — no corrective actions required");

    return { keyFindings: findings, pressureLossEstimate: pressureLoss, efficiencyRating: rating, flowSeparationZones: separationZones, recommendations };
  }

  async generateAINarrative(summary: HumanReadableSummary, simulationName: string): Promise<string> {
    return this.aiGenerator.generateNarrative(summary, simulationName);
  }
}
