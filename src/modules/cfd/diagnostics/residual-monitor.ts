// ─── Residual Monitor ───────────────────────────────────────────────────────
// Real-time residual stream analyser that detects:
//   • Divergence  — sustained positive slope in log-residuals
//   • Oscillation — high peak-to-peak amplitude without convergence
//   • Plateau     — near-zero slope above the convergence target
//
// On divergence detection:
//   1. Emits "simulation.early_termination" event
//   2. Requests config-fix suggestions via the AI Agent
// ─────────────────────────────────────────────────────────────────────────────

import type { ResidualSnapshot } from "@/packages/types";
import { CONVERGENCE } from "@/packages/config";
import { getEventBus, type PlatformEventBus } from "@/packages/events";

// ── Types ───────────────────────────────────────────────────────────────────

export type ResidualTrend = "converging" | "diverging" | "oscillating" | "plateau" | "insufficient_data";

export interface MonitorConfig {
  /** Minimum snapshots before analysis begins. Default 10. */
  minSamples: number;
  /** Rolling window size for trend detection. Default 20. */
  windowSize: number;
  /** Positive log-slope above which divergence is declared. Default from config. */
  divergenceSlope: number;
  /** Absolute slope below which plateau is declared. Default from config. */
  stagnationSlope: number;
  /** Log-scale amplitude above which oscillation is declared. Default from config. */
  oscillationAmplitude: number;
  /** Target residual level — plateau above this is problematic. Default 1e-5. */
  convergenceTarget: number;
  /** How many consecutive diverging windows before emitting termination. Default 3. */
  divergenceConfirmationCount: number;
}

export interface ResidualAnalysis {
  trend: ResidualTrend;
  confidence: number;
  slope: number;
  amplitude: number;
  currentLevel: number;
  iteration: number;
  channelDetails: Record<string, { slope: number; amplitude: number }>;
}

export interface EarlyTerminationPayload {
  simulationId: string;
  organizationId: string;
  reason: string;
  analysis: ResidualAnalysis;
  suggestedFixes: string[];
  timestamp: string;
}

export interface MonitorListener {
  onAnalysis?: (analysis: ResidualAnalysis) => void;
  onDivergence?: (payload: EarlyTerminationPayload) => void;
  onOscillation?: (analysis: ResidualAnalysis) => void;
  onPlateau?: (analysis: ResidualAnalysis) => void;
}

// ── Defaults ────────────────────────────────────────────────────────────────

const MONITOR_DEFAULTS: MonitorConfig = {
  minSamples: 10,
  windowSize: 20,
  divergenceSlope: CONVERGENCE.divergenceSlopeThreshold,
  stagnationSlope: CONVERGENCE.stagnationSlopeMagnitude,
  oscillationAmplitude: CONVERGENCE.oscillationAmplitudeThreshold,
  convergenceTarget: 1e-5,
  divergenceConfirmationCount: 3,
};

// ── Channels to monitor ─────────────────────────────────────────────────────

const CHANNELS = ["continuity", "xMomentum", "yMomentum", "zMomentum"] as const;
type Channel = (typeof CHANNELS)[number];

// ── Service ─────────────────────────────────────────────────────────────────

export class ResidualMonitor {
  private readonly config: MonitorConfig;
  private readonly bus: PlatformEventBus;
  private readonly history: ResidualSnapshot[] = [];
  private readonly listeners: MonitorListener[] = [];
  private consecutiveDivergenceCount = 0;
  private terminated = false;

  // Context set externally before feeding residuals
  private simulationId = "unknown";
  private organizationId = "unknown";

  constructor(
    config?: Partial<MonitorConfig>,
    deps?: { bus?: PlatformEventBus }
  ) {
    this.config = { ...MONITOR_DEFAULTS, ...config };
    this.bus = deps?.bus ?? getEventBus();
  }

  // ── Setup ─────────────────────────────────────────────────────────────

