// ─── ML Training Orchestrator ──────────────────────────────────────────────
// Clean orchestrator with four explicit lifecycle methods:
//   1. checkTrainingThreshold() — should we retrain?
//   2. launchTrainingJob()      — normalize, split, train
//   3. evaluateModel()          — held-out test evaluation
//   4. registerModel()          — persist + emit ModelUpdatedEvent
//
// Integrates: EventBus, ModelRegistry, FeatureStore.
// Configurable retraining threshold.
// ──────────────────────────────────────────────────────────────────────────

import type {
  SurrogateModelType,
  SurrogateModelMetrics,
  SurrogateModelWeights,
  NormalizationParams,
} from "@/packages/types";
import { getEventBus, type PlatformEventBus } from "@/packages/events";
import { ModelRegistry } from "../ml-models/model-registry";
import { FeatureStoreService } from "../feature-store/feature-store-service";
import { DataNormalizer } from "../ml-models/data-normalizer";
import { MLTrainingJob, type TrainingDataPoint } from "../ml-models/ml-training-job";

// ── Public Types ──────────────────────────────────────────────────────────

export interface MLOrchestratorConfig {
  /** New samples needed before retraining triggers. */
  retrainThreshold: number;
  /** Minimum total samples to attempt training. */
  minSamples: number;
  /** Fraction of data reserved for evaluation (0–1). */
  testSplitRatio: number;
  /** Model types this orchestrator manages. */
  modelTypes: SurrogateModelType[];
}

export interface ThresholdCheck {
  shouldRetrain: boolean;
  currentCount: number;
  threshold: number;
  modelType: SurrogateModelType;
}

export interface TrainingArtifact {
  weights: SurrogateModelWeights;
  normalization: NormalizationParams;
  trainMetrics: SurrogateModelMetrics;
  trainSamples: number;
  testSamples: number;
}

export interface EvaluationResult {
  testMse: number;
  testMae: number;
  testR2: number;
  testSampleCount: number;
  overfit: boolean;
  passed: boolean;
}

export interface RegisteredModel {
  modelType: SurrogateModelType;
  version: number;
  metrics: SurrogateModelMetrics;
  evaluation: EvaluationResult;
}

// ── Target label map ──────────────────────────────────────────────────────

const TARGET_LABEL: Record<SurrogateModelType, string> = {
  pressure_drop: "pressureDrop",
  convergence: "converged",
  efficiency: "efficiency",
};

// ── Defaults ──────────────────────────────────────────────────────────────

const DEFAULTS: MLOrchestratorConfig = {
  retrainThreshold: 10,
  minSamples: 10,
  testSplitRatio: 0.2,
  modelTypes: ["pressure_drop", "convergence", "efficiency"],
};

// ── Orchestrator ──────────────────────────────────────────────────────────

export class MLTrainingOrchestrator {
  private readonly config: MLOrchestratorConfig;
  private readonly featureStore: FeatureStoreService;
  private readonly registry: ModelRegistry;
  private readonly normalizer = new DataNormalizer();
  private readonly trainer = new MLTrainingJob();
  private readonly bus: PlatformEventBus;

  /** Per-org pending sample counts (incremented externally or via events). */
  private readonly pendingCounts = new Map<string, number>();

  private unsubscribers: (() => void)[] = [];

