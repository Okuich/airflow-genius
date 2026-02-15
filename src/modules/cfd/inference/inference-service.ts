// ─── Inference Service ─────────────────────────────────────────────────────
// Local inference with three domain methods:
//   • predictConvergence()
//   • predictEfficiency()
//   • recommendTurbulenceModel()
//
// Loads the latest deployed model from ModelRegistry per org + type.
// Falls back to heuristic defaults when no trained model exists.
// ──────────────────────────────────────────────────────────────────────────

import type {
  FeatureVector,
  SurrogateModelType,
  SurrogateModelWeights,
  SurrogateModelMetrics,
  NormalizationParams,
  TurbulenceType,
} from "@/packages/types";
import { ModelRegistry } from "../ml-models/model-registry";
import { DataNormalizer } from "../ml-models/data-normalizer";
import { MLTrainingJob } from "../ml-models/ml-training-job";
import { FeatureExtractor } from "../ml-models/feature-extractor";

// ── Public Types ──────────────────────────────────────────────────────────

export interface ConvergencePrediction {
  likelihood: number;
  label: "likely-converge" | "risk-diverge";
  confidence: number;
  source: "model" | "fallback";
  modelVersion: number | null;
}

export interface EfficiencyPrediction {
  score: number;
  label: "Excellent" | "Good" | "Average" | "Poor";
  confidence: number;
  source: "model" | "fallback";
  modelVersion: number | null;
}

export interface TurbulenceRecommendation {
  recommended: TurbulenceType;
  reasoning: string;
  confidence: number;
  alternatives: { model: TurbulenceType; reason: string }[];
  source: "model" | "fallback";
}

// ── Health Check Types ───────────────────────────────────────────────────

export interface RegistryHealthStatus {
  healthy: boolean;
  registryReachable: boolean;
  lastCheckAt: string;
  cachedModelCount: number;
  fallbackActive: boolean;
  error?: string;
}

export interface CacheStats {
  entries: number;
  modelTypes: string[];
  orgIds: string[];
}

// ── Cached model bundle ───────────────────────────────────────────────────

interface LoadedModel {
  weights: SurrogateModelWeights;
  normalization: NormalizationParams;
  metrics: SurrogateModelMetrics;
  version: number;
}

// ── Efficiency label thresholds ───────────────────────────────────────────

const EFFICIENCY_LABELS: [number, EfficiencyPrediction["label"]][] = [
  [0.75, "Excellent"],
  [0.50, "Good"],
  [0.25, "Average"],
  [0.00, "Poor"],
];

function efficiencyLabel(score: number): EfficiencyPrediction["label"] {
  const clamped = Math.max(0, Math.min(1, score));
  return EFFICIENCY_LABELS.find(([t]) => clamped >= t)?.[1] ?? "Poor";
}

// ── Service ───────────────────────────────────────────────────────────────

export class InferenceService {
  private readonly registry: ModelRegistry;
  private readonly normalizer = new DataNormalizer();
  private readonly trainer = new MLTrainingJob();
  private readonly extractor = new FeatureExtractor();
  private readonly cache = new Map<string, LoadedModel>();

  constructor(registry?: ModelRegistry) {
    this.registry = registry ?? new ModelRegistry();
  }

  // ── 1. Predict Convergence ──────────────────────────────────────────────

  async predictConvergence(
    orgId: string,
    input: FeatureVector
  ): Promise<ConvergencePrediction> {
    const model = await this.loadModel(orgId, "convergence");

    if (!model) {
      return this.fallbackConvergence(input);
    }

    const value = this.runInference(model, input);
    const clamped = Math.max(0, Math.min(1, value));
    const confidence = this.trainer.confidence(model.metrics);

    return {
      likelihood: Math.round(clamped * 10000) / 10000,
      label: clamped >= 0.5 ? "likely-converge" : "risk-diverge",
      confidence,
      source: "model",
      modelVersion: model.version,
    };
  }

  // ── 2. Predict Efficiency ───────────────────────────────────────────────

  async predictEfficiency(
    orgId: string,
    input: FeatureVector
  ): Promise<EfficiencyPrediction> {
    const model = await this.loadModel(orgId, "efficiency");

    if (!model) {
      return this.fallbackEfficiency(input);
    }

    const value = this.runInference(model, input);
    const clamped = Math.max(0, Math.min(1, value));
    const confidence = this.trainer.confidence(model.metrics);

    return {
      score: Math.round(clamped * 10000) / 10000,
      label: efficiencyLabel(clamped),
      confidence,
      source: "model",
      modelVersion: model.version,
    };
  }

  // ── 3. Recommend Turbulence Model ───────────────────────────────────────

