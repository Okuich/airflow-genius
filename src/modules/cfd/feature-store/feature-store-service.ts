// ─── Feature Store Service ─────────────────────────────────────────────────
// CFD-domain facade over packages/ml-feature-store.
// Handles SimulationResults → feature extraction → store delegation.
// ──────────────────────────────────────────────────────────────────────────

import type { SimulationResults } from "@/packages/types";
import type { IFeatureStore, FeatureStoreEntry, FeatureQuery, TrainingPair } from "@/packages/ml-feature-store";
import { SupabaseFeatureStore } from "@/packages/ml-feature-store";
import { FeatureExtractor } from "../ml-models/feature-extractor";
import { BenchmarkEngine } from "../benchmarking/benchmark-engine";

const CURRENT_FEATURE_VERSION = "v1";

export type { FeatureStoreEntry, FeatureQuery };

export class FeatureStoreService {
  private readonly extractor = new FeatureExtractor();
  private readonly benchmarkEngine = new BenchmarkEngine();
  private readonly store: IFeatureStore;

  constructor(store?: IFeatureStore) {
    this.store = store ?? new SupabaseFeatureStore(
      (fv) => this.extractor.resultToArray(fv)
    );
  }

  /** Extract features from simulation results and persist to the store. */
  async ingestFromResults(
    orgId: string,
    simulationId: string | null,
    results: SimulationResults
  ): Promise<string> {
    const featureVector = this.extractor.extractFromResults(results);
    const geometryCluster = this.benchmarkEngine.classifyGeometry(results.config);

    const labels: Record<string, number | null> = {
      pressureDrop: results.pressureDrop,
      converged: results.converged ? 1 : 0,
      iterationsToConverge: results.converged ? results.totalIterations : null,
      efficiency: featureVector.efficiency,
      solveTimeSeconds: results.solveTimeSeconds,
    };

    return this.store.ingest({
      organizationId: orgId,
      simulationId,
      featureVersion: CURRENT_FEATURE_VERSION,
      featureVector,
      labels,
      geometryCluster,
    });
  }

  /** Delegate query to underlying store. */
  query(options: FeatureQuery): Promise<FeatureStoreEntry[]> {
    return this.store.query(options);
  }

  /** Delegate training data retrieval. */
  getTrainingData(
    orgId: string,
    targetLabel: string,
    options?: { geometryCluster?: FeatureQuery["geometryCluster"]; limit?: number }
  ): Promise<TrainingPair[]> {
    return this.store.getTrainingData(orgId, targetLabel, options);
  }

  /** Delegate count. */
  count(orgId: string): Promise<number> {
    return this.store.count(orgId);
  }
}
