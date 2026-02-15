// ─── Compliance Reporting Types ─────────────────────────────────────────────
// Types for the compliance-reporting package.
// ──────────────────────────────────────────────────────────────────────────

import type { AuditDocument, CompliancePipelineResult } from "@/packages/types";

// ── Report Templates ────────────────────────────────────────────────────────

export type ReportTemplateId =
  | "executive_summary"
  | "detailed_technical"
  | "regulatory_submission"
  | "remediation_plan";

export interface ReportTemplate {
  id: ReportTemplateId;
  name: string;
  description: string;
  /** Sections included in the report. */
  sections: ReportSectionId[];
}

export type ReportSectionId =
  | "header"
  | "verdict_summary"
  | "risk_overview"
  | "findings_table"
  | "standards_referenced"
  | "remediation_actions"
  | "cost_breakdown"
  | "sign_off"
  | "appendix_rules"
  | "appendix_methodology";

// ── Report Formats ──────────────────────────────────────────────────────────

export type ReportFormat = "markdown" | "html" | "csv" | "json";

export interface FormattedReport {
  format: ReportFormat;
  content: string;
  filename: string;
  mimeType: string;
  generatedAt: string;
  templateId: ReportTemplateId;
  auditDocumentId: string;
}

// ── Report History ──────────────────────────────────────────────────────────

export interface ReportHistoryEntry {
  id: string;
  simulationId: string;
  organizationId: string;
  templateId: ReportTemplateId;
  format: ReportFormat;
  auditDocumentId: string;
  verdict: AuditDocument["overallVerdict"];
  generatedAt: string;
  filename: string;
  /** Optional: stored content or URL reference. */
  contentRef?: string;
}

// ── Scheduling ──────────────────────────────────────────────────────────────

export type ScheduleFrequency = "on_demand" | "daily" | "weekly" | "monthly";

export interface ReportSchedule {
  id: string;
  organizationId: string;
  templateId: ReportTemplateId;
  format: ReportFormat;
  frequency: ScheduleFrequency;
  /** Domain to run compliance against. */
  domain: import("@/packages/types").AirflowComplianceDomain;
  /** Metric keys to evaluate. */
  metricKeys: string[];
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

export interface ScheduledRunResult {
  scheduleId: string;
  pipelineResult: CompliancePipelineResult;
  report: FormattedReport;
  executedAt: string;
}

// ── Delivery ────────────────────────────────────────────────────────────────

export type DeliveryChannel = "in_app" | "email" | "webhook";

export interface DeliveryConfig {
  channel: DeliveryChannel;
  /** Webhook URL or email address, depending on channel. */
  target?: string;
}

export interface DeliveryResult {
  channel: DeliveryChannel;
  success: boolean;
  deliveredAt: string;
  error?: string;
}
