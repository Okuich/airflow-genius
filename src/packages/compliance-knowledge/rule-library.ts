// ─── Rule Library ──────────────────────────────────────────────────────────
// Canonical set of compliance rules derived from regulatory standards.
// Each rule maps a CFD metric to a regulatory threshold.
// ──────────────────────────────────────────────────────────────────────────

import type { ComplianceRule, AirflowComplianceDomain } from "@/packages/types";

export const RULE_LIBRARY: ComplianceRule[] = [
  // ── ASHRAE 62.1 — Ventilation ──────────────────────────────────────────
  { id: "ASHRAE-62.1-6.2", authority: "ASHRAE", standardCode: "62.1 §6.2", description: "Minimum outdoor air rate for breathing zone", metric: "outdoorAirRate", threshold: 2.5, operator: ">=", severity: "Critical" },
  { id: "ASHRAE-62.1-6.4", authority: "ASHRAE", standardCode: "62.1 §6.4", description: "Exhaust airflow for occupied spaces", metric: "exhaustAirflow", threshold: 0.5, operator: ">=", severity: "Medium" },

  // ── ASHRAE 55 — Thermal comfort ────────────────────────────────────────
  { id: "ASHRAE-55-5.3.1a", authority: "ASHRAE", standardCode: "55 §5.3.1", description: "Operative temperature lower bound (cooling season)", metric: "operativeTemperature", threshold: 19.5, operator: ">=", severity: "Medium" },
  { id: "ASHRAE-55-5.3.1b", authority: "ASHRAE", standardCode: "55 §5.3.1", description: "Operative temperature upper bound (cooling season)", metric: "operativeTemperature", threshold: 27.5, operator: "<=", severity: "Medium" },
  { id: "ASHRAE-55-5.3.3", authority: "ASHRAE", standardCode: "55 §5.3.3", description: "Air speed limit for thermal comfort", metric: "maxAirSpeed", threshold: 0.8, operator: "<=", severity: "Low" },

  // ── ISO 14644 — Cleanroom ──────────────────────────────────────────────
  { id: "ISO-14644-4.3", authority: "ISO", standardCode: "14644 §4.3", description: "Air change rate for ISO 5 cleanroom", metric: "airChangeRate", threshold: 240, operator: ">=", severity: "Critical" },
  { id: "ISO-14644-B.4", authority: "ISO", standardCode: "14644 §B.4", description: "Unidirectional flow coverage", metric: "laminarCoverage", threshold: 0.80, operator: ">=", severity: "Critical" },
  { id: "ISO-14644-4.4", authority: "ISO", standardCode: "14644 §4.4", description: "Recovery time to ISO class (99% removal)", metric: "recoveryTime", threshold: 1200, operator: "<=", severity: "Medium" },

  // ── OSHA PEL — Industrial exhaust ──────────────────────────────────────
  { id: "OSHA-PEL-1910.1000", authority: "OSHA", standardCode: "29 CFR 1910.1000", description: "Permissible exposure limit for airborne contaminants", metric: "peakConcentration", threshold: 50, operator: "<=", severity: "Critical" },
  { id: "OSHA-Z1-T1", authority: "OSHA", standardCode: "29 CFR 1910.1000 Z-1", description: "8-hour TWA concentration", metric: "twaConcentration", threshold: 25, operator: "<=", severity: "Critical" },

  // ── ACGIH TLV — Hood capture ───────────────────────────────────────────
  { id: "ACGIH-VS-10", authority: "OSHA", standardCode: "ACGIH VS-10", description: "Minimum hood capture velocity", metric: "captureVelocity", threshold: 0.5, operator: ">=", severity: "Critical" },

  // ── NFPA 45 — Fume hood ────────────────────────────────────────────────
  { id: "NFPA-45-7.8a", authority: "OSHA", standardCode: "NFPA 45 §7.8", description: "Fume hood face velocity lower bound", metric: "faceVelocity", threshold: 0.4, operator: ">=", severity: "Medium" },
  { id: "NFPA-45-7.8b", authority: "OSHA", standardCode: "NFPA 45 §7.8", description: "Fume hood face velocity upper bound", metric: "faceVelocity", threshold: 0.6, operator: "<=", severity: "Medium" },

  // ── Agriculture — ammonia ──────────────────────────────────────────────
  { id: "OSHA-NH3-PEL", authority: "OSHA", standardCode: "29 CFR 1910.1000", description: "Ammonia 8-hr TWA exposure limit", metric: "ammoniaConcentration", threshold: 25, operator: "<=", severity: "Critical" },
  { id: "ACGIH-NH3-TLV", authority: "OSHA", standardCode: "ACGIH TLV-TWA", description: "Ammonia TLV-TWA", metric: "ammoniaConcentration", threshold: 25, operator: "<=", severity: "Medium" },

  // ── ASHRAE 90.4 — Data center energy ───────────────────────────────────
  { id: "ASHRAE-90.4-6.3", authority: "ASHRAE", standardCode: "90.4 §6.3", description: "Maximum mechanical PUE for data center", metric: "estimatedPUE", threshold: 1.4, operator: "<=", severity: "Medium" },

  // ── TIA 942 — Data center thermal ──────────────────────────────────────
  { id: "TIA-942-5.3a", authority: "ISO", standardCode: "TIA 942 §5.3.4", description: "Allowable inlet temperature lower bound", metric: "rackInletTemp", threshold: 18, operator: ">=", severity: "Critical" },
  { id: "TIA-942-5.3b", authority: "ISO", standardCode: "TIA 942 §5.3.4", description: "Allowable inlet temperature upper bound", metric: "rackInletTemp", threshold: 27, operator: "<=", severity: "Critical" },

  // ── NEBS — Telco equipment ─────────────────────────────────────────────
  { id: "NEBS-GR3028-3.1", authority: "ISO", standardCode: "NEBS GR-3028 §3.1", description: "Equipment inlet temperature limit", metric: "rackInletTemp", threshold: 40, operator: "<=", severity: "Critical" },
];

/** Maps rule IDs to their applicable airflow compliance domain. */
export const RULE_DOMAIN_MAP: Record<string, AirflowComplianceDomain> = {
  "ASHRAE-62.1-6.2": "hvac",
  "ASHRAE-62.1-6.4": "hvac",
  "ASHRAE-55-5.3.1a": "hvac",
  "ASHRAE-55-5.3.1b": "hvac",
  "ASHRAE-55-5.3.3": "hvac",
  "ISO-14644-4.3": "cleanroom",
  "ISO-14644-B.4": "cleanroom",
  "ISO-14644-4.4": "cleanroom",
  "OSHA-PEL-1910.1000": "exhaust",
  "OSHA-Z1-T1": "exhaust",
  "ACGIH-VS-10": "exhaust",
  "NFPA-45-7.8a": "exhaust",
  "NFPA-45-7.8b": "exhaust",
  "OSHA-NH3-PEL": "agriculture",
  "ACGIH-NH3-TLV": "agriculture",
  "ASHRAE-90.4-6.3": "data-center",
  "TIA-942-5.3a": "data-center",
  "TIA-942-5.3b": "data-center",
  "NEBS-GR3028-3.1": "data-center",
};
