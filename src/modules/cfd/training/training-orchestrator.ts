// ─── Training Orchestrator ─────────────────────────────────────────────────
// Coordinates the full ML pipeline:
//   Event → Data Lake → Feature Store → Training → Model Registry
//
// Listens for SimulationCompleted events, ingests data, and triggers
// retraining when enough new samples accumulate.
// ──────────────────────────────────────────────────────────────────────────

import type {
  SimulationCompletedEvent,
  SimulationResults,
  SurrogateModelType,
  SurrogateModelMetrics,
  ResidualData,
} from "@/packages/types";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { PlatformEventBus, getEventBus } from "@/packages/events";
import { DataLakeService } from "../data-lake/data-lake-service";
import { FeatureStoreService } from "../feature-store/feature-store-service";
import { DataNormalizer } from "../ml-models/data-normalizer";
import { MLTrainingJob, type TrainingDataPoint } from "../ml-models/ml-training-job";
import { ModelRegistry } from "../ml-models/model-registry";

export interface TrainingJobRecord {
  id: string;
  organizationId: string;
  modelType: SurrogateModelType;
  status: "queued" | "running" | "completed" | "failed";
  sampleCount: number;
  metrics: SurrogateModelMetrics | null;
  errorMessage: string | null;
}

export interface OrchestratorConfig {
  retrainThreshold: number;
  minTrainingSamples: number;
  modelTypes: SurrogateModelType[];
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  retrainThreshold: 10,
  minTrainingSamples: 5,
  modelTypes: ["pressure_drop", "convergence", "efficiency"],
};

const MODEL_TARGET_MAP: Record<SurrogateModelType, string> = {
  pressure_drop: "pressureDrop",
  convergence: "converged",
  efficiency: "efficiency",
};

export class TrainingOrchestrator {
  private readonly dataLake: DataLakeService;
  private readonly featureStore: FeatureStoreService;
  private readonly normalizer = new DataNormalizer();
  private readonly trainer = new MLTrainingJob();
  private readonly registry: ModelRegistry;
  private readonly config: OrchestratorConfig;
  private readonly pendingCounts = new Map<string, number>();
  private unsubscribe: (() => void) | null = null;

  constructor(
    config?: Partial<OrchestratorConfig>,
    deps?: {
      dataLake?: DataLakeService;
      featureStore?: FeatureStoreService;
      registry?: ModelRegistry;
    }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dataLake = deps?.dataLake ?? new DataLakeService();
    this.featureStore = deps?.featureStore ?? new FeatureStoreService();
    this.registry = deps?.registry ?? new ModelRegistry();
  }

  /** Start listening for simulation.completed events. */
  start(): void {
    const bus = getEventBus();
    this.unsubscribe = bus.on("simulation.completed", (event) => {
      this.handleSimulationCompleted(event.payload).catch((err) =>
        console.error("[TrainingOrchestrator] Pipeline error:", err)
      );
    });
    console.log("[TrainingOrchestrator] Started — listening for simulation.completed");
  }

  /** Stop listening. */
  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Full pipeline: ingest → extract → check threshold → retrain. */
  async handleSimulationCompleted(event: SimulationCompletedEvent): Promise<void> {
    const orgId = event.organizationId;

    // 1. Build SimulationResults from event payload
    const results = this.eventToResults(event);

    // 2. Ingest into Data Lake
    await this.dataLake.ingest(
      orgId,
      event.userId,
      event.simulationId,
      results
    );

    // 3. Extract features → Feature Store
    await this.featureStore.ingestFromResults(orgId, event.simulationId, results);

    // 4. Check retrain threshold
    const count = (this.pendingCounts.get(orgId) ?? 0) + 1;
    this.pendingCounts.set(orgId, count);

    if (count >= this.config.retrainThreshold) {
      await this.retrainAll(orgId);
      this.pendingCounts.set(orgId, 0);
    }
  }

