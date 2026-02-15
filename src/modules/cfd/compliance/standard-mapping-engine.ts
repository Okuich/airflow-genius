// ─── Standard Mapping Engine ────────────────────────────────────────────────
// Maps simulation domains to applicable regulatory standards.
// Knowledge sourced from packages/compliance-knowledge.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceStandard,
  StandardMapping,
  AirflowComplianceDomain,
} from "@/packages/types";
import {
  STANDARD_CATALOG,
  METRIC_STANDARD_LINKS,
} from "@/packages/compliance-knowledge";

export class StandardMappingEngine {
  /**
   * Determine which standards apply to a given simulation domain.
   */
  mapStandards(
    domain: AirflowComplianceDomain,
    contextKeywords?: string[]
  ): StandardMapping[] {
    const mappings: StandardMapping[] = [];

    for (const def of STANDARD_CATALOG) {
      if (!def.domains.includes(domain) && domain !== "general") continue;

      let relevance = 0.7;
      const applicableClauses = def.clauses.map((c) => c.clauseId);

      if (contextKeywords) {
        const lower = contextKeywords.map((k) => k.toLowerCase());
        const matches = def.keywords.filter((kw) => lower.some((ck) => ck.includes(kw)));
        relevance += matches.length * 0.05;
      }

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

    for (const metric of metricNames) {
      const link = METRIC_STANDARD_LINKS.find((l) => l.metric === metric);
      if (link) link.standards.forEach((s) => standards.add(s));
    }

    return [...standards];
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
