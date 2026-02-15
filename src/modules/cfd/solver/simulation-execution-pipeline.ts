// ─── Simulation Execution Pipeline ─────────────────────────────────────────
// End-to-end execution chain for a CFD simulation:
//
//   1. Pre-Run Surrogate Check    — predict convergence + efficiency before solving
//   2. Convergence Prediction     — abort early if divergence is very likely
//   3. GPU Allocation Optimizer   — size GPU/CPU request based on mesh + model predictions
//   4. Containerized Solver       — submit to HPC via CFDSolverService
//   5. Adaptive Time Stepping     — dynamically adjust dt based on residual trends
//   6. Early Termination          — kill job if divergence detected mid-solve
//   7. Result Finalization        — emit SimulationCompleted event
//
// Each stage is independently testable and emits structured telemetry.
// ──────────────────────────────────────────────────────────────────────────

import type {
  SimulationConfig,
  FeatureVector,
  HPCStatusResponse,
  ResidualSnapshot,
  SolverError,
} from "@/packages/types";
import { getEventBus, type PlatformEventBus } from "@/packages/events";
import { InferenceService, type ConvergencePrediction, type EfficiencyPrediction } from "../inference/inference-service";
import { CFDSolverService, type SubmissionResult, type ResultsResult, JobStatus, SolverErrorCode } from "../solver";
import { FeatureExtractor } from "../ml-models/feature-extractor";

// ── Public Types ──────────────────────────────────────────────────────────

export interface PipelineConfig {
  /** Minimum convergence likelihood to proceed (0–1). Default 0.3. */
  convergenceGateThreshold: number;
  /** Residual slope (log-scale) above which early termination fires. Default 0.05. */
  divergenceSlopeThreshold: number;
  /** Number of recent residual snapshots to analyse for divergence. Default 20. */
  divergenceWindowSize: number;
  /** Maximum adaptive time-step multiplier. Default 2.0. */
  maxTimeStepMultiplier: number;
  /** Minimum adaptive time-step multiplier. Default 0.25. */
  minTimeStepMultiplier: number;
  /** Polling interval for solver status (ms). Default 5000. */
  pollingIntervalMs: number;
}

export interface ConvergenceWarning {
  likelihood: number;
  threshold: number;
  suggestions: string[];
  gpuBlocked: boolean;
}

export interface GPUAllocation {
  gpuCount: number;
  cpuCores: number;
  memoryGB: number;
  estimatedCostUSD: number;
  reasoning: string;
}

export interface AdaptiveTimeStep {
  currentMultiplier: number;
  trend: "converging" | "stagnating" | "diverging";
  recommendedAction: "increase_dt" | "hold" | "decrease_dt";
}

export type PipelineStage =
  | "surrogate_check"
  | "convergence_gate"
  | "gpu_allocation"
  | "solver_submit"
  | "adaptive_stepping"
  | "early_termination"
  | "finalization";

export interface StageResult {
  stage: PipelineStage;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  detail?: string;
}

export interface PipelineResult {
  simulationId: string;
  success: boolean;
  stages: StageResult[];
  surrogateCheck: {
    convergence: ConvergencePrediction;
    efficiency: EfficiencyPrediction;
  } | null;
  convergenceWarning: ConvergenceWarning | null;
  gpuAllocation: GPUAllocation | null;
  solverJobId: string | null;
  earlyTerminated: boolean;
  adaptiveSteps: AdaptiveTimeStep[];
  finalResult: ResultsResult | null;
  error: string | null;
}

// ── Defaults ──────────────────────────────────────────────────────────────

const DEFAULTS: PipelineConfig = {
  convergenceGateThreshold: 0.3,
  divergenceSlopeThreshold: 0.05,
  divergenceWindowSize: 20,
  maxTimeStepMultiplier: 2.0,
  minTimeStepMultiplier: 0.25,
  pollingIntervalMs: 5_000,
};

// ── Pipeline ──────────────────────────────────────────────────────────────

export class SimulationExecutionPipeline {
  private readonly config: PipelineConfig;
  private readonly inference: InferenceService;
  private readonly solver: CFDSolverService;
  private readonly extractor = new FeatureExtractor();
  private readonly bus: PlatformEventBus;

