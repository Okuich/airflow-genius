// ─── Compliance API Client ──────────────────────────────────────────────────
// Type-safe client for the compliance edge functions.
// ──────────────────────────────────────────────────────────────────────────

import type {
  EvaluateRequest,
  EvaluateResponse,
  ReportResponse,
  RiskScoreResponse,
  ComplianceApiError,
  GenerateReportRequest,
  ComplianceReport,
  ListReportsParams,
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

  // ── Reports API ─────────────────────────────────────────────────────────

  /**
   * POST /compliance-reports → Generate and persist a new compliance report.
   */
  async generateReport(params: GenerateReportRequest): Promise<ComplianceReport> {
    return request<ComplianceReport>(`${BASE_URL}/compliance-reports`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * GET /compliance-reports?id=:id → Fetch a single report by ID.
   */
  async fetchReport(id: string): Promise<ComplianceReport> {
    return request<ComplianceReport>(
      `${BASE_URL}/compliance-reports?id=${encodeURIComponent(id)}`
    );
  }

  /**
   * GET /compliance-reports?organization_id=... → List reports with optional filters.
   */
  async listReports(params: ListReportsParams): Promise<ComplianceReport[]> {
    const qs = new URLSearchParams();
    qs.set("organization_id", params.organization_id);
    if (params.domain) qs.set("domain", params.domain);
    if (params.date_from) qs.set("date_from", params.date_from);
    if (params.date_to) qs.set("date_to", params.date_to);
    if (params.limit) qs.set("limit", String(params.limit));
    return request<ComplianceReport[]>(`${BASE_URL}/compliance-reports?${qs.toString()}`);
  }

  /**
   * DELETE /compliance-reports?id=:id → Delete a report.
   */
  async deleteReport(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(
      `${BASE_URL}/compliance-reports?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
  }

  /**
   * POST /compliance-export → Export report as PDF or CSV (returns raw blob).
   */
  async exportReport(
    data: GenerateReportRequest & { format: "pdf" | "csv" }
  ): Promise<Blob> {
    const resp = await fetch(`${BASE_URL}/compliance-export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: AUTH_HEADER,
      },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error(`Export failed: ${resp.status}`);
    return resp.blob();
  }
}

/** Singleton instance for convenience. */
export const complianceApi = new ComplianceApiClient();
