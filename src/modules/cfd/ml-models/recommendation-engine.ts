// ─── Step 7: Recommendation Engine Update ──────────────────────────────────
// Uses trained surrogate models to generate actionable recommendations
// for improving simulation setups before running them.
// ──────────────────────────────────────────────────────────────────────────

import type {
  SimulationConfig,
  SimulationFeatureVector,
  SurrogatePrediction,
  SurrogateRecommendation,
  SurrogateModelType,
} from "@/packages/types";
import { FeatureExtractor } from "./feature-extractor";
import { DataNormalizer } from "./data-normalizer";
import { SurrogateTrainer } from "./surrogate-trainer";
import { ModelVersionManager } from "./model-version-manager";

export class RecommendationEngine {
  private readonly extractor = new FeatureExtractor();
  private readonly normalizer = new DataNormalizer();
  private readonly trainer = new SurrogateTrainer();
  private readonly versionManager: ModelVersionManager;

  constructor(versionManager?: ModelVersionManager) {
    this.versionManager = versionManager ?? new ModelVersionManager();
  }

  /** Predict all three targets for a given simulation config. */
  async predict(
    config: SimulationConfig,
    orgId: string
  ): Promise<SurrogatePrediction[]> {
    const features = this.extractor.extract(config);
    const featureArray = this.extractor.toArray(features);

    const modelTypes: SurrogateModelType[] = ["pressure_drop", "convergence", "efficiency"];
    const predictions: SurrogatePrediction[] = [];

    for (const modelType of modelTypes) {
      const model = await this.versionManager.getActiveModel(orgId, modelType);
      if (!model) continue;

      this.normalizer.loadParams(model.normalization);
      const normalized = this.normalizer.transform(featureArray);
      const value = this.trainer.predict(normalized, model.weights);
      const confidence = this.trainer.confidence(model.metrics);

      predictions.push({
        modelType,
        value,
        confidence,
        modelVersion: model.version,
      });
    }

    return predictions;
  }

  /** Generate human-readable recommendations based on predictions. */
  async recommend(
    config: SimulationConfig,
    orgId: string
  ): Promise<SurrogateRecommendation[]> {
    const predictions = await this.predict(config, orgId);
    const recommendations: SurrogateRecommendation[] = [];
    const features = this.extractor.extract(config);

    for (const pred of predictions) {
      if (pred.confidence < 0.3) continue; // too uncertain

      recommendations.push(...this.generateForPrediction(pred, features));
    }

    // Sort by confidence descending
    recommendations.sort((a, b) => b.confidence - a.confidence);
    return recommendations;
  }

  // ── Private ─────────────────────────────────────────────────────────

  private generateForPrediction(
    pred: SurrogatePrediction,
    features: SimulationFeatureVector
  ): SurrogateRecommendation[] {
    const recs: SurrogateRecommendation[] = [];

    switch (pred.modelType) {
      case "pressure_drop":
        if (pred.value > 1000) {
          recs.push({
            type: "mesh",
            message: "High predicted pressure drop — consider refining the mesh near inlet/outlet boundaries.",
            confidence: pred.confidence,
            predictedImprovement: `Reducing from ~${pred.value.toFixed(0)} Pa`,
          });
          if (features.refinementLevels < 4) {
            recs.push({
              type: "mesh",
              message: "Increasing refinement levels from " + features.refinementLevels + " to " + (features.refinementLevels + 1) + " may improve accuracy.",
              confidence: pred.confidence * 0.8,
              predictedImprovement: "Better resolution of pressure gradients",
            });
          }
        }
        break;

      case "convergence":
        if (pred.value < 0.5) {
          recs.push({
            type: "solver",
            message: "Model predicts convergence risk. Consider lowering relaxation factors.",
            confidence: pred.confidence,
            predictedImprovement: "Improved convergence stability",
          });
          if (features.relaxationPressure > 0.3) {
            recs.push({
              type: "solver",
              message: `Reduce pressure relaxation from ${features.relaxationPressure} to ${Math.max(0.1, features.relaxationPressure - 0.1).toFixed(1)} for better stability.`,
              confidence: pred.confidence * 0.9,
              predictedImprovement: "Reduced divergence risk",
            });
          }
          if (features.reynoldsNumber > 1e6) {
            recs.push({
              type: "boundary",
              message: "High Reynolds number detected — ensure boundary layer resolution is adequate.",
              confidence: pred.confidence * 0.7,
              predictedImprovement: "Better near-wall behavior",
            });
          }
        }
        break;

      case "efficiency":
        if (pred.value < 1.5) { // mapping: 0=Poor, 1=Avg, 2=Good, 3=Excellent
          recs.push({
            type: "general",
            message: "Surrogate model predicts below-average efficiency. Review blade geometry and tip clearance.",
            confidence: pred.confidence,
            predictedImprovement: "Potential efficiency improvement to 'Good' or above",
          });
          if (features.hasRotatingFrame && features.rpm > 0) {
            recs.push({
              type: "mesh",
              message: "For rotating machinery, ensure adequate mesh resolution at the rotor-stator interface.",
              confidence: pred.confidence * 0.85,
              predictedImprovement: "Better torque and pressure rise prediction",
            });
          }
        }
        break;
    }

    return recs;
  }
}
