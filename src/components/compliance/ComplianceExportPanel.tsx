import { useState, useCallback, useMemo } from "react";
import {
  FileDown,
  FileText,
  FileSpreadsheet,
  Calendar,
  Filter,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { ComplianceOrchestrator } from "@/packages/compliance-engine";
import { STANDARD_CATALOG } from "@/packages/compliance-knowledge/standard-catalog";
import type { AirflowComplianceDomain } from "@/packages/types";

interface ComplianceExportPanelProps {
  domain: AirflowComplianceDomain;
  metrics: Record<string, number>;
}

const DOMAIN_LABELS: Record<AirflowComplianceDomain, string> = {
  hvac: "HVAC",
  cleanroom: "Cleanroom",
  exhaust: "Exhaust Systems",
  agriculture: "Agriculture",
  "data-center": "Data Center",
  general: "General",
};

const EXPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compliance-export`;

export function ComplianceExportPanel({ domain, metrics }: ComplianceExportPanelProps) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedStandards, setSelectedStandards] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showStandardDropdown, setShowStandardDropdown] = useState(false);

  const relevantStandards = useMemo(
    () => STANDARD_CATALOG.filter((s) => s.domains.includes(domain)),
    [domain]
  );

  const toggleStandard = (std: string) => {
    setSelectedStandards((prev) =>
      prev.includes(std) ? prev.filter((s) => s !== std) : [...prev, std]
    );
  };

  const generateReportData = useCallback(() => {
    const orch = new ComplianceOrchestrator();
    const result = orch.run({
      simulationId: `export-${Date.now()}`,
      organizationId: "org-current",
      domain,
      metrics,
    });

    const doc = result.auditDocument;

    // Filter findings by selected standards
    let filteredFindings = doc.findings;
    if (selectedStandards.length > 0) {
      filteredFindings = filteredFindings.filter((f) =>
        selectedStandards.some(
          (std) =>
            f.standardCode.includes(std.replace("_", " ")) ||
            f.authority === STANDARD_CATALOG.find((s) => s.standard === std)?.authority
        )
      );
    }

    const verdictLabel =
      doc.overallVerdict === "compliant"
        ? "COMPLIANT"
        : doc.overallVerdict === "non_compliant"
        ? "NON-COMPLIANT"
        : "CONDITIONALLY COMPLIANT";

    // Derive pass/fail from ComplianceFinding status when available
    const findingsWithStatus = result.findings;
    const statusMap = new Map(findingsWithStatus.map((f) => [f.ruleId, f.status]));

    return {
      title: `${DOMAIN_LABELS[domain]} Compliance Assessment`,
      generatedAt: new Date().toISOString(),
      organizationId: "org-current",
      filters: {
        dateFrom,
        dateTo,
        standards: selectedStandards.length > 0 ? selectedStandards : undefined,
        domain,
      },
      verdict: verdictLabel,
      overallScore: result.riskReport.overallScore,
      findings: filteredFindings.map((f) => {
        // Match audit finding to compliance finding by ID pattern
        const status = statusMap.get(f.id) ?? (f.severity === "Low" ? "Pass" : "Fail");
        return {
          id: f.id,
          authority: f.authority,
          standardCode: f.standardCode,
          severity: f.severity,
          status,
          actualValue: f.actualValue,
          requiredValue: f.requiredValue,
          remediation: f.remediation,
          deadline: f.deadline ?? null,
        };
      }),
      regulatoryReferences: STANDARD_CATALOG.filter(
        (s) =>
          s.domains.includes(domain) &&
          (selectedStandards.length === 0 || selectedStandards.includes(s.standard))
      ).map((s) => ({
        standard: s.standard,
        authority: s.authority,
        title: s.title,
        editionYear: s.editionYear,
      })),
    };
  }, [domain, metrics, dateFrom, dateTo, selectedStandards]);

  const handleExport = useCallback(
    async (format: "pdf" | "csv") => {
      setIsExporting(true);
      try {
        const reportData = generateReportData();

        const resp = await fetch(EXPORT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ ...reportData, format }),
        });

        if (!resp.ok) {
          throw new Error(`Export failed: ${resp.status}`);
        }

        const blob = await resp.blob();

        if (format === "pdf") {
          // Open print-ready HTML in new window for Print → Save as PDF
          const html = await blob.text();
          const win = window.open("", "_blank");
          if (win) {
            win.document.write(html);
            win.document.close();
            // Auto-trigger print dialog after a brief load
            setTimeout(() => win.print(), 500);
          }
        } else {
          // Direct CSV download
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `compliance-report-${domain}-${dateTo}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        console.error("Export error:", err);
      } finally {
        setIsExporting(false);
      }
    },
    [generateReportData, domain, dateTo]
  );

  // Quick preview stats
  const previewData = useMemo(() => {
    try {
      const data = generateReportData();
      return {
        total: data.findings.length,
        pass: data.findings.filter((f) => f.status === "Pass").length,
        fail: data.findings.filter((f) => f.status === "Fail").length,
        verdict: data.verdict,
      };
    } catch {
      return null;
    }
  }, [generateReportData]);

  return (
    <div className="surface-panel rounded-lg p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-data-cyan/15 flex items-center justify-center ring-1 ring-data-cyan/20">
          <FileDown className="w-5 h-5 text-data-cyan" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Export Compliance Report</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Download as PDF or CSV with custom filters
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
          Filters
        </label>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1">
              <Calendar className="w-3 h-3" /> From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg surface-raised border border-surface-border text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1">
              <Calendar className="w-3 h-3" /> To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg surface-raised border border-surface-border text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Domain (read-only, from parent) */}
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1">
            <Filter className="w-3 h-3" /> Domain
          </label>
          <div className="px-3 py-2 rounded-lg surface-raised border border-surface-border text-sm text-foreground">
            {DOMAIN_LABELS[domain]}
          </div>
        </div>

        {/* Standards Multi-Select */}
        <div className="relative">
          <label className="text-[11px] text-muted-foreground mb-1 block">Standards</label>
          <button
            onClick={() => setShowStandardDropdown(!showStandardDropdown)}
            className="w-full px-3 py-2 rounded-lg surface-raised border border-surface-border text-sm text-foreground text-left flex items-center justify-between"
          >
            <span className={selectedStandards.length === 0 ? "text-muted-foreground" : ""}>
              {selectedStandards.length === 0
                ? "All standards"
                : `${selectedStandards.length} selected`}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${
                showStandardDropdown ? "rotate-180" : ""
              }`}
            />
          </button>
          {showStandardDropdown && (
            <div className="absolute z-20 mt-1 w-full rounded-lg surface-panel border border-surface-border shadow-lg max-h-48 overflow-y-auto">
              {relevantStandards.map((std) => (
                <button
                  key={std.standard}
                  onClick={() => toggleStandard(std.standard)}
                  className="w-full px-3 py-2 text-left text-[12px] flex items-center gap-2 hover:bg-surface-overlay transition-colors"
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      selectedStandards.includes(std.standard)
                        ? "bg-primary border-primary"
                        : "border-surface-border"
                    }`}
                  >
                    {selectedStandards.includes(std.standard) && (
                      <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="font-medium text-foreground block truncate">
                      {std.standard.replace("_", " ")}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate block">
                      {std.authority} · {std.editionYear}
                    </span>
                  </div>
                </button>
              ))}
              {relevantStandards.length === 0 && (
                <p className="px-3 py-2 text-[11px] text-muted-foreground">
                  No standards for this domain
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preview Stats */}
      {previewData && (
        <div className="grid grid-cols-3 gap-2">
          <div className="surface-raised rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-foreground">{previewData.total}</p>
            <p className="text-[10px] text-muted-foreground">Findings</p>
          </div>
          <div className="surface-raised rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-emerald-400 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {previewData.pass}
            </p>
            <p className="text-[10px] text-muted-foreground">Pass</p>
          </div>
          <div className="surface-raised rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-rose-400 flex items-center justify-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              {previewData.fail}
            </p>
            <p className="text-[10px] text-muted-foreground">Fail</p>
          </div>
        </div>
      )}

      {/* Verdict Badge */}
      {previewData && (
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold ${
            previewData.verdict === "COMPLIANT"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : previewData.verdict === "NON-COMPLIANT"
              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
          }`}
        >
          {previewData.verdict === "COMPLIANT" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : previewData.verdict === "NON-COMPLIANT" ? (
            <XCircle className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          Verdict: {previewData.verdict}
        </div>
      )}

      {/* Export Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleExport("pdf")}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          Export PDF
        </button>
        <button
          onClick={() => handleExport("csv")}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg surface-raised border border-surface-border text-foreground hover:bg-surface-overlay transition-colors text-sm font-medium disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4" />
          )}
          Export CSV
        </button>
      </div>
    </div>
  );
}