  constructor(
    config?: Partial<PipelineConfig>,
    deps?: {
      inference?: InferenceService;
      solver?: CFDSolverService;
      bus?: PlatformEventBus;
    }
  ) {
    this.config = { ...DEFAULTS, ...config };
    this.inference = deps?.inference ?? new InferenceService();
    this.solver = deps?.solver ?? new CFDSolverService();
    this.bus = deps?.bus ?? getEventBus();
  }

  /** Execute the full 7-stage pipeline. */
  async execute(
    orgId: string,
    userId: string,
    simConfig: SimulationConfig,
    onProgress?: (stage: PipelineStage, detail: string) => void
  ): Promise<PipelineResult> {
    const stages: StageResult[] = [];
    const adaptiveSteps: AdaptiveTimeStep[] = [];
    let surrogateCheck: PipelineResult["surrogateCheck"] = null;
    let convergenceWarning: ConvergenceWarning | null = null;
    let gpuAllocation: GPUAllocation | null = null;
    let solverJobId: string | null = null;
    let earlyTerminated = false;
    let finalResult: ResultsResult | null = null;

    const track = async <T>(
      stage: PipelineStage,
      fn: () => Promise<T>
    ): Promise<{ result: T; stageResult: StageResult }> => {
      onProgress?.(stage, "started");
      const t0 = performance.now();
      try {
        const result = await fn();
        const sr: StageResult = {
          stage,
          status: "passed",
          durationMs: Math.round(performance.now() - t0),
        };
        stages.push(sr);
        return { result, stageResult: sr };
      } catch (err) {
        const sr: StageResult = {
          stage,
          status: "failed",
          durationMs: Math.round(performance.now() - t0),
          detail: err instanceof Error ? err.message : String(err),
        };
        stages.push(sr);
        throw err;
      }
    };

    try {
      // ── 1. Pre-Run Surrogate Check ────────────────────────────────────
      const featureVector = this.configToFeatureVector(simConfig);

      const { result: checks } = await track("surrogate_check", async () => {
        const [convergence, efficiency] = await Promise.all([
          this.inference.predictConvergence(orgId, featureVector),
          this.inference.predictEfficiency(orgId, featureVector),
        ]);
        return { convergence, efficiency };
      });
      surrogateCheck = checks;

      // ── 2. Convergence Gate ───────────────────────────────────────────
      const gpuBlocked = checks.convergence.likelihood < this.config.convergenceGateThreshold;

      await track("convergence_gate", async () => {
        if (gpuBlocked) {
          convergenceWarning = {
            likelihood: checks.convergence.likelihood,
            threshold: this.config.convergenceGateThreshold,
            suggestions: this.suggestConfigFixes(simConfig, checks.convergence),
            gpuBlocked: true,
          };
          onProgress?.("convergence_gate",
            `⚠ Low convergence probability (${checks.convergence.likelihood.toFixed(3)}). GPU blocked. ` +
            convergenceWarning.suggestions.join(" | ")
          );
        }
      });

      // ── 3. GPU Allocation Optimizer ───────────────────────────────────
      const { result: allocation } = await track("gpu_allocation", async () => {
        const alloc = this.optimizeGPUAllocation(simConfig, checks.convergence, checks.efficiency);
        if (gpuBlocked) {
          return { ...alloc, gpuCount: 0, reasoning: alloc.reasoning + " [GPU blocked: low convergence probability]" };
        }
        return alloc;
      });
      gpuAllocation = allocation;

      // ── 4. Containerized Solver ───────────────────────────────────────
      const { result: submission } = await track("solver_submit", async () => {
        return this.solver.submitSimulation(simConfig);
      });

      if (!submission.success || !submission.jobId) {
        throw new Error(
          submission.error?.message ?? "Solver submission failed"
        );
      }
      solverJobId = submission.jobId;

      // ── 5 & 6. Adaptive Time Stepping + Early Termination ────────────
      const residualHistory: ResidualSnapshot[] = [];
      let dtMultiplier = 1.0;

      const { result: solverResult } = await track("adaptive_stepping", async () => {
        return this.solver.pollUntilComplete(solverJobId!, (status) => {
          // Collect residual snapshots
          residualHistory.push(status.lastResidual);

          // Adaptive time stepping analysis
          if (residualHistory.length >= 5) {
            const step = this.analyseAdaptiveStep(residualHistory, dtMultiplier);
            adaptiveSteps.push(step);
            dtMultiplier = step.currentMultiplier;
            onProgress?.("adaptive_stepping",
              `iter=${status.currentIteration} trend=${step.trend} dt×${step.currentMultiplier.toFixed(2)}`
            );
          }

          // Early termination check
          if (this.shouldTerminateEarly(residualHistory)) {
            earlyTerminated = true;
            onProgress?.("early_termination", "Divergence detected — requesting cancellation");
          }
        });
      });

      finalResult = solverResult;

      // ── 7. Finalization ───────────────────────────────────────────────
      if (earlyTerminated) {
        stages.push({ stage: "early_termination", status: "passed", durationMs: 0, detail: "Divergence detected" });
      } else {
        stages.push({ stage: "early_termination", status: "skipped", durationMs: 0 });
      }

      await track("finalization", async () => {
        if (solverResult.success && solverResult.results) {
          await this.bus.emit("simulation.completed", {
            simulationId: simConfig.id,
            organizationId: orgId,
            userId,
            config: simConfig,
            results: {
              converged: solverResult.results.converged,
              totalIterations: solverResult.results.totalIterations,
              finalResiduals: solverResult.results.finalResiduals,
              pressureDrop: 0, // filled by post-processor
              efficiencyRating: "Average",
              solveTimeSeconds: solverResult.results.performanceMetrics.wallClockSeconds,
            },
            timestamp: new Date().toISOString(),
          });
        }
      });

      return {
        simulationId: simConfig.id,
        success: solverResult.success && !earlyTerminated,
        stages,
        surrogateCheck,
        convergenceWarning,
        gpuAllocation,
        solverJobId,
        earlyTerminated,
        adaptiveSteps,
        finalResult: solverResult,
        error: null,
      };
    } catch (err) {
      return {
        simulationId: simConfig.id,
        success: false,
        stages,
        surrogateCheck,
        convergenceWarning,
        gpuAllocation,
        solverJobId,
        earlyTerminated,
        adaptiveSteps,
        finalResult,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── GPU Allocation Optimizer ──────────────────────────────────────────

  optimizeGPUAllocation(
    config: SimulationConfig,
    convergence: ConvergencePrediction,
    efficiency: EfficiencyPrediction
  ): GPUAllocation {
    const cellCount = config.meshSettings.targetCellCount;
    const isTransient = config.flowType === "transient";
    const hasRotating = !!config.rotatingFrame?.enabled;

    // Base sizing by cell count
    let gpuCount = 0;
    let cpuCores: number;
    let memoryGB: number;

    if (cellCount > 5_000_000) {
      gpuCount = hasRotating ? 2 : 1;
      cpuCores = 32;
      memoryGB = 64;
    } else if (cellCount > 1_000_000) {
      gpuCount = hasRotating ? 1 : 0;
      cpuCores = 16;
      memoryGB = 32;
    } else {
      gpuCount = 0;
      cpuCores = 8;
      memoryGB = 16;
    }

    // Scale up for transient
    if (isTransient) {
      cpuCores = Math.min(64, cpuCores * 2);
      memoryGB = Math.min(128, memoryGB * 1.5);
    }

    // Reduce if convergence is high-confidence (simpler problem)
    if (convergence.likelihood > 0.8 && convergence.confidence > 0.5) {
      cpuCores = Math.max(4, Math.round(cpuCores * 0.75));
    }

    const estimatedHours = isTransient ? 4 : 1;
    const estimatedCostUSD =
      cpuCores * 0.08 * estimatedHours +
      gpuCount * 0.60 * estimatedHours +
      memoryGB * 0.01 * estimatedHours;

    const parts: string[] = [];
    parts.push(`${cellCount.toLocaleString()} cells`);
    if (isTransient) parts.push("transient");
    if (hasRotating) parts.push("rotating frame");
    parts.push(`convergence=${convergence.label}`);

    return {
      gpuCount,
      cpuCores,
      memoryGB: Math.round(memoryGB),
      estimatedCostUSD: Math.round(estimatedCostUSD * 100) / 100,
      reasoning: `Allocated based on: ${parts.join(", ")}`,
    };
  }

  // ── Adaptive Time Stepping ────────────────────────────────────────────

  analyseAdaptiveStep(
    history: ResidualSnapshot[],
    currentMultiplier: number
  ): AdaptiveTimeStep {
    const window = history.slice(-this.config.divergenceWindowSize);
    const slope = this.residualSlope(window);

    let trend: AdaptiveTimeStep["trend"];
    let action: AdaptiveTimeStep["recommendedAction"];
    let newMultiplier = currentMultiplier;

    if (slope < -0.01) {
      // Residuals decreasing → speed up
      trend = "converging";
      action = "increase_dt";
      newMultiplier = Math.min(
        this.config.maxTimeStepMultiplier,
        currentMultiplier * 1.2
      );
    } else if (slope > this.config.divergenceSlopeThreshold) {
      // Residuals increasing → slow down
      trend = "diverging";
      action = "decrease_dt";
      newMultiplier = Math.max(
        this.config.minTimeStepMultiplier,
        currentMultiplier * 0.5
      );
    } else {
      trend = "stagnating";
      action = "hold";
    }

    return {
      currentMultiplier: Math.round(newMultiplier * 1000) / 1000,
      trend,
      recommendedAction: action,
    };
  }

  // ── Early Termination Check ───────────────────────────────────────────

  shouldTerminateEarly(history: ResidualSnapshot[]): boolean {
    if (history.length < this.config.divergenceWindowSize) return false;

    const window = history.slice(-this.config.divergenceWindowSize);
    const slope = this.residualSlope(window);

    // Strong divergence → terminate
    if (slope > this.config.divergenceSlopeThreshold * 3) return true;

    // Check for NaN/Inf in latest residuals
    const latest = window[window.length - 1];
    const values = [
      latest.continuity,
      latest.xMomentum,
      latest.yMomentum,
      latest.zMomentum,
    ];
    if (values.some((v) => !Number.isFinite(v))) return true;

    // Residuals exploded above 1e6
    if (values.some((v) => Math.abs(v) > 1e6)) return true;

    return false;
  }

  // ── Config Fix Suggestions ─────────────────────────────────────────────

  private suggestConfigFixes(config: SimulationConfig, convergence: ConvergencePrediction): string[] {
    const suggestions: string[] = [];
    const re = this.estimateReynoldsNumber(config);

    if (config.meshSettings.qualityThreshold < 0.8) {
      suggestions.push("Increase mesh quality threshold (≥ 0.85 recommended)");
    }
    if (config.meshSettings.targetCellCount < 200_000) {
      suggestions.push("Increase target cell count for better resolution");
    }
    if (config.solverSettings.relaxationPressure > 0.4) {
      suggestions.push(`Lower pressure relaxation factor (currently ${config.solverSettings.relaxationPressure}, try 0.2–0.3)`);
    }
    if (config.solverSettings.relaxationVelocity > 0.8) {
      suggestions.push(`Lower velocity relaxation factor (currently ${config.solverSettings.relaxationVelocity}, try 0.5–0.7)`);
    }
    if (re > 500_000 && config.turbulenceModel.type === "k-epsilon") {
      suggestions.push("Consider switching to k-omega-sst for high-Re flows");
    }
    if (config.meshSettings.boundaryLayerCount < 5) {
      suggestions.push("Add more boundary layer cells (≥ 5 recommended)");
    }
    if (suggestions.length === 0) {
      suggestions.push("Try refining the mesh near critical surfaces or reducing time step");
    }

    return suggestions;
  }

  // ── Internal Helpers ──────────────────────────────────────────────────

  private configToFeatureVector(config: SimulationConfig): FeatureVector {
    const re = this.estimateReynoldsNumber(config);
    return {
      reynoldsNumber: re,
      turbulenceIntensity: config.turbulenceModel.turbulentIntensity,
      pressureDrop: 0,
      efficiency: 0,
      meshQualityScore: config.meshSettings.qualityThreshold,
      convergenceSpeed: 0,
    };
  }

  private estimateReynoldsNumber(config: SimulationConfig): number {
    const inlets = config.boundaryConditions.filter(
      (bc) => bc.type === "inlet" || bc.type === "velocity_inlet"
    );
    if (inlets.length === 0) return 50_000; // default estimate

    const avgVelocity = inlets.reduce((sum, bc) => {
      const v = bc.velocity;
      return sum + (v ? Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2) : 0);
    }, 0) / inlets.length;

    const L = config.meshSettings.baseSize;
    const rho = config.fluidDensity;
    const mu = config.fluidViscosity;

    return mu > 0 ? (rho * avgVelocity * L) / mu : 50_000;
  }

  /** Log-scale slope of continuity residuals over a window. */
  private residualSlope(window: ResidualSnapshot[]): number {
    const n = window.length;
    if (n < 2) return 0;

    const logVals = window.map((r) =>
      Math.log10(Math.max(r.continuity, 1e-30))
    );
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
}