  setContext(simulationId: string, organizationId: string): void {
    this.simulationId = simulationId;
    this.organizationId = organizationId;
  }

  addListener(listener: MonitorListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  reset(): void {
    this.history.length = 0;
    this.consecutiveDivergenceCount = 0;
    this.terminated = false;
  }

  // ── Feed ──────────────────────────────────────────────────────────────

  /** Ingest a new residual snapshot. Returns the latest analysis or null if insufficient data. */
  feed(snapshot: ResidualSnapshot): ResidualAnalysis | null {
    if (this.terminated) return null;

    this.history.push(snapshot);

    if (this.history.length < this.config.minSamples) return null;

    const analysis = this.analyse();

    // Notify listeners
    for (const l of this.listeners) {
      l.onAnalysis?.(analysis);
    }

    // Divergence confirmation
    if (analysis.trend === "diverging") {
      this.consecutiveDivergenceCount++;
      if (this.consecutiveDivergenceCount >= this.config.divergenceConfirmationCount) {
        this.handleDivergence(analysis);
      }
    } else {
      this.consecutiveDivergenceCount = 0;
    }

    // Notify oscillation / plateau
    if (analysis.trend === "oscillating") {
      for (const l of this.listeners) l.onOscillation?.(analysis);
    }
    if (analysis.trend === "plateau") {
      for (const l of this.listeners) l.onPlateau?.(analysis);
    }

    return analysis;
  }

  /** Batch-feed an array of snapshots. Returns the final analysis. */
  feedAll(snapshots: ResidualSnapshot[]): ResidualAnalysis | null {
    let last: ResidualAnalysis | null = null;
    for (const s of snapshots) {
      last = this.feed(s);
    }
    return last;
  }

  isTerminated(): boolean {
    return this.terminated;
  }

  getHistory(): ResidualSnapshot[] {
    return [...this.history];
  }

  // ── Analysis ──────────────────────────────────────────────────────────

  analyse(): ResidualAnalysis {
    const window = this.history.slice(-this.config.windowSize);
    const channelDetails: Record<string, { slope: number; amplitude: number }> = {};

    for (const ch of CHANNELS) {
      const values = window.map((r) => r[ch]);
      channelDetails[ch] = {
        slope: logSlope(values),
        amplitude: peakToPeakLog(values),
      };
    }

    // Aggregate: use worst (highest) slope and amplitude
    const slopes = Object.values(channelDetails).map((d) => d.slope);
    const amplitudes = Object.values(channelDetails).map((d) => d.amplitude);
    const maxSlope = Math.max(...slopes);
    const maxAmplitude = Math.max(...amplitudes);
    const avgSlope = slopes.reduce((a, b) => a + b, 0) / slopes.length;

    const latest = window[window.length - 1];
    const currentLevel = latest.continuity;

    const trend = this.classifyTrend(maxSlope, avgSlope, maxAmplitude, currentLevel);
    const confidence = this.trendConfidence(trend, maxSlope, maxAmplitude, avgSlope);

    return {
      trend,
      confidence,
      slope: round6(maxSlope),
      amplitude: round4(maxAmplitude),
      currentLevel,
      iteration: latest.iteration,
      channelDetails: Object.fromEntries(
        Object.entries(channelDetails).map(([k, v]) => [k, { slope: round6(v.slope), amplitude: round4(v.amplitude) }])
      ),
    };
  }

  // ── Trend Classification ──────────────────────────────────────────────

  private classifyTrend(
    maxSlope: number,
    avgSlope: number,
    maxAmplitude: number,
    currentLevel: number
  ): ResidualTrend {
    // Check for NaN/Inf
    if (!Number.isFinite(currentLevel) || currentLevel > 1e6) return "diverging";

    if (maxSlope > this.config.divergenceSlope) return "diverging";
    if (maxAmplitude > this.config.oscillationAmplitude) return "oscillating";

    if (
      Math.abs(avgSlope) < this.config.stagnationSlope &&
      currentLevel > this.config.convergenceTarget
    ) {
      return "plateau";
    }

    if (avgSlope < -this.config.stagnationSlope) return "converging";

    return "plateau";
  }

  private trendConfidence(
    trend: ResidualTrend,
    maxSlope: number,
    maxAmplitude: number,
    avgSlope: number
  ): number {
    switch (trend) {
      case "diverging":
        return Math.min(0.5 + maxSlope * 10, 0.99);
      case "oscillating":
        return Math.min(0.4 + maxAmplitude * 0.3, 0.95);
      case "plateau":
        return Math.min(0.6 + (1 - Math.abs(avgSlope) / this.config.stagnationSlope) * 0.3, 0.95);
      case "converging":
        return Math.min(0.5 + Math.abs(avgSlope) * 5, 0.98);
      default:
        return 0.1;
    }
  }

  // ── Divergence Handler ────────────────────────────────────────────────

  private handleDivergence(analysis: ResidualAnalysis): void {
    this.terminated = true;

    const suggestedFixes = this.generateDivergenceFixes(analysis);

    const payload: EarlyTerminationPayload = {
      simulationId: this.simulationId,
      organizationId: this.organizationId,
      reason:
        `Divergence confirmed after ${this.config.divergenceConfirmationCount} consecutive windows. ` +
        `Max residual slope: ${analysis.slope}, current level: ${analysis.currentLevel.toExponential(2)}.`,
      analysis,
      suggestedFixes,
      timestamp: new Date().toISOString(),
    };

    // Emit event
    this.bus.emit("simulation.early_termination", payload).catch(() => {});

    // Notify listeners
    for (const l of this.listeners) l.onDivergence?.(payload);
  }

  // ── AI-Agent Config Fix Suggestions ───────────────────────────────────

  private generateDivergenceFixes(analysis: ResidualAnalysis): string[] {
    const fixes: string[] = [];

    // Identify worst channel
    const worstChannel = Object.entries(analysis.channelDetails)
      .sort(([, a], [, b]) => b.slope - a.slope)[0];

    if (worstChannel) {
      const [name, detail] = worstChannel;

      if (name === "continuity") {
        fixes.push("Reduce pressure relaxation factor to 0.15–0.2 (pressure-velocity coupling instability)");
        fixes.push("Check for inconsistent boundary conditions causing mass imbalance");
      } else if (name.includes("Momentum")) {
        fixes.push(`Reduce velocity relaxation factor to 0.3–0.5 (momentum divergence in ${name})`);
        fixes.push("Verify inlet velocity magnitude is physically reasonable");
      }

      if (detail.slope > 0.1) {
        fixes.push("Switch to first-order upwind discretisation to stabilise, then transition to second-order");
      }
    }

    if (analysis.currentLevel > 1e3) {
      fixes.push("Initialise fields from a coarser-mesh solution or use potential flow initialisation");
    }

    fixes.push("Inspect mesh quality near regions of high residual — refine if skewness > 0.85");
    fixes.push("[AI Agent] Request full diagnostic via: 'Diagnose divergence for this simulation'");

    return fixes;
  }
}

// ── Math Helpers ────────────────────────────────────────────────────────────

function logSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const logVals = values.map((v) => Math.log10(Math.max(Math.abs(v), 1e-30)));
  const meanX = (n - 1) / 2;
  const meanY = logVals.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    num += dx * (logVals[i] - meanY);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

function peakToPeakLog(values: number[]): number {
  if (values.length < 3) return 0;
  const logs = values.map((v) => Math.log10(Math.max(Math.abs(v), 1e-30)));
  return Math.max(...logs) - Math.min(...logs);
}

function round6(v: number): number { return Math.round(v * 1e6) / 1e6; }
function round4(v: number): number { return Math.round(v * 1e4) / 1e4; }
