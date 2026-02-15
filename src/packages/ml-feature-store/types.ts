// ─── packages/ml-feature-store/types ────────────────────────────────────────
// Platform-agnostic type definitions for the ML Feature Store.
// No Supabase or persistence-layer coupling — pure domain contracts.
// ─────────────────────────────────────────────────────────────────────────────

import type { FeatureVector } from "@/packages/types";

// ── Geometry Clusters ───────────────────────────────────────────────────────

export type GeometryCluster =
  | "internal-flow"
  | "external-flow"
  | "rotating-machinery"
  | "heat-exchanger"
  | "cleanroom"
  | "exhaust-system"
  | "agriculture-ventilation"
  | "data-center"
  | "generic";

// ── Feature Store Entries ───────────────────────────────────────────────────

/** A single versioned feature-vector record persisted in the store. */
export interface FeatureStoreEntry {
  id: string;
  simulationId: string | null;
  organizationId: string;
  featureVersion: string;
  featureVector: FeatureVector;
  labels: Record<string, number | null>;
  geometryCluster: GeometryCluster;
  createdAt: string;
}

// ── Query Options ───────────────────────────────────────────────────────────

export interface FeatureQuery {
  organizationId: string;
  geometryCluster?: GeometryCluster;
  featureVersion?: string;
  limit?: number;
}

// ── Training Data ───────────────────────────────────────────────────────────

/** A single training-ready sample: feature array + supervised target. */
export interface TrainingPair {
  features: number[];
  target: number;
}

// ── Ingest Options ──────────────────────────────────────────────────────────

export interface IngestOptions {
  organizationId: string;
  simulationId: string | null;
  featureVector: FeatureVector;
  labels: Record<string, number | null>;
  geometryCluster: GeometryCluster;
  featureVersion: string;
}
