// Re-export all solver/HPC types from the unified types package.
// Existing imports from "./types" continue to work.
export {
  JobStatus,
  SolverErrorCode,
  type HPCSubmitResponse,
  type HPCStatusResponse,
  type HPCResultsResponse,
  type ResidualSnapshot,
  type OutputFile,
  type PerformanceMetrics,
  type SolverError,
  type RetryConfig,
  type SolverServiceConfig,
  type SubmissionResult,
  type StatusResult,
  type ResultsResult,
} from "@/packages/types";