  constructor(
    config?: Partial<MLOrchestratorConfig>,
    deps?: {
      featureStore?: FeatureStoreService;
      registry?: ModelRegistry;
      bus?: PlatformEventBus;
    }
  ) {
    this.config = { ...DEFAULTS, ...config };
    this.featureStore = deps?.featureStore ?? new FeatureStoreService();
    this.registry = deps?.registry ?? new ModelRegistry();
    this.bus = deps?.bus ?? getEventBus();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  /** Subscribe to feature.created events for automatic threshold tracking. */
  start(): void {
    this.unsubscribers.push(
      this.bus.on("feature.created", async (event) => {
        const orgId = event.payload.organizationId;
        this.incrementPending(orgId);

        // Auto-check threshold for all model types
        for (const modelType of this.config.modelTypes) {
          const check = this.checkTrainingThreshold(orgId, modelType);
          if (check.shouldRetrain) {
            try {
              await this.runFullCycle(orgId, modelType);
            } catch (err) {
              console.error(
                `[MLTrainingOrchestrator] Auto-retrain failed for ${modelType}:`,
                err
              );
            }
          }
        }
      })
    );
  }

  /** Unsubscribe from all events. */
  stop(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }

  /** Increment pending count for an org (called when new data arrives). */
  incrementPending(orgId: string, amount = 1): void {
    this.pendingCounts.set(orgId, (this.pendingCounts.get(orgId) ?? 0) + amount);
  }

  // ── 1. Check Training Threshold ─────────────────────────────────────────

  /**
   * Determine whether enough new samples have accumulated to justify
   * retraining for the given org + model type.
   */
  checkTrainingThreshold(
    orgId: string,
    modelType: SurrogateModelType
  ): ThresholdCheck {
    const currentCount = this.pendingCounts.get(orgId) ?? 0;
    return {
      shouldRetrain: currentCount >= this.config.retrainThreshold,
      currentCount,
      threshold: this.config.retrainThreshold,
      modelType,
    };
  }

  // ── 2. Launch Training Job ──────────────────────────────────────────────

  /**
   * Load features, normalize, split train/test, and train the model.
   * Returns the raw training artifact (weights, normalization, metrics).
   *
   * @throws if there are fewer than `minSamples` available.
   */
  async launchTrainingJob(
    orgId: string,
    modelType: SurrogateModelType
  ): Promise<TrainingArtifact> {
    const targetLabel = TARGET_LABEL[modelType];

    // Load feature vectors
    const rawData = await this.featureStore.getTrainingData(orgId, targetLabel);

    if (rawData.length < this.config.minSamples) {
      throw new Error(
        `Insufficient samples for ${modelType}: ${rawData.length} < ${this.config.minSamples}`
      );
    }

    const featureArrays = rawData.map((d) => d.features);
    const targets = rawData.map((d) => d.target);

    // Normalize
    const { normalized, params } = this.normalizer.fitTransform(featureArrays);

    // Split train/test
    const testSize = Math.max(1, Math.round(normalized.length * this.config.testSplitRatio));
    const trainSize = normalized.length - testSize;

    const trainX = normalized.slice(0, trainSize);
    const trainY = targets.slice(0, trainSize);

    // Train
    const trainPoints: TrainingDataPoint[] = trainX.map((f, i) => ({
      features: f,
      target: trainY[i],
    }));
    const { weights, metrics } = this.trainer.train(trainPoints, modelType);

    return {
      weights,
      normalization: params,
      trainMetrics: metrics,
      trainSamples: trainSize,
      testSamples: testSize,
    };
  }

  // ── 3. Evaluate Model ───────────────────────────────────────────────────

  /**
   * Evaluate a trained model against the held-out test split.
   * Returns test-set metrics and an overfit flag.
   *
   * @param artifact  The training artifact from `launchTrainingJob`.
   * @param orgId     Used to re-fetch the raw data for the test split.
   * @param modelType Used to select the target label.
   */
  async evaluateModel(
    artifact: TrainingArtifact,
    orgId: string,
    modelType: SurrogateModelType
  ): Promise<EvaluationResult> {
    const targetLabel = TARGET_LABEL[modelType];
    const rawData = await this.featureStore.getTrainingData(orgId, targetLabel);

    const featureArrays = rawData.map((d) => d.features);
    const targets = rawData.map((d) => d.target);

    // Re-apply same normalization
    this.normalizer.loadParams(artifact.normalization);
    const normalized = featureArrays.map((f) => this.normalizer.transform(f));

    // Extract test split (same split logic as training)
    const testSize = Math.max(1, Math.round(normalized.length * this.config.testSplitRatio));
    const testX = normalized.slice(normalized.length - testSize);
    const testY = targets.slice(targets.length - testSize);

    // Predict on test set
    const predictions = testX.map((f) => this.trainer.predict(f, artifact.weights));
    const n = testY.length;

    let ssRes = 0;
    let ssTot = 0;
    let absErr = 0;
    const yMean = testY.reduce((a, b) => a + b, 0) / n;

    for (let i = 0; i < n; i++) {
      ssRes += (testY[i] - predictions[i]) ** 2;
      ssTot += (testY[i] - yMean) ** 2;
      absErr += Math.abs(testY[i] - predictions[i]);
    }

    const testMse = ssRes / n;
    const testMae = absErr / n;
    const testR2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    const overfit = artifact.trainMetrics.r2 - testR2 > 0.2;

    // Pass if test R² is reasonable and no severe overfit
    const passed = testR2 > 0 && !overfit;

    return { testMse, testMae, testR2, testSampleCount: n, overfit, passed };
  }

  // ── 4. Register Model ───────────────────────────────────────────────────

  /**
   * Persist the trained model to the ModelRegistry and emit
   * a `model.updated` event on the EventBus.
   */
  async registerModel(
    orgId: string,
    modelType: SurrogateModelType,
    artifact: TrainingArtifact,
    evaluation: EvaluationResult
  ): Promise<RegisteredModel> {
    const saved = await this.registry.saveVersion(
      orgId,
      modelType,
      artifact.weights,
      artifact.normalization,
      artifact.trainMetrics
    );

    // Emit ModelUpdatedEvent
    await this.bus.emit("model.updated", {
      organizationId: orgId,
      modelType,
      version: saved.version,
      metrics: artifact.trainMetrics,
      previousVersion: saved.version > 1 ? saved.version - 1 : null,
      timestamp: new Date().toISOString(),
    });

    // Reset pending counter after successful registration
    this.pendingCounts.set(orgId, 0);

    return {
      modelType,
      version: saved.version,
      metrics: artifact.trainMetrics,
      evaluation,
    };
  }

  // ── Full Cycle (convenience) ────────────────────────────────────────────

  /**
   * Run the complete cycle: train → evaluate → register.
   * Only registers if evaluation passes.
   */
  async runFullCycle(
    orgId: string,
    modelType: SurrogateModelType
  ): Promise<RegisteredModel | null> {
    const artifact = await this.launchTrainingJob(orgId, modelType);
    const evaluation = await this.evaluateModel(artifact, orgId, modelType);

    if (!evaluation.passed) {
      console.warn(
        `[MLTrainingOrchestrator] ${modelType} evaluation failed — ` +
          `testR²=${evaluation.testR2.toFixed(3)}, overfit=${evaluation.overfit}. Skipping registration.`
      );
      return null;
    }

    return this.registerModel(orgId, modelType, artifact, evaluation);
  }
}
