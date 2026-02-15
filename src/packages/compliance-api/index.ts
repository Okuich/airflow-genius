// ─── Compliance API Package ─────────────────────────────────────────────────
// Type-safe client for compliance edge functions.
// ──────────────────────────────────────────────────────────────────────────

export { ComplianceApiClient, complianceApi } from "./compliance-api-client";
export type {
  EvaluateRequest,
  EvaluateResponse,
  ReportResponse,
  RiskScoreResponse,
  ComplianceVerdict,
  ComplianceApiError,
} from "./types";
