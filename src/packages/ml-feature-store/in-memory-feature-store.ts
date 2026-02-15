// ─── packages/ml-feature-store/in-memory-feature-store ──────────────────────
// In-memory implementation of IFeatureStore for testing and development.
// No external dependencies — fully deterministic.
// ─────────────────────────────────────────────────────────────────────────────

import type { FeatureVector } from "@/packages/types";
import type { IFeatureStore } from "./feature-store";
import type {
  FeatureStoreEntry,
  FeatureQuery,
  TrainingPair,
  IngestOptions,
} from "./types";

export class InMemoryFeatureStore implements IFeatureStore {
  private readonly entries: FeatureStoreEntry[] = [];
  private readonly featureToArray: (fv: FeatureVector) => number[];

  constructor(featureToArray: (fv: FeatureVector) => number[]) {
    this.featureToArray = featureToArray;
  }

  async ingest(options: IngestOptions): Promise<string> {
    const id = crypto.randomUUID();
    this.entries.push({
      id,
      simulationId: options.simulationId,
      organizationId: options.organizationId,
      featureVersion: options.featureVersion,
      featureVector: options.featureVector,
      labels: options.labels,
      geometryCluster: options.geometryCluster,
      createdAt: new Date().toISOString(),
    });
    return id;
  }

  async query(options: FeatureQuery): Promise<FeatureStoreEntry[]> {
    let results = this.entries.filter(
      (e) => e.organizationId === options.organizationId
    );

    if (options.geometryCluster) {
      results = results.filter((e) => e.geometryCluster === options.geometryCluster);
    }
    if (options.featureVersion) {
      results = results.filter((e) => e.featureVersion === options.featureVersion);
    }

    // Sort newest first
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async getTrainingData(
    orgId: string,
    targetLabel: string,
    options?: { geometryCluster?: FeatureQuery["geometryCluster"]; limit?: number }
  ): Promise<TrainingPair[]> {
    const entries = await this.query({
      organizationId: orgId,
      geometryCluster: options?.geometryCluster,
      featureVersion: "v1",
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
    return this.entries.filter((e) => e.organizationId === orgId).length;
  }

  /** Reset all entries (test utility). */
  clear(): void {
    this.entries.length = 0;
  }
}
