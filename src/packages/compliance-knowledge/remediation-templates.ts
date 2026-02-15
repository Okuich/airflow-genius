// ─── Remediation Templates ─────────────────────────────────────────────────
// Parameterised remediation guidance for compliance violations.
// Templates use placeholders: {gap}, {pct}, {standardCode}, {threshold}
// ──────────────────────────────────────────────────────────────────────────

import type { RemediationTemplate } from "./types";

export const REMEDIATION_TEMPLATES: RemediationTemplate[] = [
  {
    metric: "outdoorAirRate",
    template: "Increase outdoor air supply by at least {pct}% to meet {standardCode}. Consider demand-controlled ventilation with CO₂ sensors.",
    category: "ventilation",
  },
  {
    metric: "exhaustAirflow",
    template: "Increase exhaust rate to meet {standardCode}. Current deficit: {gap}. Verify duct sizing and fan capacity.",
    category: "ventilation",
  },
  {
    metric: "operativeTemperature",
    template: "Adjust HVAC setpoints to bring operative temperature within range per {standardCode}. Review solar loads and internal gains.",
    category: "thermal",
  },
  {
    metric: "maxAirSpeed",
    template: "Reduce diffuser throw distance or redirect supply to reduce air speed below {threshold} m/s per {standardCode}.",
    category: "thermal",
  },
  {
    metric: "airChangeRate",
    template: "Increase HEPA supply to achieve at least {threshold} ACH. Consider adding fan filter units (FFUs) or increasing AHU capacity.",
    category: "ventilation",
  },
  {
    metric: "laminarCoverage",
    template: "Improve unidirectional flow coverage by reducing obstructions, optimising diffuser placement, and ensuring HEPA filter integrity.",
    category: "containment",
  },
  {
    metric: "recoveryTime",
    template: "Reduce recovery time below {threshold} s. Increase air change rate or improve outlet placement to avoid recirculation zones.",
    category: "ventilation",
  },
  {
    metric: "peakConcentration",
    template: "Improve capture efficiency or reduce source emission rate. Peak exceeds PEL by {pct}%. Consider enclosure or local exhaust redesign.",
    category: "containment",
  },
  {
    metric: "twaConcentration",
    template: "8-hour TWA exceeds {standardCode} limit. Increase general ventilation or install local exhaust ventilation at emission source.",
    category: "containment",
  },
  {
    metric: "captureVelocity",
    template: "Increase exhaust fan capacity or reduce hood opening area. Current deficit: {gap} m/s. Consider flanged hood or enclosing hood design.",
    category: "containment",
  },
  {
    metric: "faceVelocity",
    template: "Adjust sash height or exhaust fan speed to bring face velocity within range per {standardCode}.",
    category: "containment",
  },
  {
    metric: "ammoniaConcentration",
    template: "Increase ventilation rate or reduce ammonia source. Current level {pct}% above limit. Consider scrubbers or improved manure management.",
    category: "containment",
  },
  {
    metric: "estimatedPUE",
    template: "Reduce cooling overhead — optimise containment, raise supply temperature, or use economiser modes. Target PUE ≤ {threshold}.",
    category: "energy",
  },
  {
    metric: "rackInletTemp",
    template: "Adjust CRAC/CRAH supply temperature or improve airflow containment to bring inlet temp within range per {standardCode}.",
    category: "thermal",
  },
];

/**
 * Resolve a remediation template with actual values.
 */
export function resolveRemediation(
  metric: string,
  params: {
    gap: number;
    pct: string;
    standardCode: string;
    threshold: number;
  }
): string {
  const tmpl = REMEDIATION_TEMPLATES.find((t) => t.metric === metric);
  if (!tmpl) return `Adjust ${metric} to meet ${params.standardCode} (gap: ${params.gap.toFixed(2)}).`;

  return tmpl.template
    .replace(/\{gap\}/g, params.gap.toFixed(2))
    .replace(/\{pct\}/g, params.pct)
    .replace(/\{standardCode\}/g, params.standardCode)
    .replace(/\{threshold\}/g, String(params.threshold));
}
