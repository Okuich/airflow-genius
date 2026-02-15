// ─── Metric-Standard Links ─────────────────────────────────────────────────
// Maps CFD metric names to the regulatory standards that reference them.
// ──────────────────────────────────────────────────────────────────────────

import type { MetricStandardLink } from "./types";

export const METRIC_STANDARD_LINKS: MetricStandardLink[] = [
  { metric: "outdoorAirRate", standards: ["ASHRAE_62.1", "EN_16798"], label: "Outdoor Air Rate", unit: "L/s/person" },
  { metric: "exhaustAirflow", standards: ["ASHRAE_62.1"], label: "Exhaust Airflow", unit: "L/s/m²" },
  { metric: "operativeTemperature", standards: ["ASHRAE_55", "EN_16798"], label: "Operative Temperature", unit: "°C" },
  { metric: "maxAirSpeed", standards: ["ASHRAE_55"], label: "Maximum Air Speed", unit: "m/s" },
  { metric: "airChangeRate", standards: ["ISO_14644"], label: "Air Change Rate", unit: "ACH" },
  { metric: "laminarCoverage", standards: ["ISO_14644"], label: "Laminar Flow Coverage", unit: "fraction" },
  { metric: "recoveryTime", standards: ["ISO_14644"], label: "Recovery Time (99%)", unit: "s" },
  { metric: "peakConcentration", standards: ["OSHA_PEL"], label: "Peak Contaminant Concentration", unit: "ppm" },
  { metric: "twaConcentration", standards: ["OSHA_PEL", "ACGIH_TLV"], label: "8-Hour TWA Concentration", unit: "ppm" },
  { metric: "captureVelocity", standards: ["ACGIH_TLV"], label: "Hood Capture Velocity", unit: "m/s" },
  { metric: "faceVelocity", standards: ["NFPA_45"], label: "Fume Hood Face Velocity", unit: "m/s" },
  { metric: "ammoniaConcentration", standards: ["OSHA_PEL", "ACGIH_TLV"], label: "Ammonia Concentration", unit: "ppm" },
  { metric: "estimatedPUE", standards: ["ASHRAE_90.4"], label: "Estimated PUE", unit: "ratio" },
  { metric: "rackInletTemp", standards: ["TIA_942", "NEBS_GR_3028"], label: "Rack Inlet Temperature", unit: "°C" },
];

/**
 * Look up which standards reference a given metric.
 */
export function getStandardsForMetric(metric: string): MetricStandardLink | undefined {
  return METRIC_STANDARD_LINKS.find((l) => l.metric === metric);
}

/**
 * Get all metric names that map to a given standard.
 */
export function getMetricsForStandard(standard: string): string[] {
  return METRIC_STANDARD_LINKS
    .filter((l) => l.standards.includes(standard as any))
    .map((l) => l.metric);
}
