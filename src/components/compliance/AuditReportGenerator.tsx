import { useState, useMemo } from "react";
import { FileText, Download, FileJson, FileSpreadsheet, Code2 } from "lucide-react";
import { ComplianceOrchestrator } from "@/packages/compliance-engine";
import { ReportFormatter, REPORT_TEMPLATES } from "@/packages/compliance-reporting";
import type { ReportFormat, ReportTemplateId } from "@/packages/compliance-reporting";
import type { AirflowComplianceDomain } from "@/packages/types";

interface AuditReportGeneratorProps {
  domain: AirflowComplianceDomain;
  metrics: Record<string, number>;
}

const FORMAT_OPTIONS: { id: ReportFormat; label: string; icon: React.ElementType }[] = [
  { id: "markdown", label: "Markdown", icon: FileText },
  { id: "html", label: "HTML", icon: Code2 },
  { id: "csv", label: "CSV", icon: FileSpreadsheet },
  { id: "json", label: "JSON", icon: FileJson },
];

export function AuditReportGenerator({ domain, metrics }: AuditReportGeneratorProps) {
  const [templateId, setTemplateId] = useState<ReportTemplateId>("executive_summary");
  const [format, setFormat] = useState<ReportFormat>("markdown");
  const [generated, setGenerated] = useState<{ content: string; filename: string } | null>(null);

  const handleGenerate = () => {
    const orch = new ComplianceOrchestrator();
    const result = orch.run({
      simulationId: `audit-${Date.now()}`,
      organizationId: "org-current",
      domain,
      metrics,
    });
    const formatter = new ReportFormatter();
    const report = formatter.format(result.auditDocument, templateId, format);
    setGenerated({ content: report.content, filename: report.filename });
  };

  const handleDownload = () => {
    if (!generated) return;
    const blob = new Blob([generated.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = generated.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="surface-panel rounded-lg p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-data-violet/15 flex items-center justify-center">
          <FileText className="w-5 h-5 text-data-violet" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Audit Report Generator</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Generate formatted compliance reports</p>
        </div>
      </div>

      {/* Template Selection */}
      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 block">Template</label>
        <div className="grid grid-cols-2 gap-2">
          {REPORT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTemplateId(t.id)}
              className={`text-left p-3 rounded-lg border transition-all ${
                templateId === t.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-surface-border bg-surface-raised text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-sm font-medium block">{t.name}</span>
              <span className="text-[10px] text-muted-foreground">{t.sections.length} sections</span>
            </button>
          ))}
        </div>
      </div>

      {/* Format Selection */}
      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 block">Output Format</label>
        <div className="flex gap-2">
          {FORMAT_OPTIONS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                  format === f.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-surface-border bg-surface-raised text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium"
      >
        <FileText className="w-4 h-4" />
        Generate Report
      </button>

      {/* Preview */}
      {generated && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono">{generated.filename}</span>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg surface-raised text-sm text-foreground hover:bg-surface-overlay transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
          <pre className="surface-raised rounded-lg p-4 text-xs font-mono text-muted-foreground overflow-auto max-h-64 whitespace-pre-wrap">
            {generated.content.slice(0, 2000)}
            {generated.content.length > 2000 && "\n\n… (truncated)"}
          </pre>
        </div>
      )}
    </div>
  );
}
