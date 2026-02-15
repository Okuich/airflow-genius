// ─── Cleanroom Telemetry Zod Schemas ────────────────────────────────────────
// Type-safe validation for all cleanroom data ingestion points.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

// ── Sample Schema ───────────────────────────────────────────────────────────

export const CleanroomSampleSchema = z.object({
  timestamp: z
    .number({ required_error: "Timestamp is required" })
    .int("Timestamp must be an integer (epoch ms)")
    .positive("Timestamp must be positive"),
  airChangeRate: z
    .number({ required_error: "Air change rate is required" })
    .min(0, "Air change rate cannot be negative")
    .max(1000, "Air change rate exceeds physical maximum (1000 ACH)"),
  particleRetention: z
    .number({ required_error: "Particle retention is required" })
    .min(0, "Particle retention must be ≥ 0")
    .max(1, "Particle retention must be ≤ 1 (fraction)"),
  laminarStability: z
    .number({ required_error: "Laminar stability is required" })
    .min(0, "Laminar stability must be ≥ 0")
    .max(1, "Laminar stability must be ≤ 1"),
});

export type ValidatedCleanroomSample = z.infer<typeof CleanroomSampleSchema>;

// ── Batch Ingestion Schema ──────────────────────────────────────────────────

export const CleanroomSampleBatchSchema = z
  .array(CleanroomSampleSchema)
  .min(1, "At least one sample is required")
  .max(168, "Maximum 168 samples (1-week hourly window)");

// ── Classifier Config Schema ────────────────────────────────────────────────

export const ClassifierConfigSchema = z.object({
  minTrendSamples: z
    .number()
    .int()
    .min(2, "Need at least 2 samples for trend analysis")
    .max(100)
    .default(6),
  acrMinThreshold: z
    .number()
    .min(0)
    .max(500, "ACR threshold unreasonably high")
    .default(20),
  acrOptimalThreshold: z
    .number()
    .min(0)
    .max(500)
    .default(50),
  laminarMinThreshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.80),
  trendSlopeThreshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.005),
  volatilityWarningThreshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.15),
}).refine(
  (cfg) => cfg.acrMinThreshold < cfg.acrOptimalThreshold,
  { message: "acrMinThreshold must be less than acrOptimalThreshold", path: ["acrMinThreshold"] },
);

export type ValidatedClassifierConfig = z.infer<typeof ClassifierConfigSchema>;

// ── Zone Ingestion Schema ───────────────────────────────────────────────────

export const ZoneIngestionSchema = z.record(
  z.string().min(1, "Zone name cannot be empty").max(100),
  CleanroomSampleBatchSchema,
);

export type ValidatedZoneIngestion = z.infer<typeof ZoneIngestionSchema>;

// ── Validation Helpers ──────────────────────────────────────────────────────

export function validateSample(data: unknown) {
  return CleanroomSampleSchema.safeParse(data);
}

export function validateSampleBatch(data: unknown) {
  return CleanroomSampleBatchSchema.safeParse(data);
}

export function validateClassifierConfig(data: unknown) {
  return ClassifierConfigSchema.safeParse(data);
}

export function validateZoneIngestion(data: unknown) {
  return ZoneIngestionSchema.safeParse(data);
}
