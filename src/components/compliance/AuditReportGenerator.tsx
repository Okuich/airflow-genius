import { useState, useMemo, useCallback } from "react";
import { FileText, Download, FileJson, FileSpreadsheet, Code2, Hash, Fingerprint, Clock, ShieldCheck } from "lucide-react";
import { ComplianceOrchestrator } from "@/packages/compliance-engine";
import { ReportFormatter, REPORT_TEMPLATES } from "@/packages/compliance-reporting";
import { ComplianceReportGenerator } from "@/packages/compliance-reporting/compliance-report-generator";
import type { ReportFormat, ReportTemplateId, ComplianceReportDocument } from "@/packages/compliance-reporting";
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
  const [reportDoc, setReportDoc] = useState<ComplianceReportDocument | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const orch = new ComplianceOrchestrator();
      const result = orch.run({
        simulationId: `audit-${Date.now()}`,
        organizationId: "org-current",
        domain,
        metrics,
      });

      // Generate formatted report
      const formatter = new ReportFormatter();
      const report = formatter.format(result.auditDocument, templateId, format);
      setGenerated({ content: report.content, filename: report.filename });

      // Generate structured PDF-ready document
      const generator = new ComplianceReportGenerator();
      const doc = await generator.generate({
        simulationId: result.simulationId,
        organizationId: "org-current",
        findings: result.findings,
        riskReport: result.riskReport,
        standardMappings: result.standardMappings,
      });
      setReportDoc(doc);
    } finally {
      setIsGenerating(false);
    }
  }, [domain, metrics, templateId, format]);

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

  const handleDownloadJson = () => {
    if (!reportDoc) return;
    const blob = new Blob([JSON.stringify(reportDoc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportDoc.reportId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="surface-panel rounded-lg p-6 space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-data-violet/15 flex items-center justify-center ring-1 ring-data-violet/20">
          <FileText className="w-5 h-5 text-data-violet" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Audit Report Generator</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Generate formatted compliance reports with integrity verification</p>
        </div>
      </div>

      {/* Template Selection */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 block">Template</label>
        <div className="grid grid-cols-2 gap-2">
          {REPORT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTemplateId(t.id)}
              className={`text-left p-3 rounded-lg border transition-all ${
                templateId === t.id
                  ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/20"
                  : "border-surface-border bg-surface-raised text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
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
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 block">Output Format</label>
        <div className="flex gap-2">
          {FORMAT_OPTIONS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                  format === f.id
                    ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/20"
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
        disabled={isGenerating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50"
      >
        <FileText className="w-4 h-4" />
        {isGenerating ? "Generating…" : "Generate Report"}
      </button>

      {/* Integrity Manifest */}
      {reportDoc && (
        <div className="surface-raised rounded-lg p-4 space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-data-emerald" />
            <span className="text-xs font-semibold text-foreground">Report Integrity</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <Hash className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Report ID:</span>
              <span className="font-mono text-foreground">{reportDoc.reportId}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Generated:</span>
              <span className="font-mono text-foreground">{new Date(reportDoc.generatedAt).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-start gap-1.5 text-[11px]">
            <Fingerprint className="w-3 h-3 text-primary mt-0.5 shrink-0" />
            <div>
              <span className="text-muted-foreground block">SHA-256 Metadata Hash:</span>
              <span className="font-mono text-primary text-[10px] break-all">{reportDoc.metadataHash}</span>
            </div>
          </div>

          {/* Signature Placeholders */}
          <div className="border-t border-surface-border pt-3">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-2">Digital Signatures</span>
            <div className="space-y-1.5">
              {reportDoc.signatures.map((sig, i) => (
                <div key={i} className="flex items-center justify-between surface-overlay rounded-md px-3 py-2">
                  <span className="text-xs text-foreground">{sig.signerRole}</span>
                  <span className={`status-badge text-[10px] ${
                    sig.status === "pending" ? "bg-data-amber/15 text-data-amber" : "bg-data-emerald/15 text-data-emerald"
                  }`}>
                    {sig.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleDownloadJson}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg surface-overlay text-sm text-foreground hover:bg-surface-raised transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download Structured Report (JSON)
          </button>
        </div>
      )}

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
