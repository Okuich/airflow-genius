// ─── Step 4: Data Normalization ────────────────────────────────────────────
// Z-score normalization for feature vectors. Computes and stores μ/σ
// so the same transform can be applied at inference time.
// ──────────────────────────────────────────────────────────────────────────

import type { NormalizationParams, SimulationFeatureVector } from "@/packages/types";
import { FeatureExtractor } from "./feature-extractor";

export class DataNormalizer {
  private params: NormalizationParams | null = null;

  /** Fit normalization parameters from a dataset of feature arrays. */
  fit(dataset: number[][]): NormalizationParams {
    const n = dataset.length;
    if (n === 0) throw new Error("Cannot fit normalizer on empty dataset");

    const dim = dataset[0].length;
    const mean = new Array(dim).fill(0);
    const std = new Array(dim).fill(0);

    // Compute mean
    for (const row of dataset) {
      for (let j = 0; j < dim; j++) mean[j] += row[j];
    }
    for (let j = 0; j < dim; j++) mean[j] /= n;

    // Compute std
    for (const row of dataset) {
      for (let j = 0; j < dim; j++) std[j] += (row[j] - mean[j]) ** 2;
    }
    for (let j = 0; j < dim; j++) {
      std[j] = Math.sqrt(std[j] / n);
      if (std[j] < 1e-12) std[j] = 1; // prevent division by zero
    }

    this.params = {
      mean,
      std,
      featureNames: [...FeatureExtractor.FEATURE_NAMES],
    };

    return this.params;
  }

  /** Load pre-computed normalization params (e.g. from DB). */
  loadParams(params: NormalizationParams): void {
    this.params = params;
  }

  /** Transform a single feature array using fitted params. */
  transform(features: number[]): number[] {
    if (!this.params) throw new Error("Normalizer not fitted. Call fit() or loadParams() first.");
    return features.map((v, i) => (v - this.params!.mean[i]) / this.params!.std[i]);
  }

  /** Fit and transform in one step. */
  fitTransform(dataset: number[][]): { normalized: number[][]; params: NormalizationParams } {
    const params = this.fit(dataset);
    const normalized = dataset.map((row) => this.transform(row));
    return { normalized, params };
  }

  /** Transform a SimulationFeatureVector directly. */
  transformFeatures(features: SimulationFeatureVector): number[] {
    const extractor = new FeatureExtractor();
    const arr = extractor.toArray(features);
    return this.transform(arr);
  }

  getParams(): NormalizationParams | null {
    return this.params;
  }
}
