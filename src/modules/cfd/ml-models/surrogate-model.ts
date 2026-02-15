// ─── Surrogate Model Abstraction Layer ─────────────────────────────────────
// Defines the SurrogateModel interface and three concrete implementations:
//   1. ConvergencePredictor   — will simulation converge?
//   2. EfficiencyPredictor    — expected efficiency rating
//   3. TurbulenceRecommendationModel — turbulence model recommendations
//
// All implementations delegate to the existing OLS pipeline (MLTrainingJob,
// DataNormalizer, ModelRegistry) but hide those details behind a clean
// predict/train/version contract.  Swap in real ML backends later by
// implementing the same interface.
// ──────────────────────────────────────────────────────────────────────────

import type {
  FeatureVector,
  SimulationConfig,
  SurrogateModelType,
  SurrogateModelWeights,
  NormalizationParams,
  SurrogateModelMetrics,
  TurbulenceType,
} from "@/packages/types";

import { FeatureExtractor } from "./feature-extractor";
import { DataNormalizer } from "./data-normalizer";
import { MLTrainingJob, type TrainingDataPoint } from "./ml-training-job";
import { ModelRegistry } from "./model-registry";

// ── Public Types ──────────────────────────────────────────────────────────

export interface Prediction {
  /** Predicted numeric value (interpretation depends on model type). */
  value: number;
  /** Confidence score ∈ [0, 1]. */
  confidence: number;
  /** Human-readable label when applicable. */
  label?: string;
}

export interface SurrogateModel {
  /** Run inference on a post-simulation feature vector. */
  predict(input: FeatureVector): Prediction;
  /** Train (or retrain) the model from labeled feature vectors. */
  train(data: TrainingData[]): Promise<void>;
  /** Semantic version string of the currently loaded weights. */
  version: string;
}

export interface TrainingData {
  features: FeatureVector;
  target: number;
}

// ── Base Class (shared infra) ─────────────────────────────────────────────

abstract class BaseSurrogateModel implements SurrogateModel {
  protected readonly extractor = new FeatureExtractor();
  protected readonly normalizer = new DataNormalizer();
  protected readonly trainer = new MLTrainingJob();
  protected readonly registry: ModelRegistry;
  protected readonly orgId: string;

  protected weights: SurrogateModelWeights | null = null;
  protected normParams: NormalizationParams | null = null;
  protected metrics: SurrogateModelMetrics | null = null;
  protected _version = "0.0.0";

  abstract readonly modelType: SurrogateModelType;

  constructor(orgId: string, registry?: ModelRegistry) {
    this.orgId = orgId;
    this.registry = registry ?? new ModelRegistry();
  }

  get version(): string {
    return this._version;
  }

  /** Load the active model weights from the registry. */
  async load(): Promise<boolean> {
    const model = await this.registry.getActiveModel(this.orgId, this.modelType);
    if (!model) return false;

    this.weights = model.weights;
    this.normParams = model.normalization;
    this.metrics = model.metrics;
    this._version = `${model.version}.0.0`;
    return true;
  }

  predict(input: FeatureVector): Prediction {
    if (!this.weights || !this.normParams) {
      return { value: 0, confidence: 0, label: "no-model" };
    }

    const raw = this.extractor.resultToArray(input);
    this.normalizer.loadParams(this.normParams);
    const normalized = this.normalizer.transform(raw);
    const value = this.trainer.predict(normalized, this.weights);
    const confidence = this.metrics ? this.trainer.confidence(this.metrics) : 0;

    return this.interpret(value, confidence);
  }

  async train(data: TrainingData[]): Promise<void> {
    if (data.length < 5) {
      throw new Error(`Need at least 5 samples, got ${data.length}`);
    }

    const featureArrays = data.map((d) => this.extractor.resultToArray(d.features));
    const targets = data.map((d) => d.target);

    const { normalized, params } = this.normalizer.fitTransform(featureArrays);
    const trainingPoints: TrainingDataPoint[] = normalized.map((f, i) => ({
      features: f,
      target: targets[i],
    }));

    const result = this.trainer.train(trainingPoints, this.modelType);

    const saved = await this.registry.saveVersion(
      this.orgId,
      this.modelType,
      result.weights,
      params,
      result.metrics,
    );

    this.weights = result.weights;
    this.normParams = params;
    this.metrics = result.metrics;
    this._version = `${saved.version}.0.0`;
  }

  /** Subclass hook — convert raw value + confidence into a typed Prediction. */
  protected abstract interpret(value: number, confidence: number): Prediction;
}

// ════════════════════════════════════════════════════════════════════════════
//  1. ConvergencePredictor
// ════════════════════════════════════════════════════════════════════════════

/**
 * Predicts convergence likelihood (0 = diverge, 1 = converge).
 *
 * The underlying OLS model outputs a continuous value; we threshold at 0.5
 * and provide a human-readable label.
 */
export class ConvergencePredictor extends BaseSurrogateModel {
  readonly modelType: SurrogateModelType = "convergence";

