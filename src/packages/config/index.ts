// ─── packages/config ────────────────────────────────────────────────────────
// Centralised, immutable configuration constants for the FlowForge platform.
// All tuneable values live here — modules never hardcode thresholds.
// ─────────────────────────────────────────────────────────────────────────────

import type { UserTier, RetryConfig } from "@/packages/types";

// ── Mesh Quality Thresholds ─────────────────────────────────────────────────

export const MESH_QUALITY = {
  maxSkewness: 0.85,
  maxAspectRatio: 20,
  yPlusLow: 30,
  yPlusHigh: 300,
  wallResolvedYPlus: 1,
  highSkewness: 0.85,
  lowOrthogonality: 0.5,
  highAspectRatio: 100,
} as const;

// ── Convergence Diagnostics ─────────────────────────────────────────────────

export const CONVERGENCE = {
  divergenceSlopeThreshold: 0.01,
  stagnationSlopeMagnitude: 0.002,
  oscillationAmplitudeThreshold: 0.5,
  trendWindowFraction: 0.25,
  minTrendWindow: 20,
} as const;

// ── Solver Defaults ─────────────────────────────────────────────────────────

export const SOLVER_DEFAULTS = {
  maxIterations: 2000,
  convergenceCriteria: 1e-6,
  relaxation: {
    pressure: 0.3,
    velocity: 0.7,
    turbulence: 0.8,
  },
  retry: {
    maxRetries: 3,
    baseDelayMs: 1_000,
    maxDelayMs: 30_000,
    backoffMultiplier: 2,
  } satisfies RetryConfig,
  pollingIntervalMs: 5_000,
  maxPollingDurationMs: 7_200_000, // 2 hours
  timeoutMs: 30_000,
} as const;

// ── Compute / Billing Tier Limits ───────────────────────────────────────────

export interface TierLimits {
  cpuHours: number;
  gpuHours: number;
  memoryGB: number;
  maxSimulationDurationHours: number;
  costPerCpuHour: number;
  costPerGpuHour: number;
  costPerGBHour: number;
}

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: {
    cpuHours: 50,
    gpuHours: 5,
    memoryGB: 16,
    maxSimulationDurationHours: 4,
    costPerCpuHour: 0,
    costPerGpuHour: 0,
    costPerGBHour: 0,
  },
  pro: {
    cpuHours: 500,
    gpuHours: 100,
    memoryGB: 64,
    maxSimulationDurationHours: 24,
    costPerCpuHour: 0.12,
    costPerGpuHour: 0.85,
    costPerGBHour: 0.015,
  },
  enterprise: {
    cpuHours: 5000,
    gpuHours: 1000,
    memoryGB: 256,
    maxSimulationDurationHours: 168,
    costPerCpuHour: 0.08,
    costPerGpuHour: 0.60,
    costPerGBHour: 0.01,
  },
} as const;

export const USAGE_THRESHOLDS = {
  warningPercent: 0.75,
  criticalPercent: 0.90,
} as const;

// ── Rotating Machinery ──────────────────────────────────────────────────────

export const ROTATING_MACHINERY = {
  minRPM: 50,
  maxRPM: 50_000,
  maxBladeCount: 100,
  /** Typical chord-to-radius ratio for estimation */
  chordRadiusRatio: 0.3,
  /** Typical span-to-radius ratio */
  spanRadiusRatio: 0.8,
} as const;

// ── AI Agent ────────────────────────────────────────────────────────────────

export const AGENT = {
  intentConfidenceThreshold: 0.5,
  memoryCacheTTL: 3600,
  diagnosticCacheTTL: 7200,
  planCacheTTL: 86400,
  maxSimilarIssues: 3,
} as const;

// ── Feature Flags ───────────────────────────────────────────────────────────

export const FEATURES = {
  enableHeatTransfer: true,
  enableTransientSolver: true,
  enableRotatingMachinery: true,
  enableAIAgent: true,
  enableSurrogateModels: false,
  enableBenchmarking: false,
} as const;

// ── Turbulence Model Feature Flags ──────────────────────────────────────────
// Controls visibility of experimental turbulence models in production.
// Set to `true` to expose a model in the Simulation Builder UI.

export const TURBULENCE_FLAGS = {
  /** Standard k-ε — always available */
  kEpsilon: true,
  /** k-ω SST — always available */
  sst: true,
  /** k-ε RNG variant — experimental */
  kEpsilonRNG: false,
  /** Spalart–Allmaras — experimental */
  spalartAllmaras: false,
} as const;

export type TurbulenceFlagKey = keyof typeof TURBULENCE_FLAGS;
