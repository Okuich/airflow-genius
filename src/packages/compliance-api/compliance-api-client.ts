// ─── Compliance API Client ──────────────────────────────────────────────────
// Type-safe client for the compliance edge functions.
// ──────────────────────────────────────────────────────────────────────────

import type {
  EvaluateRequest,
  EvaluateResponse,
  ReportResponse,
  RiskScoreResponse,
  ComplianceApiError,
} from "./types";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const AUTH_HEADER = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: AUTH_HEADER,
      ...(init?.headers ?? {}),
    },
  });

  const body = await resp.json();

  if (!resp.ok) {
    const msg = (body as ComplianceApiError).error ?? `Error ${resp.status}`;
    throw new Error(msg);
  }

  return body as T;
}

export class ComplianceApiClient {
  /**
   * POST /compliance-evaluate
   * Evaluate metrics against compliance rules for a given domain.
   */
  async evaluate(params: EvaluateRequest): Promise<EvaluateResponse> {
    return request<EvaluateResponse>(`${BASE_URL}/compliance-evaluate`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * GET /compliance-report?id=:id
   * Retrieve a full compliance report by simulation result ID.
   */
  async getReport(id: string): Promise<ReportResponse> {
    return request<ReportResponse>(`${BASE_URL}/compliance-report?id=${encodeURIComponent(id)}`);
  }

  /**
   * GET /compliance-risk-score?simulationId=:id
   * Get a risk score summary for a simulation.
   */
  async getRiskScore(simulationId: string): Promise<RiskScoreResponse> {
    return request<RiskScoreResponse>(
      `${BASE_URL}/compliance-risk-score?simulationId=${encodeURIComponent(simulationId)}`
    );
  }
}

/** Singleton instance for convenience. */
export const complianceApi = new ComplianceApiClient();
