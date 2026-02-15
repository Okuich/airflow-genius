// ─── Standard Mapping Engine ────────────────────────────────────────────────
// Maps simulation domains and configurations to applicable regulatory standards.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceStandard,
  StandardMapping,
  AirflowComplianceDomain,
} from "@/packages/types";

interface StandardDefinition {
  standard: ComplianceStandard;
  domains: AirflowComplianceDomain[];
  keywords: string[];
  description: string;
}

const STANDARD_DEFINITIONS: StandardDefinition[] = [
  { standard: "ASHRAE_62.1", domains: ["hvac"], keywords: ["ventilation", "outdoor air", "breathing zone", "ach"], description: "Ventilation for acceptable indoor air quality" },
  { standard: "ASHRAE_55", domains: ["hvac"], keywords: ["thermal comfort", "operative temperature", "air speed", "draft"], description: "Thermal environmental conditions for human occupancy" },
  { standard: "ASHRAE_90.4", domains: ["data-center"], keywords: ["pue", "energy", "data center", "efficiency"], description: "Energy standard for data centers" },
  { standard: "ISO_14644", domains: ["cleanroom"], keywords: ["cleanroom", "iso class", "particle", "laminar", "hepa", "recovery"], description: "Cleanrooms and associated controlled environments" },
  { standard: "OSHA_PEL", domains: ["exhaust", "agriculture"], keywords: ["exposure", "pel", "contaminant", "ammonia", "concentration", "twa"], description: "Permissible exposure limits for airborne substances" },
  { standard: "NFPA_45", domains: ["exhaust"], keywords: ["fume hood", "laboratory", "face velocity", "chemical"], description: "Fire protection for laboratories using chemicals" },
  { standard: "EN_16798", domains: ["hvac"], keywords: ["indoor environmental", "european", "ventilation", "thermal"], description: "European indoor environmental input parameters" },
  { standard: "ACGIH_TLV", domains: ["exhaust", "agriculture"], keywords: ["tlv", "threshold limit", "capture velocity", "hood", "ammonia"], description: "Threshold limit values for chemical substances" },
  { standard: "TIA_942", domains: ["data-center"], keywords: ["data center", "tier", "inlet temperature", "rack", "cooling"], description: "Telecommunications infrastructure standard for data centers" },
  { standard: "NEBS_GR_3028", domains: ["data-center"], keywords: ["nebs", "telco", "thermal", "equipment"], description: "Thermal management for telecom equipment" },
];

export class StandardMappingEngine {
  /**
   * Determine which standards apply to a given simulation domain.
   */
  mapStandards(
    domain: AirflowComplianceDomain,
    contextKeywords?: string[]
  ): StandardMapping[] {
    const mappings: StandardMapping[] = [];

    for (const def of STANDARD_DEFINITIONS) {
      // Must match domain
      if (!def.domains.includes(domain) && domain !== "general") continue;

      let relevance = 0.7; // base relevance for domain match
      const applicableClauses: string[] = [];

      // Boost relevance with keyword matches
      if (contextKeywords) {
        const lower = contextKeywords.map((k) => k.toLowerCase());
        const matches = def.keywords.filter((kw) => lower.some((ck) => ck.includes(kw)));
        relevance += matches.length * 0.05;
      }

      // Determine applicable clauses from rule library
      applicableClauses.push(...this.getClausesForStandard(def.standard, domain));

      relevance = Math.min(relevance, 1.0);

      mappings.push({
        standard: def.standard,
        applicableClauses,
        relevance: round2(relevance),
        rationale: def.description,
      });
    }

    return mappings
      .filter((m) => m.applicableClauses.length > 0 || m.relevance > 0.7)
      .sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Get all standards that could be relevant to a set of metrics.
   */
  identifyFromMetrics(metricNames: string[]): ComplianceStandard[] {
    const standards = new Set<ComplianceStandard>();

    const metricStandardMap: Record<string, ComplianceStandard[]> = {
      outdoorAirRate: ["ASHRAE_62.1"],
      exhaustAirflow: ["ASHRAE_62.1"],
      operativeTemperature: ["ASHRAE_55"],
      maxAirSpeed: ["ASHRAE_55"],
      airChangeRate: ["ISO_14644"],
      laminarCoverage: ["ISO_14644"],
      recoveryTime: ["ISO_14644"],
      peakConcentration: ["OSHA_PEL"],
      twaConcentration: ["OSHA_PEL"],
      captureVelocity: ["ACGIH_TLV"],
      faceVelocity: ["NFPA_45"],
      ammoniaConcentration: ["OSHA_PEL", "ACGIH_TLV"],
      estimatedPUE: ["ASHRAE_90.4"],
      rackInletTemp: ["TIA_942", "NEBS_GR_3028"],
    };

    for (const metric of metricNames) {
      const related = metricStandardMap[metric];
      if (related) related.forEach((s) => standards.add(s));
    }

    return [...standards];
  }

  private getClausesForStandard(
    standard: ComplianceStandard,
    _domain: AirflowComplianceDomain
  ): string[] {
    const clauseMap: Record<ComplianceStandard, string[]> = {
      "ASHRAE_62.1": ["6.2", "6.4"],
      "ASHRAE_55": ["5.3.1", "5.3.3"],
      "ASHRAE_90.4": ["6.3"],
      "ISO_14644": ["4.3", "4.4", "B.4"],
      "OSHA_PEL": ["1910.1000", "Z-1 Table"],
      "NFPA_45": ["7.8"],
      "EN_16798": ["6.3", "6.4"],
      "ACGIH_TLV": ["VS-10", "TLV-TWA"],
      "TIA_942": ["5.3.4"],
      "NEBS_GR_3028": ["3.1"],
    };
    return clauseMap[standard] ?? [];
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
