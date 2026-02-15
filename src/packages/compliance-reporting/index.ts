// ─── Compliance Reporting Package ────────────────────────────────────────────
// Report templates, multi-format formatters, scheduling, and history.
// ──────────────────────────────────────────────────────────────────────────

export { ReportFormatter } from "./report-formatter";
export { ReportHistoryService } from "./report-history";
export { ReportScheduler } from "./report-scheduler";
export { ComplianceReportGenerator } from "./compliance-report-generator";
export { REPORT_TEMPLATES, getTemplate } from "./report-templates";
export { renderSection } from "./section-renderer";
export type {
  ReportTemplate,
  ReportTemplateId,
  ReportSectionId,
  ReportFormat,
  FormattedReport,
  ReportHistoryEntry,
  ReportSchedule,
  ScheduleFrequency,
  ScheduledRunResult,
  DeliveryChannel,
  DeliveryConfig,
  DeliveryResult,
} from "./types";
export type {
  ComplianceReportDocument,
  ReportGeneratorInput,
  ReportFindingEntry,
  ReportRiskSummary,
  RegulatoryReference,
  DigitalSignaturePlaceholder,
} from "./compliance-report-generator";