  protected interpret(value: number, confidence: number): Prediction {
    const clamped = Math.max(0, Math.min(1, value));
    const willConverge = clamped >= 0.5;
    return {
      value: Math.round(clamped * 10000) / 10000,
      confidence,
      label: willConverge ? "likely-converge" : "risk-diverge",
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  2. EfficiencyPredictor
// ════════════════════════════════════════════════════════════════════════════

const EFFICIENCY_LABELS: [number, string][] = [
  [0.75, "Excellent"],
  [0.50, "Good"],
  [0.25, "Average"],
  [0.00, "Poor"],
];

/**
 * Predicts efficiency rating on a [0, 1] scale.
 *
 * Mapped to human labels: Poor / Average / Good / Excellent.
 */
export class EfficiencyPredictor extends BaseSurrogateModel {
  readonly modelType: SurrogateModelType = "efficiency";

  protected interpret(value: number, confidence: number): Prediction {
    const clamped = Math.max(0, Math.min(1, value));
    const label = EFFICIENCY_LABELS.find(([threshold]) => clamped >= threshold)?.[1] ?? "Poor";
    return {
      value: Math.round(clamped * 10000) / 10000,
      confidence,
      label,
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  3. TurbulenceRecommendationModel
// ════════════════════════════════════════════════════════════════════════════

interface TurbulenceRecommendation extends Prediction {
  /** Recommended turbulence model type. */
  recommendedModel: TurbulenceType;
  /** Reasoning behind the recommendation. */
  reasoning: string;
}

/**
 * Recommends a turbulence model based on feature vector analysis.
 *
 * Uses a rule-based heuristic layered with surrogate confidence scores.
 * The `predict` method returns the best turbulence model recommendation.
 *
 * Future: replace heuristic with a classification model once enough
 * labeled training data is available.
 */
export class TurbulenceRecommendationModel implements SurrogateModel {
  private _version = "1.0.0-heuristic";
  private convergencePredictor: ConvergencePredictor;
  private efficiencyPredictor: EfficiencyPredictor;

  constructor(orgId: string, registry?: ModelRegistry) {
    this.convergencePredictor = new ConvergencePredictor(orgId, registry);
    this.efficiencyPredictor = new EfficiencyPredictor(orgId, registry);
  }

  get version(): string {
    return this._version;
  }

  /** Load underlying models. */
  async load(): Promise<boolean> {
    const [c, e] = await Promise.all([
      this.convergencePredictor.load(),
      this.efficiencyPredictor.load(),
    ]);
    return c || e;
  }

  predict(input: FeatureVector): TurbulenceRecommendation {
    const re = input.reynoldsNumber;
    const ti = input.turbulenceIntensity;
    const meshQuality = input.meshQualityScore;

    // ── Rule-based turbulence model selection ──────────────────────────
    let recommended: TurbulenceType;
    let reasoning: string;

    if (re < 1e4) {
      // Low Re → simple model
      recommended = "spalart-allmaras" as TurbulenceType;
      reasoning = `Low Reynolds number (${re.toFixed(0)}). Spalart-Allmaras is efficient for attached flows.`;
    } else if (re > 1e6) {
      // Very high Re → robust two-equation model
      if (meshQuality > 0.7) {
        recommended = "k-omega-sst" as TurbulenceType;
        reasoning = `High Re (${re.toFixed(0)}) with good mesh quality (${meshQuality.toFixed(2)}). k-ω SST handles adverse pressure gradients well.`;
      } else {
        recommended = "k-epsilon-rng" as TurbulenceType;
        reasoning = `High Re (${re.toFixed(0)}) but mesh quality is limited (${meshQuality.toFixed(2)}). RNG k-ε is more forgiving.`;
      }
    } else {
      // Mid-range Re
      if (ti > 0.1) {
        recommended = "k-epsilon" as TurbulenceType;
        reasoning = `Moderate Re (${re.toFixed(0)}) with high turbulence intensity (${(ti * 100).toFixed(1)}%). Standard k-ε handles free-stream turbulence well.`;
      } else {
        recommended = "k-omega-sst" as TurbulenceType;
        reasoning = `Moderate Re (${re.toFixed(0)}) with low turbulence intensity. k-ω SST provides best all-round accuracy.`;
      }
    }

    // ── Confidence from surrogate models if available ──────────────────
    const convergence = this.convergencePredictor.predict(input);
    const efficiency = this.efficiencyPredictor.predict(input);

    // Blend heuristic base confidence with model backing
    const baseConfidence = 0.6;
    const modelBoost = (convergence.confidence + efficiency.confidence) / 2 * 0.4;
    const confidence = Math.min(1, baseConfidence + modelBoost);

    return {
      value: 0, // not applicable for recommendation models
      confidence: Math.round(confidence * 100) / 100,
      label: recommended,
      recommendedModel: recommended,
      reasoning,
    };
  }

  /**
   * Training is delegated to the underlying convergence/efficiency predictors.
   * The turbulence recommendation itself is heuristic-based (v1).
   */
  async train(data: TrainingData[]): Promise<void> {
    await Promise.all([
      this.convergencePredictor.train(data),
      this.efficiencyPredictor.train(data),
    ]);
    this._version = `1.1.0-hybrid-v${this.convergencePredictor.version}`;
  }
}