  /** Retrain all model types for an organization. */
  async retrainAll(orgId: string): Promise<TrainingJobRecord[]> {
    const jobs: TrainingJobRecord[] = [];

    for (const modelType of this.config.modelTypes) {
      const job = await this.trainModel(orgId, modelType);
      if (job) jobs.push(job);
    }

    // Emit model.updated events for successful trainings
    const bus = getEventBus();
    for (const job of jobs) {
      if (job.status === "completed" && job.metrics) {
        const activeModel = await this.registry.getActiveModel(orgId, job.modelType);
        await bus.emit("model.updated", {
          organizationId: orgId,
          modelType: job.modelType,
          version: activeModel?.version ?? 1,
          metrics: job.metrics,
          previousVersion: activeModel ? activeModel.version - 1 : null,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return jobs;
  }

  /** Train a single model type. Returns the job record. */
  async trainModel(
    orgId: string,
    modelType: SurrogateModelType
  ): Promise<TrainingJobRecord | null> {
    const targetLabel = MODEL_TARGET_MAP[modelType];

    // Create job record
    const { data: jobRow, error: jobErr } = await supabase
      .from("training_jobs")
      .insert([{
        organization_id: orgId,
        model_type: modelType,
        status: "running",
        started_at: new Date().toISOString(),
      }])
      .select("id")
      .single();

    const jobId = jobRow?.id ?? crypto.randomUUID();

    try {
      // Get training data from feature store
      const trainingData = await this.featureStore.getTrainingData(orgId, targetLabel);

      if (trainingData.length < this.config.minTrainingSamples) {
        await this.updateJobStatus(jobId, "completed", trainingData.length, null, "Insufficient samples");
        return null;
      }

      // Normalize + train
      const featureArrays = trainingData.map((d) => d.features);
      const targets = trainingData.map((d) => d.target);

      const { normalized, params } = this.normalizer.fitTransform(featureArrays);
      const points: TrainingDataPoint[] = normalized.map((f, i) => ({
        features: f,
        target: targets[i],
      }));

      const { weights, metrics } = this.trainer.train(points, modelType);

      // Save to model registry
      await this.registry.saveVersion(orgId, modelType, weights, params, metrics);

      // Update job
      const job = await this.updateJobStatus(jobId, "completed", trainingData.length, metrics);

      console.log(
        `[TrainingOrchestrator] ${modelType} trained — R²=${metrics.r2.toFixed(3)}, samples=${metrics.sampleCount}`
      );

      return job;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      await this.updateJobStatus(jobId, "failed", 0, null, errMsg);
      console.error(`[TrainingOrchestrator] ${modelType} training failed:`, err);
      return {
        id: jobId,
        organizationId: orgId,
        modelType,
        status: "failed",
        sampleCount: 0,
        metrics: null,
        errorMessage: errMsg,
      };
    }
  }

  private async updateJobStatus(
    jobId: string,
    status: string,
    sampleCount: number,
    metrics: SurrogateModelMetrics | null,
    errorMessage?: string
  ): Promise<TrainingJobRecord> {
    await supabase
      .from("training_jobs")
      .update({
        status,
        sample_count: sampleCount,
        metrics: metrics ? (JSON.parse(JSON.stringify(metrics)) as Json) : ({} as Json),
        error_message: errorMessage ?? null,
        completed_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq("id", jobId);

    return {
      id: jobId,
      organizationId: "",
      modelType: "pressure_drop",
      status: status as TrainingJobRecord["status"],
      sampleCount,
      metrics,
      errorMessage: errorMessage ?? null,
    };
  }

  /** Convert SimulationCompletedEvent to SimulationResults. */
  private eventToResults(event: SimulationCompletedEvent): SimulationResults {
    const r = event.results;
    return {
      config: event.config,
      meshStats: {
        cellCount: 0,
        avgOrthogonality: 0.8,
        maxSkewness: 0.4,
        maxAspectRatio: 15,
        minVolume: 1e-12,
        nonOrthogonalCellPercent: 5,
        avgYPlus: null,
      },
      residuals: this.snapshotToResiduals(r.finalResiduals, r.totalIterations),
      pressureDrop: r.pressureDrop,
      efficiencyRating: r.efficiencyRating,
      solveTimeSeconds: r.solveTimeSeconds,
      totalIterations: r.totalIterations,
      converged: r.converged,
    };
  }

  private snapshotToResiduals(
    snapshot: SimulationCompletedEvent["results"]["finalResiduals"],
    totalIterations: number
  ): ResidualData[] {
    return [{
      iteration: totalIterations,
      continuity: snapshot.continuity,
      xMomentum: snapshot.xMomentum,
      yMomentum: snapshot.yMomentum,
      zMomentum: snapshot.zMomentum,
      energy: snapshot.energy,
      kTurbulent: snapshot.kTurbulent,
      epsilonOrOmega: snapshot.epsilonOrOmega,
    }];
  }
}
