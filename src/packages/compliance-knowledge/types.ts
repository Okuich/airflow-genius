// ─── Compliance Knowledge — Types ───────────────────────────────────────────
// Shared type definitions for the compliance knowledge base.
// Domain-independent — consumed by modules, agents, and UI.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceStandard,
  ComplianceAuthority,
  ComplianceRule,
  AirflowComplianceDomain,
} from "@/packages/types";

// ── Standard Catalog Entry ─────────────────────────────────────────────────

export interface StandardDefinition {
  /** Standard identifier (e.g. "ASHRAE_62.1"). */
  standard: ComplianceStandard;
  /** Authority category. */
  authority: ComplianceAuthority;
  /** Full title. */
  title: string;
  /** Short description of scope. */
  description: string;
  /** Issuing body. */
  issuingBody: string;
  /** Year of latest edition referenced. */
  editionYear: number;
  /** Domains this standard applies to. */
  domains: AirflowComplianceDomain[];
  /** Keywords for contextual matching. */
  keywords: string[];
  /** Clauses relevant to CFD airflow compliance. */
  clauses: ClauseDefinition[];
}

export interface ClauseDefinition {
  /** Clause number (e.g. "6.2", "B.4"). */
  clauseId: string;
  /** Human-readable clause title. */
  title: string;
  /** Brief description of what this clause requires. */
  requirement: string;
  /** CFD metrics this clause evaluates. */
  metrics: string[];
}

// ── Metric ↔ Standard Mapping ──────────────────────────────────────────────

export interface MetricStandardLink {
  /** CFD metric name (e.g. "captureVelocity"). */
  metric: string;
  /** Standards that reference this metric. */
  standards: ComplianceStandard[];
  /** Human-readable label. */
  label: string;
  /** Unit of measurement. */
  unit: string;
}

// ── Remediation Template ───────────────────────────────────────────────────

export interface RemediationTemplate {
  /** Metric this template addresses. */
  metric: string;
  /** Template string — use `{gap}`, `{pct}`, `{standardCode}`, `{threshold}` placeholders. */
  template: string;
  /** Engineering category. */
  category: "ventilation" | "thermal" | "containment" | "energy" | "equipment";
}

// ── Knowledge Bundle ───────────────────────────────────────────────────────

export interface ComplianceKnowledgeBundle {
  standards: StandardDefinition[];
  rules: ComplianceRule[];
  metricLinks: MetricStandardLink[];
  remediationTemplates: RemediationTemplate[];
}
