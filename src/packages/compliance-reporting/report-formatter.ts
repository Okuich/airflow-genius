// ─── Report Formatter ───────────────────────────────────────────────────────
// Formats audit documents into Markdown, HTML, CSV, and JSON.
// ──────────────────────────────────────────────────────────────────────────

import type { AuditDocument } from "@/packages/types";
import type { ReportFormat, ReportTemplateId, FormattedReport, ReportSectionId } from "./types";
import { getTemplate } from "./report-templates";
import { renderSection } from "./section-renderer";

const MIME: Record<ReportFormat, string> = {
  markdown: "text/markdown",
  html: "text/html",
  csv: "text/csv",
  json: "application/json",
};

const EXT: Record<ReportFormat, string> = {
  markdown: "md",
  html: "html",
  csv: "csv",
  json: "json",
};

export class ReportFormatter {
  /**
   * Format an audit document using a template and output format.
   */
  format(
    doc: AuditDocument,
    templateId: ReportTemplateId,
    outputFormat: ReportFormat
  ): FormattedReport {
    const template = getTemplate(templateId);
    if (!template) throw new Error(`Unknown template: ${templateId}`);

    const markdown = this.renderMarkdown(doc, template.sections);
    const content = this.convertFormat(markdown, doc, outputFormat);
    const slug = doc.id.slice(0, 20);

    return {
      format: outputFormat,
      content,
      filename: `${slug}-${templateId}.${EXT[outputFormat]}`,
      mimeType: MIME[outputFormat],
      generatedAt: new Date().toISOString(),
      templateId,
      auditDocumentId: doc.id,
    };
  }

  private renderMarkdown(doc: AuditDocument, sections: ReportSectionId[]): string {
    return sections.map((s) => renderSection(s, doc)).filter(Boolean).join("\n---\n\n");
  }

  private convertFormat(
    markdown: string,
    doc: AuditDocument,
    format: ReportFormat
  ): string {
    switch (format) {
      case "markdown":
        return markdown;
      case "html":
        return this.markdownToHtml(markdown, doc);
      case "csv":
        return this.toCsv(doc);
      case "json":
        return JSON.stringify(doc, null, 2);
    }
  }

  /** Lightweight Markdown → HTML conversion (headings, tables, bold, paragraphs). */
  private markdownToHtml(md: string, doc: AuditDocument): string {
    let html = md
      // headings
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      // bold
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      // hr
      .replace(/^---$/gm, "<hr>")
      // table rows (simple)
      .replace(/^\|(.+)\|$/gm, (_, row: string) => {
        const cells = row.split("|").map((c: string) => c.trim());
        return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join("")}</tr>`;
      })
      // line breaks
      .replace(/  $/gm, "<br>")
      // list items
      .replace(/^- (.+)$/gm, "<li>$1</li>");

    // Wrap in basic document
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${doc.title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 10px;text-align:left}h1,h2,h3{margin-top:1.5rem}hr{margin:2rem 0;border:none;border-top:1px solid #ccc}</style>
</head>
<body>${html}</body>
</html>`;
  }

  /** Export findings as CSV. */
  private toCsv(doc: AuditDocument): string {
    const headers = ["ID", "Authority", "Standard", "Severity", "Actual", "Required", "Remediation", "Deadline"];
    const rows = doc.findings.map((f) => [
      f.id,
      f.authority,
      f.standardCode,
      f.severity,
      f.actualValue,
      f.requiredValue,
      `"${f.remediation.replace(/"/g, '""')}"`,
      f.deadline ?? "",
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }
}
