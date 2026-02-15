// ─── Surrogate Pipeline Orchestrator ───────────────────────────────────────
// Wires all steps together: event → extract → classify → normalize →
// train → register → recommend.
// ──────────────────────────────────────────────────────────────────────────

import type {
  SimulationCompletedEvent,
  SimulationFeatureVector,
  SimulationLabels,
  SurrogateModelType,
} from "@/packages/types";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { SimulationEventBus } from "./simulation-event-bus";
import { FeatureExtractor } from "./feature-extractor";
import { DiagnosticClassifier } from "./diagnostic-classifier";
import { DataNormalizer } from "./data-normalizer";
import { MLTrainingJob, type TrainingDataPoint } from "./ml-training-job";
import { ModelRegistry } from "./model-registry";

const RETRAIN_THRESHOLD = 10;

export class SurrogatePipeline {
  private readonly eventBus: SimulationEventBus;
  private readonly extractor = new FeatureExtractor();
  private readonly classifier = new DiagnosticClassifier();
  private readonly normalizer = new DataNormalizer();
  private readonly trainer = new MLTrainingJob();
  private readonly registry: ModelRegistry;
  private pendingCount: Map<string, number> = new Map();

  constructor(eventBus: SimulationEventBus, registry?: ModelRegistry) {
    this.eventBus = eventBus;
    this.registry = registry ?? new ModelRegistry();
    this.eventBus.onSimulationCompleted((event) => this.handleCompleted(event));
  }

  async handleCompleted(event: SimulationCompletedEvent): Promise<void> {
    try {
      const features = this.extractor.extractFromEvent(event);
      const labels = this.classifier.label(event);
      await this.persistTrainingData(event, features, labels);

      const count = (this.pendingCount.get(event.organizationId) ?? 0) + 1;
      this.pendingCount.set(event.organizationId, count);

      if (count >= RETRAIN_THRESHOLD) {
        await this.retrainAll(event.organizationId);
        this.pendingCount.set(event.organizationId, 0);
      }
    } catch (err) {
      console.error("[SurrogatePipeline] Error processing event:", err);
    }
  }

  async retrainAll(orgId: string): Promise<void> {
    const modelTypes: SurrogateModelType[] = ["pressure_drop", "convergence", "efficiency"];
    for (const modelType of modelTypes) {
      try {
        await this.trainModel(orgId, modelType);
      } catch (err) {
        console.warn(`[SurrogatePipeline] Failed to train ${modelType}:`, err);
      }
    }
  }

  async trainModel(orgId: string, modelType: SurrogateModelType): Promise<void> {
    const { data: rows, error } = await supabase
      .from("ml_training_data")
      .select("features, labels")
      .eq("organization_id", orgId);

    if (error) throw error;
    if (!rows || rows.length < 5) return;

    const featureArrays: number[][] = [];
    const targets: number[] = [];

    for (const row of rows) {
      const features = row.features as unknown as SimulationFeatureVector;
      const labels = row.labels as unknown as SimulationLabels;
      if (!this.classifier.isValidFor(labels, modelType)) continue;
      const target = this.classifier.getTarget(labels, modelType);
      if (target === null) continue;
      featureArrays.push(this.extractor.toArray(features));
      targets.push(target);
    }

    if (featureArrays.length < 5) return;

    const { normalized, params } = this.normalizer.fitTransform(featureArrays);
    const trainingData: TrainingDataPoint[] = normalized.map((f, i) => ({
      features: f,
      target: targets[i],
    }));

    const { weights, metrics } = this.trainer.train(trainingData, modelType);
    await this.registry.saveVersion(orgId, modelType, weights, params, metrics);

    console.log(
      `[SurrogatePipeline] Trained ${modelType} v${metrics.sampleCount} — R²=${metrics.r2.toFixed(3)}, MAE=${metrics.mae.toFixed(3)}`
    );
  }

  private async persistTrainingData(
    event: SimulationCompletedEvent,
    features: SimulationFeatureVector,
    labels: SimulationLabels
  ): Promise<void> {
    const { error } = await supabase.from("ml_training_data").insert([{
      organization_id: event.organizationId,
      simulation_id: event.simulationId,
      created_by: event.userId,
      features: JSON.parse(JSON.stringify(features)) as Json,
      labels: JSON.parse(JSON.stringify(labels)) as Json,
      feature_version: "v1",
    }]);

    if (error) {
      console.error("[SurrogatePipeline] Failed to persist training data:", error);
    }
  }
}
