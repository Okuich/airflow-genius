// ─── Input / Output Types ───────────────────────────────────────────────────

export interface ResidualSample {
  iteration: number;
  continuity: number;
  xMomentum: number;
  yMomentum: number;
  zMomentum: number;
  energy: number | null;
  kTurbulent: number | null;
  epsilonOrOmega: number | null;
}

export interface MeshStats {
  cellCount: number;
  avgOrthogonality: number;
  maxSkewness: number;
  maxAspectRatio: number;
  minVolume: number;
  nonOrthogonalCellPercent: number;
  avgYPlus: number | null;
}

export interface RelaxationFactors {
  pressure: number;
  velocity: number;
  turbulence: number;
  energy: number | null;
}

export interface TurbulenceModelInput {
  type: "k-epsilon" | "k-epsilon-rng" | "k-omega-sst" | "spalart-allmaras";
  wallFunction: boolean;
}

export type ConvergenceIssueType = "Divergence" | "Stagnation" | "Oscillation";

export interface ConvergenceDiagnosticReport {
  issueType: ConvergenceIssueType;
  probableCause: string;
  confidenceScore: number;
  recommendedFixes: string[];
  details: {
    residualSlopes: Record<string, number>;
    oscillationAmplitudes: Record<string, number>;
    trendWindow: number;
    analysedIterations: number;
  };
}

// ─── Statistical helpers ────────────────────────────────────────────────────

/** Ordinary least-squares slope on log10(values) vs iteration index. */
function logSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const logVals = values.map((v) => Math.log10(Math.max(v, 1e-30)));
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

/** Peak-to-peak amplitude of the last `windowSize` values (log-scale). */
function oscillationAmplitude(values: number[], windowSize: number): number {
  const tail = values.slice(-windowSize);
  if (tail.length < 3) return 0;

  const logs = tail.map((v) => Math.log10(Math.max(v, 1e-30)));
  return Math.max(...logs) - Math.min(...logs);
}

