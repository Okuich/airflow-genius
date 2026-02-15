// ─── Automatic ISO 14644-1 Classification Engine ────────────────────────────
// Computes ISO class from observed air-change rate trends, laminar stability
// scores, and particle retention measurements. Updates classification
// automatically as new sample windows arrive.
// ─────────────────────────────────────────────────────────────────────────────

export interface CleanroomSample {
  timestamp: number;
  airChangeRate: number;       // ACH
  particleRetention: number;   // fraction 0–1
  laminarStability: number;    // 0–1
}

export interface TrendResult {
  slope: number;        // positive = improving, negative = degrading
  mean: number;
  min: number;
  max: number;
  volatility: number;   // std-dev / mean (coefficient of variation)
}

export interface ISOClassification {
  isoClass: number;                  // 1–9
  confidence: number;                // 0–1
  baseClass: number;                 // class from particle retention alone
  laminarPenalty: number;            // class penalty from poor laminar flow
  acrPenalty: number;                // class penalty from low air changes
  trendAdjustment: number;           // ±1 from trend direction
  reasoning: string[];               // human-readable justification
  trends: {
    acr: TrendResult;
    laminar: TrendResult;
    retention: TrendResult;
  };
  updatedAt: number;
}

export interface ClassifierConfig {
  /** Minimum samples before trend analysis kicks in */
  minTrendSamples: number;
  /** ACH below this triggers a penalty */
  acrMinThreshold: number;
  /** ACH above this gives a bonus */
  acrOptimalThreshold: number;
  /** Laminar stability below this triggers a penalty */
  laminarMinThreshold: number;
  /** Trend slope magnitude to trigger adjustment */
  trendSlopeThreshold: number;
  /** Volatility above this reduces confidence */
  volatilityWarningThreshold: number;
}

export const DEFAULT_CLASSIFIER_CONFIG: ClassifierConfig = {
  minTrendSamples: 6,
  acrMinThreshold: 20,
  acrOptimalThreshold: 50,
  laminarMinThreshold: 0.80,
  trendSlopeThreshold: 0.005,
  volatilityWarningThreshold: 0.15,
};

// ISO 14644-1 particle limits per m³ at ≥0.1 µm
const ISO_PARTICLE_LIMITS: Record<number, number> = {
  1: 10,
  2: 100,
  3: 1_000,
  4: 10_000,
  5: 100_000,
  6: 1_000_000,
  7: 10_000_000,
  8: 100_000_000,
  9: 1_000_000_000,
};

// ─── Trend Computation ──────────────────────────────────────────────────────

export function computeTrend(values: number[]): TrendResult {
  const n = values.length;
  if (n === 0) return { slope: 0, mean: 0, min: 0, max: 0, volatility: 0 };

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Simple linear regression slope
  let sumXY = 0, sumX2 = 0;
  const xMean = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    sumXY += (i - xMean) * (values[i] - mean);
    sumX2 += (i - xMean) ** 2;
  }
  const slope = sumX2 === 0 ? 0 : sumXY / sumX2;

  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const volatility = mean === 0 ? 0 : Math.sqrt(variance) / Math.abs(mean);

  return { slope, mean, min, max, volatility };
}

// ─── Base ISO from Particle Retention ───────────────────────────────────────

function retentionToParticleCount(retention: number): number {
  // Map retention fraction to estimated particle count/m³
  // Higher retention = fewer particles escaping = lower count
  return Math.max(1, Math.round((1 - retention) * 1e7));
}

function particleCountToISO(count: number): number {
  for (let iso = 1; iso <= 9; iso++) {
    if (count <= ISO_PARTICLE_LIMITS[iso]) return iso;
  }
  return 9;
}

// ─── Classifier ─────────────────────────────────────────────────────────────

export class ISOClassifier {
  private readonly config: ClassifierConfig;
  private samples: CleanroomSample[] = [];
  private lastClassification: ISOClassification | null = null;