  async recommendTurbulenceModel(
    orgId: string,
    input: FeatureVector
  ): Promise<TurbulenceRecommendation> {
    // Turbulence recommendation is heuristic-first, boosted by surrogate
    // confidence scores when convergence/efficiency models are available.
    const re = input.reynoldsNumber;
    const ti = input.turbulenceIntensity;
    const mq = input.meshQualityScore;

    let recommended: TurbulenceType;
    let reasoning: string;
    const alternatives: TurbulenceRecommendation["alternatives"] = [];

    if (re < 1e4) {
      recommended = "spalart-allmaras" as TurbulenceType;
      reasoning = `Low Re (${re.toFixed(0)}). Spalart-Allmaras is efficient for attached boundary layers.`;
      alternatives.push({
        model: "k-omega-sst" as TurbulenceType,
        reason: "More robust if mild separation is expected.",
      });
    } else if (re > 1e6) {
      if (mq > 0.7) {
        recommended = "k-omega-sst" as TurbulenceType;
        reasoning = `High Re (${re.toFixed(0)}) with good mesh (${mq.toFixed(2)}). k-ω SST handles adverse pressure gradients.`;
        alternatives.push({
          model: "k-epsilon-rng" as TurbulenceType,
          reason: "Cheaper if wall resolution is limited.",
        });
      } else {
        recommended = "k-epsilon-rng" as TurbulenceType;
        reasoning = `High Re (${re.toFixed(0)}) but limited mesh quality (${mq.toFixed(2)}). RNG k-ε is more forgiving.`;
        alternatives.push({
          model: "k-omega-sst" as TurbulenceType,
          reason: "Better accuracy if mesh is refined.",
        });
      }
    } else {
      if (ti > 0.1) {
        recommended = "k-epsilon" as TurbulenceType;
        reasoning = `Moderate Re (${re.toFixed(0)}) with high turbulence intensity (${(ti * 100).toFixed(1)}%). Standard k-ε handles free-stream turbulence.`;
        alternatives.push({
          model: "k-omega-sst" as TurbulenceType,
          reason: "Better near-wall accuracy.",
        });
      } else {
        recommended = "k-omega-sst" as TurbulenceType;
        reasoning = `Moderate Re (${re.toFixed(0)}) with low TI. k-ω SST provides best all-round accuracy.`;
        alternatives.push({
          model: "k-epsilon" as TurbulenceType,
          reason: "Faster convergence if accuracy is less critical.",
        });
      }
    }

    // Boost confidence with surrogate models if available
    const [convModel, effModel] = await Promise.all([
      this.loadModel(orgId, "convergence"),
      this.loadModel(orgId, "efficiency"),
    ]);

    const baseConfidence = 0.6;
    let modelBoost = 0;
    if (convModel) modelBoost += this.trainer.confidence(convModel.metrics) * 0.2;
    if (effModel) modelBoost += this.trainer.confidence(effModel.metrics) * 0.2;
    const confidence = Math.min(1, Math.round((baseConfidence + modelBoost) * 100) / 100);

    return {
      recommended,
      reasoning,
      confidence,
      alternatives,
      source: convModel || effModel ? "model" : "fallback",
    };
  }

  // ── Invalidate cache (e.g. after retraining) ───────────────────────────

  invalidateCache(orgId?: string, modelType?: SurrogateModelType): void {
    if (orgId && modelType) {
      this.cache.delete(`${orgId}:${modelType}`);
    } else if (orgId) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${orgId}:`)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }

  // ── Health Check ───────────────────────────────────────────────────────

  async healthCheck(orgId: string): Promise<RegistryHealthStatus> {
    const now = new Date().toISOString();
    const cachedModelCount = this.cache.size;

    try {
      // Probe the registry with a lightweight read
      const result = await this.registry.getActiveModel(orgId, "convergence");
      return {
        healthy: true,
        registryReachable: true,
        lastCheckAt: now,
        cachedModelCount,
        fallbackActive: result === null,
      };
    } catch (err) {
      return {
        healthy: false,
        registryReachable: false,
        lastCheckAt: now,
        cachedModelCount,
        fallbackActive: true,
        error: err instanceof Error ? err.message : "Registry unreachable",
      };
    }
  }

  // ── Cache Stats ────────────────────────────────────────────────────────

  getCacheStats(): CacheStats {
    const orgIds = new Set<string>();
    const modelTypes = new Set<string>();
    for (const key of this.cache.keys()) {
      const [org, type] = key.split(":");
      orgIds.add(org);
      modelTypes.add(type);
    }
    return {
      entries: this.cache.size,
      modelTypes: [...modelTypes],
      orgIds: [...orgIds],
    };
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private async loadModel(
    orgId: string,
    modelType: SurrogateModelType
  ): Promise<LoadedModel | null> {
    const cacheKey = `${orgId}:${modelType}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    const active = await this.registry.getActiveModel(orgId, modelType);
    if (!active) return null;

    const loaded: LoadedModel = {
      weights: active.weights,
      normalization: active.normalization,
      metrics: active.metrics,
      version: active.version,
    };

    this.cache.set(cacheKey, loaded);
    return loaded;
  }

  private runInference(model: LoadedModel, input: FeatureVector): number {
    const raw = this.extractor.resultToArray(input);
    this.normalizer.loadParams(model.normalization);
    const normalized = this.normalizer.transform(raw);
    return this.trainer.predict(normalized, model.weights);
  }

  // ── Fallbacks (heuristic-based) ─────────────────────────────────────────

  private fallbackConvergence(input: FeatureVector): ConvergencePrediction {
    // Simple heuristic: good mesh + moderate Re → likely converge
    const meshFactor = input.meshQualityScore;
    const reFactor = input.reynoldsNumber < 1e6 ? 0.8 : 0.5;
    const tiFactor = input.turbulenceIntensity < 0.15 ? 0.9 : 0.6;
    const score = (meshFactor * 0.4 + reFactor * 0.3 + tiFactor * 0.3);

    return {
      likelihood: Math.round(score * 10000) / 10000,
      label: score >= 0.5 ? "likely-converge" : "risk-diverge",
      confidence: 0.3,
      source: "fallback",
      modelVersion: null,
    };
  }

  private fallbackEfficiency(input: FeatureVector): EfficiencyPrediction {
    // Simple heuristic based on available signals
    const meshContrib = input.meshQualityScore * 0.3;
    const convContrib = Math.min(1, input.convergenceSpeed) * 0.3;
    const reContrib = (input.reynoldsNumber < 5e5 ? 0.7 : 0.4) * 0.4;
    const score = meshContrib + convContrib + reContrib;

    return {
      score: Math.round(score * 10000) / 10000,
      label: efficiencyLabel(score),
      confidence: 0.25,
      source: "fallback",
      modelVersion: null,
    };
  }
}
