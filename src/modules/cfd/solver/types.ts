// ─── HPC API Response Types ─────────────────────────────────────────────────

export enum JobStatus {
  Queued = "queued",
  Meshing = "meshing",
  Solving = "solving",
  PostProcessing = "post_processing",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

export interface HPCSubmitResponse {
  jobId: string;
  status: JobStatus;
  submittedAt: string;
  estimatedStartTime: string;
  queuePosition: number;
}

export interface HPCStatusResponse {
  jobId: string;
  status: JobStatus;
  progress: number;
  currentIteration: number;
  maxIterations: number;
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
  lastResidual: ResidualSnapshot;
  workerNodeId: string;
}

export interface ResidualSnapshot {
  iteration: number;
  continuity: number;
  xMomentum: number;
  yMomentum: number;
  zMomentum: number;
  energy: number | null;
  kTurbulent: number | null;
  epsilonOrOmega: number | null;
}

export interface HPCResultsResponse {
  jobId: string;
  completedAt: string;
  totalIterations: number;
  converged: boolean;
  finalResiduals: ResidualSnapshot;
  outputFiles: OutputFile[];
  performanceMetrics: PerformanceMetrics;
}

export interface OutputFile {
  name: string;
  url: string;
  sizeBytes: number;
  format: "vtk" | "csv" | "png" | "json";
}

export interface PerformanceMetrics {
  totalCpuHours: number;
  peakMemoryGB: number;
  cellCount: number;
  wallClockSeconds: number;
  parallelEfficiency: number;
}

// ─── Solver Error Types ─────────────────────────────────────────────────────

export enum SolverErrorCode {
  DivergenceDetected = "DIVERGENCE_DETECTED",
  MeshQualityFailed = "MESH_QUALITY_FAILED",
  InsufficientMemory = "INSUFFICIENT_MEMORY",
  TimeoutExceeded = "TIMEOUT_EXCEEDED",
  InvalidBoundaryCondition = "INVALID_BOUNDARY_CONDITION",
  LicenseUnavailable = "LICENSE_UNAVAILABLE",
  HPCConnectionFailed = "HPC_CONNECTION_FAILED",
  UnknownError = "UNKNOWN_ERROR",
}

export interface SolverError {
  code: SolverErrorCode;
  message: string;
  jobId: string;
  iteration: number | null;
  timestamp: string;
  recoverable: boolean;
  suggestedAction: string;
}

// ─── Service Configuration ──────────────────────────────────────────────────

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface SolverServiceConfig {
  hpcBaseUrl: string;
  apiKey: string;
  timeoutMs: number;
  retry: RetryConfig;
  pollingIntervalMs: number;
  maxPollingDurationMs: number;
}

// ─── Orchestration Result ───────────────────────────────────────────────────

export interface SubmissionResult {
  success: boolean;
  jobId: string | null;
  error: SolverError | null;
  response: HPCSubmitResponse | null;
}

export interface StatusResult {
  success: boolean;
  status: HPCStatusResponse | null;
  error: SolverError | null;
}

export interface ResultsResult {
  success: boolean;
  results: HPCResultsResponse | null;
  error: SolverError | null;
}
