// ─── packages/ml-feature-store/supabase-feature-store ────────────────────────
// Supabase-backed implementation of IFeatureStore.
// Reads/writes the `feature_store` table via the typed Supabase client.
// ─────────────────────────────────────────────────────────────────────────────

import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type { FeatureVector } from "@/packages/types";
import type { IFeatureStore } from "./feature-store";
import type {
  FeatureStoreEntry,
  FeatureQuery,
  TrainingPair,
  IngestOptions,
} from "./types";

const CURRENT_FEATURE_VERSION = "v1";

export class SupabaseFeatureStore implements IFeatureStore {
  private readonly featureToArray: (fv: FeatureVector) => number[];

  /**
   * @param featureToArray  Converts a FeatureVector to a flat number array.
   *   Injected so the store doesn't depend on FeatureExtractor directly.
   */
  constructor(featureToArray: (fv: FeatureVector) => number[]) {
    this.featureToArray = featureToArray;
  }

  async ingest(options: IngestOptions): Promise<string> {
    const { data, error } = await supabase
      .from("feature_store")
      .insert([{
        simulation_id: options.simulationId,
        organization_id: options.organizationId,
        feature_version: options.featureVersion,
        feature_vector: JSON.parse(JSON.stringify(options.featureVector)) as Json,
        labels: options.labels as unknown as Json,
        geometry_cluster: options.geometryCluster,
      }])
      .select("id")
      .single();

    if (error) throw new Error(`Feature store ingest failed: ${error.message}`);
    return data.id;
  }

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
    return (data ?? []).map(rowToEntry);
  }

  async getTrainingData(
    orgId: string,
    targetLabel: string,
    options?: { geometryCluster?: FeatureQuery["geometryCluster"]; limit?: number }
  ): Promise<TrainingPair[]> {
    const entries = await this.query({
      organizationId: orgId,
      geometryCluster: options?.geometryCluster,
      featureVersion: CURRENT_FEATURE_VERSION,
      limit: options?.limit,
    });

    const pairs: TrainingPair[] = [];
    for (const entry of entries) {
      const target = entry.labels[targetLabel];
      if (target === null || target === undefined) continue;
      pairs.push({
        features: this.featureToArray(entry.featureVector),
        target,
      });
    }
    return pairs;
  }

  async count(orgId: string): Promise<number> {
    const { count, error } = await supabase
      .from("feature_store")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId);

    if (error) return 0;
    return count ?? 0;
  }
}

// ── Row Mapping ─────────────────────────────────────────────────────────────

function rowToEntry(row: Record<string, unknown>): FeatureStoreEntry {
  return {
    id: row.id as string,
    simulationId: row.simulation_id as string | null,
    organizationId: row.organization_id as string,
    featureVersion: row.feature_version as string,
    featureVector: row.feature_vector as FeatureVector,
    labels: row.labels as Record<string, number | null>,
    geometryCluster: row.geometry_cluster as FeatureStoreEntry["geometryCluster"],
    createdAt: row.created_at as string,
  };
}
