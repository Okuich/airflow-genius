// ─── Cleanroom Metrics API Client ───────────────────────────────────────────
// Typed client for the cleanroom-metrics edge function endpoints.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";

const FUNCTION_NAME = "cleanroom-metrics";

interface FetchParams {
  orgId: string;
  zone?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

interface FetchResponse {
  data: CleanroomSampleRow[];
  count: number;
  limit: number;
  offset: number;
}

interface IngestParams {
  orgId: string;
  samples: {
    zone_name?: string;
    timestamp?: string;
    air_change_rate: number;
    particle_retention: number;
    laminar_stability: number;
  }[];
}

interface IngestResponse {
  inserted: number;
  ids: string[];
}

interface SummaryParams {
  orgId: string;
  from?: string;
  to?: string;
}

interface ZoneSummary {
  zone: string;
  sampleCount: number;
  avgAirChangeRate: number;
  avgParticleRetention: number;
  avgLaminarStability: number;
  minAirChangeRate: number;
  maxAirChangeRate: number;
}

interface SummaryResponse {
  summary: ZoneSummary[];
  totalSamples: number;
}

export interface CleanroomSampleRow {
  id: string;
  organization_id: string;
  zone_name: string;
  timestamp: string;
  air_change_rate: number;
  particle_retention: number;
  laminar_stability: number;
  created_at: string;
}

async function invoke<T>(params: Record<string, string>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const query = new URLSearchParams(params).toString();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION_NAME}?${query}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

async function invokePost<T>(params: Record<string, string>, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const query = new URLSearchParams(params).toString();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION_NAME}?${query}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

export const cleanroomApi = {
  /** Fetch paginated cleanroom samples */
  async fetch(p: FetchParams): Promise<FetchResponse> {
    const params: Record<string, string> = { action: "fetch", org_id: p.orgId };
    if (p.zone) params.zone = p.zone;
    if (p.from) params.from = p.from;
    if (p.to) params.to = p.to;
    if (p.limit) params.limit = String(p.limit);
    if (p.offset) params.offset = String(p.offset);
    return invoke<FetchResponse>(params);
  },

  /** Get per-zone summary stats */
  async summary(p: SummaryParams): Promise<SummaryResponse> {
    const params: Record<string, string> = { action: "summary", org_id: p.orgId };
    if (p.from) params.from = p.from;
    if (p.to) params.to = p.to;
    return invoke<SummaryResponse>(params);
  },

  /** Ingest a batch of samples */
  async ingest(p: IngestParams): Promise<IngestResponse> {
    return invokePost<IngestResponse>(
      { action: "ingest", org_id: p.orgId },
      { samples: p.samples },
    );
  },

  /** Get CSV export URL (opens in browser) */
  exportUrl(p: { orgId: string; zone?: string; from?: string; to?: string }): string {
    const params = new URLSearchParams({ action: "export", org_id: p.orgId });
    if (p.zone) params.set("zone", p.zone);
    if (p.from) params.set("from", p.from);
    if (p.to) params.set("to", p.to);
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION_NAME}?${params}`;
  },
};
