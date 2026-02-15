// ─── Report History Service ─────────────────────────────────────────────────
// In-memory store for generated report history with query capabilities.
// ──────────────────────────────────────────────────────────────────────────

import type { ReportHistoryEntry, FormattedReport, ReportTemplateId, ReportFormat } from "./types";
import type { AuditDocument } from "@/packages/types";

export class ReportHistoryService {
  private entries: ReportHistoryEntry[] = [];

  /**
   * Record a generated report in history.
   */
  record(report: FormattedReport, doc: AuditDocument): ReportHistoryEntry {
    const entry: ReportHistoryEntry = {
      id: `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      simulationId: doc.simulationId,
      organizationId: doc.organizationId,
      templateId: report.templateId,
      format: report.format,
      auditDocumentId: report.auditDocumentId,
      verdict: doc.overallVerdict,
      generatedAt: report.generatedAt,
      filename: report.filename,
    };
    this.entries.push(entry);
    return entry;
  }

  /** Get all history entries for an organization. */
  getByOrganization(organizationId: string): ReportHistoryEntry[] {
    return this.entries.filter((e) => e.organizationId === organizationId);
  }

  /** Get all history entries for a simulation. */
  getBySimulation(simulationId: string): ReportHistoryEntry[] {
    return this.entries.filter((e) => e.simulationId === simulationId);
  }

  /** Get history filtered by template and/or format. */
  query(filters: {
    organizationId?: string;
    simulationId?: string;
    templateId?: ReportTemplateId;
    format?: ReportFormat;
    verdict?: AuditDocument["overallVerdict"];
  }): ReportHistoryEntry[] {
    return this.entries.filter((e) => {
      if (filters.organizationId && e.organizationId !== filters.organizationId) return false;
      if (filters.simulationId && e.simulationId !== filters.simulationId) return false;
      if (filters.templateId && e.templateId !== filters.templateId) return false;
      if (filters.format && e.format !== filters.format) return false;
      if (filters.verdict && e.verdict !== filters.verdict) return false;
      return true;
    });
  }

  /** Get a single entry by ID. */
  getById(id: string): ReportHistoryEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  /** Total number of reports generated. */
  get count(): number {
    return this.entries.length;
  }
}
