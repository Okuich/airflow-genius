import { SimulationConfigSchema } from "../domain/schemas";
import type { SimulationConfig } from "../domain/models";
import {
  type SolverServiceConfig,
  type HPCSubmitResponse,
  type HPCStatusResponse,
  type HPCResultsResponse,
  type SolverError,
  type SubmissionResult,
  type StatusResult,
  type ResultsResult,
  JobStatus,
  SolverErrorCode,
} from "./types";
import { StructuredLogger } from "./logger";

const DEFAULT_CONFIG: SolverServiceConfig = {
  hpcBaseUrl: "/hpc",
  apiKey: "",
  timeoutMs: 30_000,
  retry: {
    maxRetries: 3,
    baseDelayMs: 1_000,
    maxDelayMs: 30_000,
    backoffMultiplier: 2,
  },
  pollingIntervalMs: 5_000,
  maxPollingDurationMs: 7_200_000, // 2 hours
};

export class CFDSolverService {
  private readonly config: SolverServiceConfig;
  private readonly logger: StructuredLogger;

  constructor(config: Partial<SolverServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config, retry: { ...DEFAULT_CONFIG.retry, ...config.retry } };
    this.logger = new StructuredLogger("CFDSolverService");
  }

  // ─── Submit Simulation ──────────────────────────────────────────────────

  async submitSimulation(simulationConfig: SimulationConfig): Promise<SubmissionResult> {
    this.logger.info("Validating simulation config", { simulationId: simulationConfig.id });

    const validation = SimulationConfigSchema.safeParse(simulationConfig);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      this.logger.error("Config validation failed", { simulationId: simulationConfig.id, errors: errorMsg });
      return {
        success: false,
        jobId: null,
        error: this.buildSolverError(SolverErrorCode.InvalidBoundaryCondition, `Validation failed: ${errorMsg}`, "", null, true, "Fix the configuration errors and resubmit"),
        response: null,
      };
    }

    this.logger.info("Submitting simulation to HPC cluster", { simulationId: simulationConfig.id, flowType: simulationConfig.flowType });

    try {
      const response = await this.fetchWithRetry<HPCSubmitResponse>(`${this.config.hpcBaseUrl}/run`, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(simulationConfig),
      });

      this.logger.info("Simulation submitted successfully", { jobId: response.jobId, queuePosition: response.queuePosition });

      return { success: true, jobId: response.jobId, error: null, response };
    } catch (err) {
      const solverError = this.handleSolverError(err, "submit", "");
      return { success: false, jobId: null, error: solverError, response: null };
    }
  }

  // ─── Check Status ───────────────────────────────────────────────────────

  async checkStatus(jobId: string): Promise<StatusResult> {
    this.logger.debug("Checking job status", { jobId });

    try {
      const response = await this.fetchWithRetry<HPCStatusResponse>(`${this.config.hpcBaseUrl}/status/${jobId}`, {
        method: "GET",
        headers: this.buildHeaders(),
      });

      this.logger.info("Status retrieved", {
        jobId,
        status: response.status,
        progress: response.progress,
        iteration: response.currentIteration,
      });

      return { success: true, status: response, error: null };
    } catch (err) {
      const solverError = this.handleSolverError(err, "checkStatus", jobId);
      return { success: false, status: null, error: solverError };
    }
  }

  // ─── Fetch Results ──────────────────────────────────────────────────────

  async fetchResults(jobId: string): Promise<ResultsResult> {
    this.logger.info("Fetching simulation results", { jobId });

    try {
      const response = await this.fetchWithRetry<HPCResultsResponse>(`${this.config.hpcBaseUrl}/results/${jobId}`, {
        method: "GET",
        headers: this.buildHeaders(),
      });

      this.logger.info("Results retrieved", {
        jobId,
        converged: response.converged,
        totalIterations: response.totalIterations,
        cpuHours: response.performanceMetrics.totalCpuHours,
        outputFileCount: response.outputFiles.length,
      });

      return { success: true, results: response, error: null };
    } catch (err) {
      const solverError = this.handleSolverError(err, "fetchResults", jobId);
      return { success: false, results: null, error: solverError };
    }
  }

  // ─── Poll Until Complete ────────────────────────────────────────────────

  async pollUntilComplete(
    jobId: string,
    onStatusUpdate?: (status: HPCStatusResponse) => void
  ): Promise<ResultsResult> {
    this.logger.info("Starting status polling", { jobId, intervalMs: this.config.pollingIntervalMs });

    const startTime = Date.now();
    const terminalStatuses = new Set<JobStatus>([JobStatus.Completed, JobStatus.Failed, JobStatus.Cancelled]);

    while (Date.now() - startTime < this.config.maxPollingDurationMs) {
      const statusResult = await this.checkStatus(jobId);

      if (!statusResult.success || !statusResult.status) {
        this.logger.warn("Status poll failed, retrying", { jobId, error: statusResult.error?.message });
        await this.delay(this.config.pollingIntervalMs);
        continue;
      }

      onStatusUpdate?.(statusResult.status);

      if (statusResult.status.status === JobStatus.Failed) {
        return {
          success: false,
          results: null,
          error: this.buildSolverError(
            SolverErrorCode.DivergenceDetected,
            "Solver failed during computation",
            jobId,
            statusResult.status.currentIteration,
            false,
            "Review mesh quality and boundary conditions, then resubmit"
          ),
        };
      }

      if (statusResult.status.status === JobStatus.Cancelled) {
        return {
          success: false,
          results: null,
          error: this.buildSolverError(SolverErrorCode.UnknownError, "Job was cancelled", jobId, statusResult.status.currentIteration, false, "Resubmit the simulation"),
        };
      }

      if (statusResult.status.status === JobStatus.Completed) {
        return this.fetchResults(jobId);
      }

      await this.delay(this.config.pollingIntervalMs);
    }

    return {
      success: false,
      results: null,
      error: this.buildSolverError(SolverErrorCode.TimeoutExceeded, `Polling exceeded max duration of ${this.config.maxPollingDurationMs}ms`, jobId, null, true, "Increase maxPollingDurationMs or check HPC cluster health"),
    };
  }

  // ─── Error Handler ──────────────────────────────────────────────────────

  handleSolverError(err: unknown, operation: string, jobId: string): SolverError {
    const message = err instanceof Error ? err.message : "Unknown error occurred";
    const isNetworkError = message.includes("fetch") || message.includes("network") || message.includes("ECONNREFUSED");

    const code = isNetworkError ? SolverErrorCode.HPCConnectionFailed : SolverErrorCode.UnknownError;
    const recoverable = isNetworkError;
    const suggestedAction = isNetworkError
      ? "Check HPC cluster connectivity and retry"
      : "Review solver logs and contact support if issue persists";

    const solverError = this.buildSolverError(code, `${operation} failed: ${message}`, jobId, null, recoverable, suggestedAction);

    this.logger.error("Solver error", {
      code: solverError.code,
      operation,
      jobId,
      message: solverError.message,
      recoverable: solverError.recoverable,
    });

    return solverError;
  }

  // ─── Retry with Exponential Backoff ─────────────────────────────────────

  private async fetchWithRetry<T>(url: string, init: RequestInit): Promise<T> {
    const { maxRetries, baseDelayMs, maxDelayMs, backoffMultiplier } = this.config.retry;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const response = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`HTTP ${response.status}: ${body}`);
        }

        return (await response.json()) as T;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxRetries) {
          const delayMs = Math.min(baseDelayMs * Math.pow(backoffMultiplier, attempt), maxDelayMs);
          const jitter = delayMs * (0.5 + Math.random() * 0.5);
          this.logger.warn("Request failed, retrying", { attempt: attempt + 1, maxRetries, delayMs: Math.round(jitter), url, error: lastError.message });
          await this.delay(jitter);
        }
      }
    }

    throw lastError ?? new Error("All retry attempts exhausted");
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  private buildSolverError(
    code: SolverErrorCode,
    message: string,
    jobId: string,
    iteration: number | null,
    recoverable: boolean,
    suggestedAction: string
  ): SolverError {
    return { code, message, jobId, iteration, timestamp: new Date().toISOString(), recoverable, suggestedAction };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
