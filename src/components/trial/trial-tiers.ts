import type { LucideIcon } from "lucide-react";
import { Wind, Eye, Shield, Brain, Microscope, Gauge, Snowflake, Server, Network, BarChart3 } from "lucide-react";

export interface TrialTier {
  id: string;
  label: string;
  description: string;
  allowedPaths: string[];
}

/**
 * Maps industry selection → trial tier with feature-gated pages.
 * "full" tier has access to everything.
 */
export const TRIAL_TIERS: Record<string, TrialTier> = {
  full: {
    id: "full",
    label: "Full Access",
    description: "Complete platform access across all modules.",
    allowedPaths: [
      "/", "/builder", "/viewer", "/compliance", "/ml-pipeline",
      "/explainability", "/solver-status", "/cleanroom", "/datacenter", "/architecture",
    ],
  },
  cleanroom: {
    id: "cleanroom",
    label: "Cleanroom & Pharma",
    description: "ISO classification, particle monitoring, and compliance.",
    allowedPaths: [
      "/", "/builder", "/viewer", "/compliance", "/cleanroom", "/solver-status",
    ],
  },
  "data-center": {
    id: "data-center",
    label: "Data Center Cooling",
    description: "Thermal maps, PUE forecasting, and cooling diagnostics.",
    allowedPaths: [
      "/", "/builder", "/viewer", "/datacenter", "/solver-status", "/compliance",
    ],
  },
  hvac: {
    id: "hvac",
    label: "HVAC & Ventilation",
    description: "Duct simulation, airflow analysis, and compliance.",
    allowedPaths: [
      "/", "/builder", "/viewer", "/compliance", "/solver-status",
    ],
  },
  automotive: {
    id: "automotive",
    label: "Automotive & Aerospace",
    description: "External aerodynamics, parameter sweeps, and ML pipeline.",
    allowedPaths: [
      "/", "/builder", "/viewer", "/ml-pipeline", "/explainability", "/solver-status",
    ],
  },
  energy: {
    id: "energy",
    label: "Energy & Power",
    description: "Turbomachinery, rotating frames, and solver monitoring.",
    allowedPaths: [
      "/", "/builder", "/viewer", "/solver-status", "/explainability",
    ],
  },
  industrial: {
    id: "industrial",
    label: "Industrial Process",
    description: "Exhaust optimization, mixing analysis, and compliance.",
    allowedPaths: [
      "/", "/builder", "/viewer", "/compliance", "/solver-status",
    ],
  },
  other: {
    id: "other",
    label: "General Access",
    description: "Core CFD simulation capabilities.",
    allowedPaths: [
      "/", "/builder", "/viewer", "/compliance", "/solver-status",
    ],
  },
};

/** Maps industry value from signup form → trial tier id */
export function industryToTierId(industry: string): string {
  const map: Record<string, string> = {
    hvac: "hvac",
    "data-center": "data-center",
    cleanroom: "cleanroom",
    industrial: "industrial",
    automotive: "automotive",
    energy: "energy",
    other: "other",
  };
  return map[industry] || "full";
}

export function getTierById(tierId: string): TrialTier {
  return TRIAL_TIERS[tierId] || TRIAL_TIERS.full;
}

export function isPathAllowed(tierId: string, path: string): boolean {
  const tier = getTierById(tierId);
  // "full" tier allows everything
  if (tier.id === "full") return true;
  return tier.allowedPaths.includes(path);
}
