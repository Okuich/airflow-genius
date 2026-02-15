// ─── Surrogate Pipeline Orchestrator ───────────────────────────────────────
// Wires all 7 steps together: event → extract → label → normalize →
// train → version → recommend. Subscribes to the event bus and
// automatically enriches the training set + retrains when enough data.
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
import { DiagnosticLabeler } from "./diagnostic-labeler";
import { DataNormalizer } from "./data-normalizer";
import { SurrogateTrainer, type TrainingDataPoint } from "./surrogate-trainer";
import { ModelVersionManager } from "./model-version-manager";

const RETRAIN_THRESHOLD = 10; // retrain after every N new samples

export class SurrogatePipeline {
  private readonly eventBus: SimulationEventBus;
  private readonly extractor = new FeatureExtractor();
  private readonly labeler = new DiagnosticLabeler();
  private readonly normalizer = new DataNormalizer();
  private readonly trainer = new SurrogateTrainer();
  private readonly versionManager: ModelVersionManager;
  private pendingCount: Map<string, number> = new Map(); // orgId → count since last train

  constructor(eventBus: SimulationEventBus, versionManager?: ModelVersionManager) {
    this.eventBus = eventBus;
    this.versionManager = versionManager ?? new ModelVersionManager();

    // Auto-subscribe to simulation completed events
    this.eventBus.onSimulationCompleted((event) => this.handleCompleted(event));
  }

  /** Handle a simulation-completed event: extract, label, persist, maybe retrain. */
  async handleCompleted(event: SimulationCompletedEvent): Promise<void> {
    try {
      // Step 2: Feature Extraction
      const features = this.extractor.extractFromEvent(event);

      // Step 3: Diagnostic Labeling
      const labels = this.labeler.label(event);

      // Persist to DB
      await this.persistTrainingData(event, features, labels);

      // Track pending samples per org
      const count = (this.pendingCount.get(event.organizationId) ?? 0) + 1;
      this.pendingCount.set(event.organizationId, count);

      // Retrain if threshold reached
      if (count >= RETRAIN_THRESHOLD) {
        await this.retrainAll(event.organizationId);
        this.pendingCount.set(event.organizationId, 0);
      }
    } catch (err) {
      console.error("[SurrogatePipeline] Error processing event:", err);
    }
  }

  /** Force retrain all three model types for an organization. */
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

  /** Train a single surrogate model type. */
  async trainModel(orgId: string, modelType: SurrogateModelType): Promise<void> {
    // Fetch all training data for this org
    const { data: rows, error } = await supabase
      .from("ml_training_data")
      .select("features, labels")
      .eq("organization_id", orgId);

    if (error) throw error;
    if (!rows || rows.length < 5) return; // not enough data

    // Build training dataset
    const featureArrays: number[][] = [];
    const targets: number[] = [];

    for (const row of rows) {
      const features = row.features as unknown as SimulationFeatureVector;
      const labels = row.labels as unknown as SimulationLabels;

      if (!this.labeler.isValidFor(labels, modelType)) continue;

      const target = this.labeler.getTarget(labels, modelType);
      if (target === null) continue;

      featureArrays.push(this.extractor.toArray(features));
      targets.push(target);
    }

    if (featureArrays.length < 5) return;

    // Step 4: Normalize
    const { normalized, params } = this.normalizer.fitTransform(featureArrays);

    // Step 5: Train
    const trainingData: TrainingDataPoint[] = normalized.map((f, i) => ({
      features: f,
      target: targets[i],
    }));

    const { weights, metrics } = this.trainer.train(trainingData, modelType);

    // Step 6: Version
    await this.versionManager.saveVersion(orgId, modelType, weights, params, metrics);

    console.log(
      `[SurrogatePipeline] Trained ${modelType} v${metrics.sampleCount} — R²=${metrics.r2.toFixed(3)}, MAE=${metrics.mae.toFixed(3)}`
    );
  }

  // ── Private ─────────────────────────────────────────────────────────

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
