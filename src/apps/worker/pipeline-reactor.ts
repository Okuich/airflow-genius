// ─── apps/worker/pipeline-reactor ────────────────────────────────────────────
// Reactive event chain that drives the ML training pipeline:
//
//   SimulationCompleted
//     → ingest to Data Lake + Feature Store
//     → emit FeatureVectorCreated
//     → increment pending count, check threshold
//     → emit TrainingThresholdReached
//     → invoke pipeline-worker edge function
//     → emit TrainingJobLaunched
//
// All steps are event-driven; each stage only fires when its
// predecessor emits the appropriate event.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SimulationCompletedEvent,
  SimulationResults,
  ResidualData,
  SurrogateModelType,
} from "@/packages/types";
import { getEventBus } from "@/packages/events";
import { DataLakeService } from "@/modules/cfd/data-lake/data-lake-service";
import { FeatureStoreService } from "@/modules/cfd/feature-store/feature-store-service";
import { WorkerService } from "./worker-service";

export interface PipelineReactorConfig {
  /** Number of new features before triggering retraining. Default: 10. */
  retrainThreshold: number;
  /** Model types to train. */
  modelTypes: SurrogateModelType[];
  /** Minimum samples for first training. Default: 5. */
  minSamples: number;
}

const DEFAULT_CONFIG: PipelineReactorConfig = {
  retrainThreshold: 10,
  modelTypes: ["pressure_drop", "convergence", "efficiency"],
  minSamples: 5,
};

export class PipelineReactor {
  private readonly dataLake: DataLakeService;
  private readonly featureStore: FeatureStoreService;
  private readonly worker: WorkerService;
  private readonly config: PipelineReactorConfig;
  private readonly pendingCounts = new Map<string, number>();
  private unsubscribers: (() => void)[] = [];

  constructor(
    config?: Partial<PipelineReactorConfig>,
    deps?: {
      dataLake?: DataLakeService;
      featureStore?: FeatureStoreService;
      worker?: WorkerService;
    }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dataLake = deps?.dataLake ?? new DataLakeService();
    this.featureStore = deps?.featureStore ?? new FeatureStoreService();
    this.worker = deps?.worker ?? new WorkerService();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  /** Wire up the full reactive chain. */
  start(): void {
    const bus = getEventBus();

    // Stage 1: SimulationCompleted → ingest → emit FeatureVectorCreated
    this.unsubscribers.push(
      bus.on("simulation.completed", async (event) => {
        try {
          await this.handleSimulationCompleted(event.payload);
        } catch (err) {
          console.error("[PipelineReactor] Stage 1 error:", err);
        }
      })
    );

    // Stage 2: FeatureVectorCreated → check threshold → emit TrainingThresholdReached
    this.unsubscribers.push(
      bus.on("feature.created", async (event) => {
        try {
          await this.handleFeatureCreated(event.payload);
        } catch (err) {
          console.error("[PipelineReactor] Stage 2 error:", err);
        }
      })
    );

    // Stage 3: TrainingThresholdReached → invoke worker → emit TrainingJobLaunched
    this.unsubscribers.push(
      bus.on("training.threshold_reached", async (event) => {
        try {
          await this.handleThresholdReached(event.payload);
        } catch (err) {
          console.error("[PipelineReactor] Stage 3 error:", err);
        }
      })
    );

    console.log("[PipelineReactor] Started — listening for simulation.completed");
  }

  /** Tear down all subscriptions. */
  stop(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    console.log("[PipelineReactor] Stopped");
  }

  // ── Stage 1: SimulationCompleted → FeatureVectorCreated ─────────────────

  private async handleSimulationCompleted(
    event: SimulationCompletedEvent
  ): Promise<void> {
    const { organizationId: orgId, userId, simulationId } = event;

    // Build SimulationResults from event payload
    const results = this.eventToResults(event);

    // Ingest into Data Lake
    await this.dataLake.ingest(orgId, userId, simulationId, results);

    // Extract features → Feature Store
    const entryId = await this.featureStore.ingestFromResults(
      orgId,
      simulationId,
      results
    );

    // Emit FeatureVectorCreated
    const bus = getEventBus();
    await bus.emit("feature.created", {
      organizationId: orgId,
      simulationId,
      featureStoreEntryId: entryId,
      geometryCluster: "generic", // will be refined by feature store
      timestamp: new Date().toISOString(),
    });

    console.log(
      `[PipelineReactor] Stage 1 complete — features stored (${entryId})`
    );
  }

  // ── Stage 2: FeatureVectorCreated → CheckTrainingThreshold ──────────────

  private async handleFeatureCreated(
    event: { organizationId: string }
  ): Promise<void> {
    const orgId = event.organizationId;
    const count = (this.pendingCounts.get(orgId) ?? 0) + 1;
    this.pendingCounts.set(orgId, count);

    if (count >= this.config.retrainThreshold) {
      const bus = getEventBus();
      await bus.emit("training.threshold_reached", {
        organizationId: orgId,
        pendingCount: count,
        threshold: this.config.retrainThreshold,
        modelTypes: this.config.modelTypes,
        timestamp: new Date().toISOString(),
      });

      // Reset counter
      this.pendingCounts.set(orgId, 0);
      console.log(
        `[PipelineReactor] Stage 2 — threshold reached for ${orgId} (${count}/${this.config.retrainThreshold})`
      );
    } else {
      console.log(
        `[PipelineReactor] Stage 2 — pending ${count}/${this.config.retrainThreshold} for ${orgId}`
      );
    }
  }

  // ── Stage 3: TrainingThresholdReached → LaunchTrainingJob ───────────────

  private async handleThresholdReached(
    event: {
      organizationId: string;
      modelTypes: SurrogateModelType[];
    }
  ): Promise<void> {
    const { organizationId: orgId, modelTypes } = event;

    console.log(
      `[PipelineReactor] Stage 3 — launching training for ${orgId}, models: ${modelTypes.join(", ")}`
    );

    const result = await this.worker.run({
      orgId,
      modelTypes,
      minSamples: this.config.minSamples,
    });

    // Emit job launched events for completed jobs
    const bus = getEventBus();
    for (const job of result.jobs ?? []) {
      if (job.status === "completed" && job.jobId) {
        await bus.emit("training.job_launched", {
          organizationId: orgId,
          jobId: job.jobId,
          modelType: job.modelType as SurrogateModelType,
          sampleCount: job.samples ?? 0,
          timestamp: new Date().toISOString(),
        });
      }
    }

    console.log(
      `[PipelineReactor] Stage 3 complete — ${result.jobs?.length ?? 0} jobs processed`
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Get current pending count for an org (useful for UI/monitoring). */
  getPendingCount(orgId: string): number {
    return this.pendingCounts.get(orgId) ?? 0;
  }

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
