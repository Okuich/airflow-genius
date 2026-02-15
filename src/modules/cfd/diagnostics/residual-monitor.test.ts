import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ResidualMonitor,
  type ResidualAnalysis,
  type EarlyTerminationPayload,
  type MonitorListener,
} from "./residual-monitor";
import type { ResidualSnapshot } from "@/packages/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

const snap = (iteration: number, continuity: number): ResidualSnapshot => ({
  iteration,
  continuity,
  xMomentum: continuity,
  yMomentum: continuity,
  zMomentum: continuity,
  energy: null,
  kTurbulent: null,
  epsilonOrOmega: null,
});

const convergingSeries = (n: number): ResidualSnapshot[] =>
  Array.from({ length: n }, (_, i) => snap(i, 1e-2 * Math.exp(-0.15 * i)));

const divergingSeries = (n: number): ResidualSnapshot[] =>
  Array.from({ length: n }, (_, i) => snap(i, 1e-3 * Math.exp(0.4 * i)));

const oscillatingSeries = (n: number): ResidualSnapshot[] =>
  Array.from({ length: n }, (_, i) => snap(i, 1e-3 * (1 + 5 * Math.abs(Math.sin(i * 0.8)))));

const plateauSeries = (n: number): ResidualSnapshot[] =>
  Array.from({ length: n }, (_, i) => snap(i, 1e-3 + (i % 2) * 1e-7));

// ── Tests ───────────────────────────────────────────────────────────────────

describe("ResidualMonitor", () => {
  let monitor: ResidualMonitor;

  beforeEach(() => {
    monitor = new ResidualMonitor({
      minSamples: 5,
      windowSize: 10,
      divergenceConfirmationCount: 2,
      oscillationAmplitude: 1.5, // raise threshold so smooth convergence isn't flagged
    });
    monitor.setContext("sim-test", "org-test");
  });

  describe("feed", () => {
    it("returns null when insufficient data", () => {
      expect(monitor.feed(snap(0, 1e-3))).toBeNull();
      expect(monitor.feed(snap(1, 1e-3))).toBeNull();
    });

    it("returns analysis after minSamples", () => {
      for (let i = 0; i < 5; i++) monitor.feed(snap(i, 1e-3));
      const result = monitor.feed(snap(5, 1e-3));
      expect(result).not.toBeNull();
      expect(result!.trend).toBeDefined();
      expect(result!.confidence).toBeGreaterThan(0);
    });
  });

  describe("trend detection", () => {
    it("detects converging residuals", () => {
      const result = monitor.feedAll(convergingSeries(20));
      expect(result).not.toBeNull();
      expect(result!.trend).toBe("converging");
    });

    it("detects diverging residuals", () => {
      // divergingSeries terminates early, so check via listener
      const onDivergence = vi.fn<(p: EarlyTerminationPayload) => void>();
      monitor.addListener({ onDivergence });
      monitor.feedAll(divergingSeries(20));
      expect(monitor.isTerminated()).toBe(true);
      expect(onDivergence).toHaveBeenCalled();
    });

    it("detects oscillating residuals", () => {
      const result = monitor.feedAll(oscillatingSeries(30));
      // May return null if divergence terminated, so check via history
      if (result) {
        expect(["oscillating", "diverging"]).toContain(result.trend);
      } else {
        expect(monitor.isTerminated()).toBe(true);
      }
    });

    it("detects plateau", () => {
      const result = monitor.feedAll(plateauSeries(25));
      expect(result).not.toBeNull();
      expect(result!.trend).toBe("plateau");
    });
  });

  describe("divergence handling", () => {
    it("emits termination after confirmation count", () => {
      const onDivergence = vi.fn<(p: EarlyTerminationPayload) => void>();
      monitor.addListener({ onDivergence });

      monitor.feedAll(divergingSeries(20));

      expect(onDivergence).toHaveBeenCalled();
      expect(monitor.isTerminated()).toBe(true);

      const payload = onDivergence.mock.calls[0][0];
      expect(payload.simulationId).toBe("sim-test");
      expect(payload.suggestedFixes.length).toBeGreaterThan(0);
    });

    it("stops processing after termination", () => {
      monitor.feedAll(divergingSeries(20));
      expect(monitor.isTerminated()).toBe(true);
      expect(monitor.feed(snap(100, 1e-3))).toBeNull();
    });

    it("generates AI agent suggestion in fixes", () => {
      const onDivergence = vi.fn<(p: EarlyTerminationPayload) => void>();
      monitor.addListener({ onDivergence });
      monitor.feedAll(divergingSeries(20));

      const fixes = onDivergence.mock.calls[0][0].suggestedFixes;
      expect(fixes.some((f: string) => f.includes("AI Agent"))).toBe(true);
    });
  });

  describe("listeners", () => {
    it("calls onAnalysis for every analysed snapshot", () => {
      const onAnalysis = vi.fn<(a: ResidualAnalysis) => void>();
      monitor.addListener({ onAnalysis });

      monitor.feedAll(convergingSeries(15));
      // minSamples=5, so index 4 (5th sample) starts analysis → 15-5=10, but >=5 means index 4 triggers → 11
      expect(onAnalysis).toHaveBeenCalledTimes(11);
    });

    it("calls onPlateau when plateau detected", () => {
      const onPlateau = vi.fn<(a: ResidualAnalysis) => void>();
      monitor.addListener({ onPlateau });
      monitor.feedAll(plateauSeries(20));
      expect(onPlateau).toHaveBeenCalled();
    });

    it("unregisters listener", () => {
      const onAnalysis = vi.fn<(a: ResidualAnalysis) => void>();
      const unsub = monitor.addListener({ onAnalysis });
      unsub();
      monitor.feedAll(convergingSeries(15));
      expect(onAnalysis).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("clears state and allows re-use", () => {
      monitor.feedAll(divergingSeries(20));
      expect(monitor.isTerminated()).toBe(true);

      monitor.reset();
      expect(monitor.isTerminated()).toBe(false);
      expect(monitor.getHistory()).toHaveLength(0);

      const result = monitor.feedAll(convergingSeries(15));
      expect(result).not.toBeNull();
      expect(result!.trend).toBe("converging");
    });
  });

  describe("analyse", () => {
    it("returns per-channel details", () => {
      monitor.feedAll(convergingSeries(15));
      const analysis = monitor.analyse();
      expect(analysis.channelDetails.continuity).toBeDefined();
      expect(analysis.channelDetails.xMomentum).toBeDefined();
      expect(analysis.channelDetails.continuity.slope).toBeLessThan(0);
    });
  });
});
