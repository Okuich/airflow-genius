// ─── Training Pipeline ─────────────────────────────────────────────────────
// Formalises the 7-step ML training workflow:
//   1. Load feature vectors
//   2. Normalize
//   3. Split train/test
//   4. Train model
//   5. Evaluate
//   6. Save model artifact
//   7. Emit ModelUpdatedEvent
//
// Unlike TrainingOrchestrator (event-driven), TrainingPipeline is an
// imperative, testable object that can be triggered on demand.
// ──────────────────────────────────────────────────────────────────────────

import type {
  SurrogateModelType,
  SurrogateModelMetrics,
  SurrogateModelWeights,
  NormalizationParams,
} from "@/packages/types";
import type { TrainingPair } from "@/packages/ml-feature-store";
import { getEventBus } from "@/packages/events";
import { DataNormalizer } from "../ml-models/data-normalizer";
import { MLTrainingJob, type TrainingDataPoint } from "../ml-models/ml-training-job";
import { ModelRegistry } from "../ml-models/model-registry";
import { FeatureStoreService } from "../feature-store/feature-store-service";

// ── Public Types ──────────────────────────────────────────────────────────

export interface PipelineConfig {
  /** Fraction of data reserved for test set (0–1). Default 0.2. */
  testSplitRatio: number;
  /** Minimum total samples required to run the pipeline. Default 10. */
  minSamples: number;
  /** Model types to train. Default: all three. */
  modelTypes: SurrogateModelType[];
}

export interface PipelineStepResult {
  step: PipelineStep;
  durationMs: number;
  detail?: string;
}

export type PipelineStep =
  | "load_features"
  | "normalize"
  | "split"
  | "train"
  | "evaluate"
  | "save_artifact"
  | "emit_event";

export interface EvaluationReport {
  trainMetrics: SurrogateModelMetrics;
  testMse: number;
  testMae: number;
  testR2: number;
  testSampleCount: number;
  overfit: boolean;
}

export interface PipelineRunResult {
  modelType: SurrogateModelType;
  success: boolean;
  steps: PipelineStepResult[];
  evaluation: EvaluationReport | null;
  modelVersion: number | null;
  error: string | null;
}

// ── Target label map ──────────────────────────────────────────────────────

const TARGET_LABEL: Record<SurrogateModelType, string> = {
  pressure_drop: "pressureDrop",
  convergence: "converged",
  efficiency: "efficiency",
};

// ── Default Config ────────────────────────────────────────────────────────

const DEFAULTS: PipelineConfig = {
  testSplitRatio: 0.2,
  minSamples: 10,
  modelTypes: ["pressure_drop", "convergence", "efficiency"],
};

// ── Pipeline ──────────────────────────────────────────────────────────────

export class TrainingPipeline {
  private readonly config: PipelineConfig;
  private readonly featureStore: FeatureStoreService;
  private readonly normalizer = new DataNormalizer();
  private readonly trainer = new MLTrainingJob();
  private readonly registry: ModelRegistry;

  constructor(
    config?: Partial<PipelineConfig>,
    deps?: {
      featureStore?: FeatureStoreService;
      registry?: ModelRegistry;
    }
  ) {
    this.config = { ...DEFAULTS, ...config };
    this.featureStore = deps?.featureStore ?? new FeatureStoreService();
    this.registry = deps?.registry ?? new ModelRegistry();
  }

  /** Run the full 7-step pipeline for all configured model types. */
  async runAll(orgId: string): Promise<PipelineRunResult[]> {
    const results: PipelineRunResult[] = [];
    for (const modelType of this.config.modelTypes) {
      results.push(await this.run(orgId, modelType));
    }
    return results;
  }

  /** Run the 7-step pipeline for a single model type. */
  async run(orgId: string, modelType: SurrogateModelType): Promise<PipelineRunResult> {
    const steps: PipelineStepResult[] = [];
    const track = async <T>(step: PipelineStep, fn: () => Promise<T> | T): Promise<T> => {
      const t0 = performance.now();
      const result = await fn();
      steps.push({ step, durationMs: Math.round(performance.now() - t0), detail: undefined });
      return result;
    };

    try {
      // ── Step 1: Load feature vectors ────────────────────────────────
      const rawData = await track("load_features", () =>
        this.featureStore.getTrainingData(orgId, TARGET_LABEL[modelType])
      );

      if (rawData.length < this.config.minSamples) {
        return {
          modelType,
          success: false,
          steps,
          evaluation: null,
          modelVersion: null,
          error: `Insufficient samples: ${rawData.length} < ${this.config.minSamples}`,
        };
      }

      // ── Step 2: Normalize ───────────────────────────────────────────
      const featureArrays = rawData.map((d) => d.features);
      const targets = rawData.map((d) => d.target);

      const { normalized, params } = await track("normalize", () =>
        this.normalizer.fitTransform(featureArrays)
      );

      // ── Step 3: Split train/test ────────────────────────────────────
      const { trainX, trainY, testX, testY } = await track("split", () =>
        this.splitData(normalized, targets)
      );

      // ── Step 4: Train model ─────────────────────────────────────────
      const trainPoints: TrainingDataPoint[] = trainX.map((f, i) => ({
        features: f,
        target: trainY[i],
      }));

      const { weights, metrics: trainMetrics } = await track("train", () =>
        this.trainer.train(trainPoints, modelType)
      );

      // ── Step 5: Evaluate ────────────────────────────────────────────
      const evaluation = await track("evaluate", () =>
        this.evaluate(weights, testX, testY, trainMetrics)
      );

      // ── Step 6: Save model artifact ─────────────────────────────────
      const saved = await track("save_artifact", () =>
        this.registry.saveVersion(orgId, modelType, weights, params, trainMetrics)
      );

      // ── Step 7: Emit ModelUpdatedEvent ──────────────────────────────
      await track("emit_event", async () => {
        const bus = getEventBus();
        await bus.emit("model.updated", {
          organizationId: orgId,
          modelType,
          version: saved.version,
          metrics: trainMetrics,
          previousVersion: saved.version > 1 ? saved.version - 1 : null,
          timestamp: new Date().toISOString(),
        });
      });

      return {
        modelType,
        success: true,
        steps,
        evaluation,
        modelVersion: saved.version,
        error: null,
      };
    } catch (err) {
      return {
        modelType,
        success: false,
        steps,
        evaluation: null,
        modelVersion: null,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  // ── Internal Helpers ──────────────────────────────────────────────────

  /** Deterministic train/test split by ratio. */
  private splitData(
    features: number[][],
    targets: number[]
  ): { trainX: number[][]; trainY: number[]; testX: number[][]; testY: number[] } {
    const n = features.length;
    const testSize = Math.max(1, Math.round(n * this.config.testSplitRatio));
    const trainSize = n - testSize;

    return {
      trainX: features.slice(0, trainSize),
      trainY: targets.slice(0, trainSize),
      testX: features.slice(trainSize),
      testY: targets.slice(trainSize),
    };
  }

  /** Evaluate the trained weights against the held-out test set. */
  private evaluate(
    weights: SurrogateModelWeights,
    testX: number[][],
    testY: number[],
    trainMetrics: SurrogateModelMetrics
  ): EvaluationReport {
    const predictions = testX.map((f) => this.trainer.predict(f, weights));
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

    // Overfit heuristic: train R² much better than test R² 
    const overfit = trainMetrics.r2 - testR2 > 0.2;

    return {
      trainMetrics,
      testMse,
      testMae,
      testR2,
      testSampleCount: n,
      overfit,
    };
  }
}
