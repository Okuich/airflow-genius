// ─── Feature Store Service ─────────────────────────────────────────────────
// Versioned feature vector storage with geometry cluster tagging.
// Feeds the Training Orchestrator with labeled, queryable feature data.
// ──────────────────────────────────────────────────────────────────────────

import type {
  FeatureVector,
  SimulationResults,
} from "@/packages/types";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { FeatureExtractor } from "../ml-models/feature-extractor";
import { BenchmarkEngine, type GeometryCluster } from "../benchmarking/benchmark-engine";
import { DiagnosticClassifier } from "../ml-models/diagnostic-classifier";

export interface FeatureStoreEntry {
  id: string;
  simulationId: string | null;
  organizationId: string;
  featureVersion: string;
  featureVector: FeatureVector;
  labels: Record<string, number | null>;
  geometryCluster: GeometryCluster;
  createdAt: string;
}

export interface FeatureQuery {
  organizationId: string;
  geometryCluster?: GeometryCluster;
  featureVersion?: string;
  limit?: number;
}

const CURRENT_FEATURE_VERSION = "v1";

export class FeatureStoreService {
  private readonly extractor = new FeatureExtractor();
  private readonly benchmarkEngine = new BenchmarkEngine();

  /**
   * Extract features from simulation results and persist to the store.
   * Returns the stored entry ID.
   */
  async ingestFromResults(
    orgId: string,
    simulationId: string | null,
    results: SimulationResults
  ): Promise<string> {
    const featureVector = this.extractor.extractFromResults(results);
    const geometryCluster = this.benchmarkEngine.classifyGeometry(results.config);

    // Build labels for supervised learning
    const labels: Record<string, number | null> = {
      pressureDrop: results.pressureDrop,
      converged: results.converged ? 1 : 0,
      iterationsToConverge: results.converged ? results.totalIterations : null,
      efficiency: featureVector.efficiency,
      solveTimeSeconds: results.solveTimeSeconds,
    };

    const { data, error } = await supabase
      .from("feature_store")
      .insert([{
        simulation_id: simulationId,
        organization_id: orgId,
        feature_version: CURRENT_FEATURE_VERSION,
        feature_vector: JSON.parse(JSON.stringify(featureVector)) as Json,
        labels: labels as unknown as Json,
        geometry_cluster: geometryCluster,
      }])
      .select("id")
      .single();

    if (error) throw new Error(`Feature store ingest failed: ${error.message}`);
    return data.id;
  }

  /** Query feature vectors with optional filtering. */
  async query(options: FeatureQuery): Promise<FeatureStoreEntry[]> {
    let q = supabase
      .from("feature_store")
      .select("*")
      .eq("organization_id", options.organizationId)
      .order("created_at", { ascending: false });

    if (options.geometryCluster) q = q.eq("geometry_cluster", options.geometryCluster);
    if (options.featureVersion) q = q.eq("feature_version", options.featureVersion);
    if (options.limit) q = q.limit(options.limit);

    const { data, error } = await q;
    if (error) throw new Error(`Feature store query failed: ${error.message}`);
    return (data ?? []).map(this.rowToEntry);
  }

  /** Get training-ready pairs: (feature array, target) for a given label. */
  async getTrainingData(
    orgId: string,
    targetLabel: string,
    options?: { geometryCluster?: GeometryCluster; limit?: number }
  ): Promise<{ features: number[]; target: number }[]> {
    const entries = await this.query({
      organizationId: orgId,
      geometryCluster: options?.geometryCluster,
      featureVersion: CURRENT_FEATURE_VERSION,
      limit: options?.limit,
    });

    const pairs: { features: number[]; target: number }[] = [];
    for (const entry of entries) {
      const target = entry.labels[targetLabel];
      if (target === null || target === undefined) continue;
      pairs.push({
        features: this.extractor.resultToArray(entry.featureVector),
        target,
      });
    }
    return pairs;
  }

  /** Count entries for an org. */
  async count(orgId: string): Promise<number> {
    const { count, error } = await supabase
      .from("feature_store")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId);

    if (error) return 0;
    return count ?? 0;
  }

  private rowToEntry(row: Record<string, unknown>): FeatureStoreEntry {
    return {
      id: row.id as string,
      simulationId: row.simulation_id as string | null,
      organizationId: row.organization_id as string,
      featureVersion: row.feature_version as string,
      featureVector: row.feature_vector as FeatureVector,
      labels: row.labels as Record<string, number | null>,
      geometryCluster: row.geometry_cluster as GeometryCluster,
      createdAt: row.created_at as string,
    };
  }
}
