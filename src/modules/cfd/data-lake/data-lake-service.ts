// ─── Data Lake Service ─────────────────────────────────────────────────────
// Persists structured simulation results + raw output references.
// Acts as the canonical store for all completed simulation data.
// ──────────────────────────────────────────────────────────────────────────

import type {
  SimulationConfig,
  SimulationResults,
  MeshStats,
  ResidualData,
  EfficiencyRating,
} from "@/packages/types";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export interface DataLakeEntry {
  id: string;
  simulationId: string | null;
  organizationId: string;
  userId: string;
  config: SimulationConfig;
  meshStats: MeshStats;
  residuals: ResidualData[];
  pressureDrop: number;
  efficiencyRating: EfficiencyRating;
  converged: boolean;
  totalIterations: number;
  solveTimeSeconds: number;
  rawOutputUrls: string[];
  createdAt: string;
}

export class DataLakeService {
  /** Persist a completed simulation's results into the data lake. */
  async ingest(
    orgId: string,
    userId: string,
    simulationId: string | null,
    results: SimulationResults,
    rawOutputUrls: string[] = []
  ): Promise<string> {
    const { data, error } = await supabase
      .from("simulation_results")
      .insert([{
        organization_id: orgId,
        user_id: userId,
        simulation_id: simulationId,
        config: JSON.parse(JSON.stringify(results.config)) as Json,
        mesh_stats: JSON.parse(JSON.stringify(results.meshStats)) as Json,
        residuals: JSON.parse(JSON.stringify(results.residuals)) as Json,
        pressure_drop: results.pressureDrop,
        efficiency_rating: results.efficiencyRating,
        converged: results.converged,
        total_iterations: results.totalIterations,
        solve_time_seconds: results.solveTimeSeconds,
        raw_output_urls: rawOutputUrls as unknown as Json,
      }])
      .select("id")
      .single();

    if (error) throw new Error(`Data lake ingest failed: ${error.message}`);
    return data.id;
  }

  /** Query results for an organization, optionally filtered. */
  async query(
    orgId: string,
    options?: {
      simulationId?: string;
      convergedOnly?: boolean;
      limit?: number;
    }
  ): Promise<DataLakeEntry[]> {
    let q = supabase
      .from("simulation_results")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.simulationId) q = q.eq("simulation_id", options.simulationId);
    if (options?.convergedOnly) q = q.eq("converged", true);
    if (options?.limit) q = q.limit(options.limit);

    const { data, error } = await q;
    if (error) throw new Error(`Data lake query failed: ${error.message}`);
    return (data ?? []).map(this.rowToEntry);
  }

  /** Get a single result by ID. */
  async getById(id: string): Promise<DataLakeEntry | null> {
    const { data, error } = await supabase
      .from("simulation_results")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Data lake get failed: ${error.message}`);
    return data ? this.rowToEntry(data) : null;
  }

  /** Count results for an org. */
  async count(orgId: string): Promise<number> {
    const { count, error } = await supabase
      .from("simulation_results")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId);

    if (error) return 0;
    return count ?? 0;
  }

  /** Convert a data lake entry back to SimulationResults for pipeline use. */
  toSimulationResults(entry: DataLakeEntry): SimulationResults {
    return {
      config: entry.config,
      meshStats: entry.meshStats,
      residuals: entry.residuals,
      pressureDrop: entry.pressureDrop,
      efficiencyRating: entry.efficiencyRating,
      solveTimeSeconds: entry.solveTimeSeconds,
      totalIterations: entry.totalIterations,
      converged: entry.converged,
    };
  }

  private rowToEntry(row: Record<string, unknown>): DataLakeEntry {
    return {
      id: row.id as string,
      simulationId: row.simulation_id as string | null,
      organizationId: row.organization_id as string,
      userId: row.user_id as string,
      config: row.config as SimulationConfig,
      meshStats: row.mesh_stats as MeshStats,
      residuals: row.residuals as ResidualData[],
      pressureDrop: Number(row.pressure_drop),
      efficiencyRating: row.efficiency_rating as EfficiencyRating,
      converged: row.converged as boolean,
      totalIterations: row.total_iterations as number,
      solveTimeSeconds: Number(row.solve_time_seconds),
      rawOutputUrls: (row.raw_output_urls ?? []) as string[],
      createdAt: row.created_at as string,
    };
  }
}