  constructor(config: Partial<ClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CLASSIFIER_CONFIG, ...config };
  }

  /** Ingest a new sample and recompute classification */
  addSample(sample: CleanroomSample): ISOClassification {
    this.samples.push(sample);
    // Keep a rolling window (max 168 = 1 week hourly)
    if (this.samples.length > 168) {
      this.samples = this.samples.slice(-168);
    }
    this.lastClassification = this.classify();
    return this.lastClassification;
  }

  /** Bulk-load samples (e.g. from time series) */
  loadSamples(samples: CleanroomSample[]): ISOClassification {
    this.samples = samples.slice(-168);
    this.lastClassification = this.classify();
    return this.lastClassification;
  }

  /** Get the latest classification without adding data */
  getClassification(): ISOClassification | null {
    return this.lastClassification;
  }

  /** Classify all zones given per-zone sample arrays */
  static classifyZones(
    zones: Record<string, CleanroomSample[]>,
    config?: Partial<ClassifierConfig>,
  ): Record<string, ISOClassification> {
    const results: Record<string, ISOClassification> = {};
    for (const [zone, samples] of Object.entries(zones)) {
      const classifier = new ISOClassifier(config);
      results[zone] = classifier.loadSamples(samples);
    }
    return results;
  }

  // ── Core classification logic ────────────────────────────────────────────

  private classify(): ISOClassification {
    const { config, samples } = this;
    const reasoning: string[] = [];

    // Trends
    const acrValues = samples.map((s) => s.airChangeRate);
    const laminarValues = samples.map((s) => s.laminarStability);
    const retentionValues = samples.map((s) => s.particleRetention);

    const acrTrend = computeTrend(acrValues);
    const laminarTrend = computeTrend(laminarValues);
    const retentionTrend = computeTrend(retentionValues);

    // 1. Base ISO from avg particle retention
    const avgRetention = retentionTrend.mean;
    const estParticles = retentionToParticleCount(avgRetention);
    const baseClass = particleCountToISO(estParticles);
    reasoning.push(`Base ISO ${baseClass} from avg retention ${(avgRetention * 100).toFixed(2)}% (~${estParticles.toLocaleString()} particles/m³)`);

    // 2. Laminar penalty
    let laminarPenalty = 0;
    if (laminarTrend.mean < config.laminarMinThreshold) {
      laminarPenalty = laminarTrend.mean < 0.6 ? 2 : 1;
      reasoning.push(`Laminar stability ${(laminarTrend.mean * 100).toFixed(1)}% < ${config.laminarMinThreshold * 100}% threshold → +${laminarPenalty} class penalty`);
    }

    // 3. ACR penalty
    let acrPenalty = 0;
    if (acrTrend.mean < config.acrMinThreshold) {
      acrPenalty = 1;
      reasoning.push(`ACH ${acrTrend.mean.toFixed(1)} < ${config.acrMinThreshold} min → +1 class penalty`);
    } else if (acrTrend.mean >= config.acrOptimalThreshold) {
      reasoning.push(`ACH ${acrTrend.mean.toFixed(1)} ≥ ${config.acrOptimalThreshold} optimal — no penalty`);
    }

    // 4. Trend adjustment (only with enough samples)
    let trendAdjustment = 0;
    if (samples.length >= config.minTrendSamples) {
      // Improving retention trend (slope > 0 means retention increasing = good)
      if (retentionTrend.slope > config.trendSlopeThreshold && laminarTrend.slope >= 0) {
        trendAdjustment = -1;
        reasoning.push(`Positive retention trend (slope ${retentionTrend.slope.toFixed(4)}) + stable laminar → −1 class bonus`);
      } else if (retentionTrend.slope < -config.trendSlopeThreshold) {
        trendAdjustment = 1;
        reasoning.push(`Negative retention trend (slope ${retentionTrend.slope.toFixed(4)}) → +1 class penalty`);
      }
    } else {
      reasoning.push(`Only ${samples.length}/${config.minTrendSamples} samples — trend adjustment skipped`);
    }

    // Final class
    const rawClass = baseClass + laminarPenalty + acrPenalty + trendAdjustment;
    const isoClass = Math.max(1, Math.min(9, rawClass));

    // Confidence
    let confidence = 1.0;
    if (samples.length < config.minTrendSamples) confidence *= 0.6;
    if (retentionTrend.volatility > config.volatilityWarningThreshold) {
      confidence *= 0.8;
      reasoning.push(`High retention volatility (${(retentionTrend.volatility * 100).toFixed(1)}%) reduces confidence`);
    }
    if (laminarTrend.volatility > config.volatilityWarningThreshold) {
      confidence *= 0.85;
    }
    confidence = Math.round(confidence * 100) / 100;

    return {
      isoClass,
      confidence,
      baseClass,
      laminarPenalty,
      acrPenalty,
      trendAdjustment,
      reasoning,
      trends: { acr: acrTrend, laminar: laminarTrend, retention: retentionTrend },
      updatedAt: Date.now(),
    };
  }
}
