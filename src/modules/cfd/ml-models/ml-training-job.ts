// ─── Step 5: ML Training Job ───────────────────────────────────────────────
// Ordinary Least Squares linear regression trained entirely in-browser.
// Lightweight, deterministic, no external dependencies.
// ──────────────────────────────────────────────────────────────────────────

import type {
  SurrogateModelWeights,
  SurrogateModelMetrics,
  SurrogateModelType,
} from "@/packages/types";
import { FeatureExtractor } from "./feature-extractor";

export interface TrainingDataPoint {
  features: number[]; // normalized
  target: number;
}

export interface TrainedModel {
  weights: SurrogateModelWeights;
  metrics: SurrogateModelMetrics;
}

export class MLTrainingJob {
  private readonly minSamples = 5;

  /** Train a linear regression model using OLS (normal equation). */
  train(data: TrainingDataPoint[], modelType: SurrogateModelType): TrainedModel {
    if (data.length < this.minSamples) {
      throw new Error(`Need at least ${this.minSamples} samples, got ${data.length}`);
    }

    const n = data.length;
    const dim = data[0].features.length;

    // Build X matrix with bias column [1, x1, x2, ...]
    const X: number[][] = data.map((d) => [1, ...d.features]);
    const y: number[] = data.map((d) => d.target);

    // Normal equation: w = (X^T X)^(-1) X^T y
    const Xt = this.transpose(X);
    const XtX = this.matMul(Xt, X);
    const XtXInv = this.invertMatrix(XtX);
    const Xty = this.matVecMul(Xt, y);
    const w = this.matVecMul2(XtXInv, Xty);

    const intercept = w[0];
    const coefficients = w.slice(1);

    // Compute predictions and metrics
    const predictions = X.map((row) => row.reduce((sum, x, i) => sum + x * w[i], 0));
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    let ssRes = 0, ssTot = 0, absErr = 0;
    for (let i = 0; i < n; i++) {
      ssRes += (y[i] - predictions[i]) ** 2;
      ssTot += (y[i] - yMean) ** 2;
      absErr += Math.abs(y[i] - predictions[i]);
    }

    const mse = ssRes / n;
    const mae = absErr / n;
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return {
      weights: {
        coefficients,
        intercept,
        featureNames: [...FeatureExtractor.FEATURE_NAMES],
      },
      metrics: {
        mse,
        mae,
        r2,
        sampleCount: n,
        trainedAt: new Date().toISOString(),
      },
    };
  }

  /** Predict using trained weights. */
  predict(features: number[], weights: SurrogateModelWeights): number {
    let result = weights.intercept;
    for (let i = 0; i < features.length; i++) {
      result += features[i] * (weights.coefficients[i] ?? 0);
    }
    return result;
  }

  /** Compute a simple confidence score based on R² and sample count. */
  confidence(metrics: SurrogateModelMetrics): number {
    const r2Factor = Math.max(0, metrics.r2);
    const sampleFactor = Math.min(1, metrics.sampleCount / 50);
    return Math.round(r2Factor * sampleFactor * 100) / 100;
  }

  // ── Linear Algebra Helpers ──────────────────────────────────────────

  private transpose(M: number[][]): number[][] {
    const rows = M.length, cols = M[0].length;
    const T: number[][] = Array.from({ length: cols }, () => new Array(rows));
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) T[j][i] = M[i][j];
    return T;
  }

  private matMul(A: number[][], B: number[][]): number[][] {
    const m = A.length, n = B[0].length, k = B.length;
    const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
    for (let i = 0; i < m; i++)
      for (let j = 0; j < n; j++)
        for (let p = 0; p < k; p++) C[i][j] += A[i][p] * B[p][j];
    return C;
  }

  private matVecMul(M: number[][], v: number[]): number[] {
    return M.map((row) => row.reduce((sum, val, j) => sum + val * v[j], 0));
  }

  private matVecMul2(M: number[][], v: number[]): number[] {
    return this.matVecMul(M, v);
  }

  private invertMatrix(M: number[][]): number[][] {
    const n = M.length;
    // Augmented matrix [M | I]
    const aug: number[][] = M.map((row, i) => {
      const augRow = [...row, ...new Array(n).fill(0)];
      augRow[n + i] = 1;
      return augRow;
    });

    // Gauss-Jordan elimination
    for (let col = 0; col < n; col++) {
      // Partial pivoting
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
      }
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

      const pivot = aug[col][col];
      if (Math.abs(pivot) < 1e-12) {
        // Singular matrix — add small regularization
        aug[col][col] = 1e-8;
      }

      const scale = 1 / aug[col][col];
      for (let j = 0; j < 2 * n; j++) aug[col][j] *= scale;

      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const factor = aug[row][col];
        for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
      }
    }

    return aug.map((row) => row.slice(n));
  }
}