/** Mean of the last N values. */
function tailMean(values: number[], n: number): number {
  const slice = values.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// ─── Thresholds ─────────────────────────────────────────────────────────────

const DIVERGENCE_SLOPE_THRESHOLD = 0.01;      // positive slope → growing
const STAGNATION_SLOPE_MAGNITUDE = 0.002;      // near-zero slope
const OSCILLATION_AMPLITUDE_THRESHOLD = 0.5;   // >0.5 decades swing
const HIGH_SKEWNESS_THRESHOLD = 0.85;
const LOW_ORTHOGONALITY_THRESHOLD = 0.5;
const HIGH_ASPECT_RATIO_THRESHOLD = 100;
const TREND_WINDOW_FRACTION = 0.25;            // use last 25 % of history
const MIN_TREND_WINDOW = 20;

// ─── Engine ─────────────────────────────────────────────────────────────────

export class ConvergenceDiagnosticEngine {
  analyse(
    residuals: ResidualSample[],
    meshStats: MeshStats,
    relaxation: RelaxationFactors,
    turbulence: TurbulenceModelInput
  ): ConvergenceDiagnosticReport {
    if (residuals.length < 4) {
      return {
        issueType: "Stagnation",
        probableCause: "Insufficient iteration data to perform trend analysis",
        confidenceScore: 0.1,
        recommendedFixes: ["Run more iterations before diagnosing"],
        details: { residualSlopes: {}, oscillationAmplitudes: {}, trendWindow: 0, analysedIterations: residuals.length },
      };
    }

    const window = Math.max(MIN_TREND_WINDOW, Math.round(residuals.length * TREND_WINDOW_FRACTION));
    const tail = residuals.slice(-window);

    // ── Extract channels ────────────────────────────────────────────────
    const channels: Record<string, number[]> = {
      continuity: tail.map((r) => r.continuity),
      xMomentum: tail.map((r) => r.xMomentum),
      yMomentum: tail.map((r) => r.yMomentum),
      zMomentum: tail.map((r) => r.zMomentum),
    };

    if (tail[0].energy !== null) channels.energy = tail.map((r) => r.energy ?? 0);
    if (tail[0].kTurbulent !== null) channels.kTurbulent = tail.map((r) => r.kTurbulent ?? 0);
    if (tail[0].epsilonOrOmega !== null) channels.epsilonOrOmega = tail.map((r) => r.epsilonOrOmega ?? 0);

    // ── Compute slopes & amplitudes ─────────────────────────────────────
    const slopes: Record<string, number> = {};
    const amplitudes: Record<string, number> = {};

    for (const [name, values] of Object.entries(channels)) {
      slopes[name] = logSlope(values);
      amplitudes[name] = oscillationAmplitude(values, Math.min(window, 50));
    }

    // ── Classify ────────────────────────────────────────────────────────
    const maxSlope = Math.max(...Object.values(slopes));
    const maxAmplitude = Math.max(...Object.values(amplitudes));
    const avgSlope = Object.values(slopes).reduce((a, b) => a + b, 0) / Object.values(slopes).length;

    let issueType: ConvergenceIssueType;
    let confidence: number;

    if (maxSlope > DIVERGENCE_SLOPE_THRESHOLD) {
      issueType = "Divergence";
      confidence = Math.min(0.5 + maxSlope * 10, 0.98);
    } else if (maxAmplitude > OSCILLATION_AMPLITUDE_THRESHOLD) {
      issueType = "Oscillation";
      confidence = Math.min(0.4 + maxAmplitude * 0.4, 0.95);
    } else if (Math.abs(avgSlope) < STAGNATION_SLOPE_MAGNITUDE) {
      issueType = "Stagnation";
      const currentLevel = tailMean(channels.continuity, 10);
      confidence = currentLevel > 1e-4 ? 0.85 : 0.5;
    } else {
      // Slow convergence — still classify as stagnation
      issueType = "Stagnation";
      confidence = 0.4;
    }

    // ── Root-cause analysis ─────────────────────────────────────────────
    const { cause, fixes } = this.diagnoseRootCause(issueType, slopes, amplitudes, meshStats, relaxation, turbulence);

    return {
      issueType,
      probableCause: cause,
      confidenceScore: Math.round(confidence * 100) / 100,
      recommendedFixes: fixes,
      details: {
        residualSlopes: Object.fromEntries(Object.entries(slopes).map(([k, v]) => [k, Math.round(v * 1e6) / 1e6])),
        oscillationAmplitudes: Object.fromEntries(Object.entries(amplitudes).map(([k, v]) => [k, Math.round(v * 1e4) / 1e4])),
        trendWindow: window,
        analysedIterations: residuals.length,
      },
    };
  }

  // ─── Root-cause heuristics ──────────────────────────────────────────────

  private diagnoseRootCause(
    issue: ConvergenceIssueType,
    slopes: Record<string, number>,
    amplitudes: Record<string, number>,
    mesh: MeshStats,
    relax: RelaxationFactors,
    turb: TurbulenceModelInput
  ): { cause: string; fixes: string[] } {
    const fixes: string[] = [];
    let cause = "";

    const hasBadMesh =
      mesh.maxSkewness > HIGH_SKEWNESS_THRESHOLD ||
      mesh.avgOrthogonality < LOW_ORTHOGONALITY_THRESHOLD ||
      mesh.maxAspectRatio > HIGH_ASPECT_RATIO_THRESHOLD;

    const highRelaxation = relax.pressure > 0.35 || relax.velocity > 0.8;

    switch (issue) {
      case "Divergence": {
        // Identify which channel diverges fastest
        const worstChannel = Object.entries(slopes).sort(([, a], [, b]) => b - a)[0];

        if (hasBadMesh) {
          cause = `Divergence driven by poor mesh quality (max skewness ${mesh.maxSkewness.toFixed(2)}, orthogonality ${mesh.avgOrthogonality.toFixed(2)}) amplifying errors in ${worstChannel[0]}`;
          fixes.push(`Improve mesh quality — target skewness < ${HIGH_SKEWNESS_THRESHOLD} and orthogonality > ${LOW_ORTHOGONALITY_THRESHOLD}`);
          fixes.push("Add local refinement in regions with high aspect-ratio cells");
        } else if (highRelaxation) {
          cause = `Divergence likely caused by aggressive relaxation factors (pressure: ${relax.pressure}, velocity: ${relax.velocity}) — fastest-growing residual: ${worstChannel[0]}`;
        } else {
          cause = `Divergence in ${worstChannel[0]} — possible boundary condition inconsistency or insufficiently resolved flow features`;
        }

        if (highRelaxation) {
          fixes.push(`Reduce pressure relaxation to ${Math.max(0.15, relax.pressure * 0.6).toFixed(2)}`);
          fixes.push(`Reduce velocity relaxation to ${Math.max(0.3, relax.velocity * 0.7).toFixed(2)}`);
        }

        fixes.push("Initialise from a converged lower-order solution (first-order upwind) before switching to second-order");
        fixes.push("Verify boundary conditions are physically consistent (positive pressure gradient from inlet to outlet)");
        break;
      }

      case "Oscillation": {
        const worstOsc = Object.entries(amplitudes).sort(([, a], [, b]) => b - a)[0];

        if (worstOsc[0] === "continuity" || worstOsc[0].includes("Momentum")) {
          cause = `Pressure-velocity coupling oscillation detected in ${worstOsc[0]} (amplitude: ${worstOsc[1].toFixed(2)} decades)`;
          fixes.push(`Reduce pressure relaxation to ${Math.max(0.1, relax.pressure * 0.5).toFixed(2)}`);
          fixes.push(`Reduce velocity relaxation to ${Math.max(0.2, relax.velocity * 0.5).toFixed(2)}`);
        } else {
          cause = `Turbulence equation oscillation in ${worstOsc[0]} — the ${turb.type} model may be poorly suited to this flow`;
          fixes.push(`Reduce turbulence relaxation to ${Math.max(0.3, relax.turbulence * 0.6).toFixed(2)}`);
          if (turb.type === "k-epsilon" || turb.type === "k-epsilon-rng") {
            fixes.push("Consider switching to k-ω SST for better separation and adverse pressure gradient handling");
          }
        }

        if (hasBadMesh) {
          fixes.push("Refine mesh in regions of high gradients to reduce numerical oscillation");
        }

        fixes.push("Enable gradient limiters if available");
        break;
      }

      case "Stagnation": {
        const currentLevel = slopes.continuity !== undefined ? Math.abs(slopes.continuity) : 0;

        if (hasBadMesh && currentLevel < STAGNATION_SLOPE_MAGNITUDE) {
          cause = `Residuals stagnated — mesh quality limiting further convergence (skewness ${mesh.maxSkewness.toFixed(2)}, non-orthogonal cells ${mesh.nonOrthogonalCellPercent.toFixed(1)}%)`;
          fixes.push("Improve mesh quality in problem regions");
          fixes.push("Increase non-orthogonal corrector loops (2-3)");
        } else if (!turb.wallFunction && mesh.avgYPlus !== null && mesh.avgYPlus > 5) {
          cause = `Residual stagnation — y+ values (avg ${mesh.avgYPlus.toFixed(1)}) too high for wall-resolved approach`;
          fixes.push("Refine near-wall mesh to achieve y+ < 1, or enable wall functions");
        } else {
          cause = "Residuals have plateaued — the current solver settings may have reached their accuracy limit for this mesh";
          fixes.push("Increase mesh resolution globally or in high-gradient regions");
        }

        fixes.push("Try slightly increasing relaxation factors to accelerate convergence");
        fixes.push("Switch to a coupled pressure-velocity solver if available");
        break;
      }
    }

    return { cause, fixes };
  }
}
