import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Finding {
  id: string;
  authority: string;
  standardCode: string;
  severity: string;
  status: string;
  actualValue: string | number;
  requiredValue: string | number;
  remediation: string;
  deadline: string | null;
}

interface ReportRequest {
  format: "pdf" | "csv";
  title: string;
  generatedAt: string;
  organizationId: string;
  filters: {
    dateFrom?: string;
    dateTo?: string;
    standards?: string[];
    domain?: string;
  };
  verdict: string;
  overallScore: number;
  findings: Finding[];
  regulatoryReferences: { standard: string; authority: string; title: string; editionYear: number }[];
}

function generateCsv(data: ReportRequest): string {
  const headers = [
    "Finding ID",
    "Authority",
    "Standard",
    "Severity",
    "Status",
    "Measured Value",
    "Required Value",
    "Remediation",
    "Deadline",
  ];

  const rows = data.findings.map((f) => [
    f.id,
    f.authority,
    f.standardCode,
    f.severity,
    f.status,
    String(f.actualValue),
    String(f.requiredValue),
    `"${String(f.remediation).replace(/"/g, '""')}"`,
    f.deadline ?? "",
  ]);

  const meta = [
    `# Compliance Report: ${data.title}`,
    `# Generated: ${data.generatedAt}`,
    `# Verdict: ${data.verdict}`,
    `# Risk Score: ${data.overallScore}`,
    `# Domain: ${data.filters.domain ?? "all"}`,
    `# Date Range: ${data.filters.dateFrom ?? "any"} to ${data.filters.dateTo ?? "any"}`,
    `# Standards: ${data.filters.standards?.join(", ") ?? "all"}`,
    "",
  ];

  return [...meta, headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function generatePdfHtml(data: ReportRequest): string {
  const verdictColor =
    data.verdict === "COMPLIANT"
      ? "#22c55e"
      : data.verdict === "NON-COMPLIANT"
      ? "#ef4444"
      : "#f59e0b";

  const findingsRows = data.findings
    .map(
      (f) => `
      <tr>
        <td>${f.id}</td>
        <td>${f.authority}</td>
        <td>${f.standardCode}</td>
        <td><span class="severity ${f.severity.toLowerCase()}">${f.severity}</span></td>
        <td><span class="status ${f.status.toLowerCase()}">${f.status}</span></td>
        <td class="mono">${f.actualValue}</td>
        <td class="mono">${f.requiredValue}</td>
        <td>${f.remediation}</td>
        <td>${f.deadline ?? "—"}</td>
      </tr>`
    )
    .join("");

  const refsRows = data.regulatoryReferences
    .map(
      (r) => `
      <tr>
        <td>${r.standard}</td>
        <td>${r.authority}</td>
        <td>${r.title}</td>
        <td>${r.editionYear}</td>
      </tr>`
    )
    .join("");

  const filtersHtml = `
    <div class="filters">
      <span><strong>Domain:</strong> ${data.filters.domain ?? "All"}</span>
      <span><strong>Date Range:</strong> ${data.filters.dateFrom ?? "Any"} — ${data.filters.dateTo ?? "Any"}</span>
      <span><strong>Standards:</strong> ${data.filters.standards?.join(", ") ?? "All"}</span>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${data.title}</title>
<style>
  @page { size: A4; margin: 2cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a2e; font-size: 11px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; color: #1e293b; letter-spacing: -0.5px; }
  .header .meta { text-align: right; font-size: 10px; color: #64748b; }
  .verdict-badge { display: inline-block; padding: 6px 16px; border-radius: 6px; font-weight: 700; font-size: 13px; color: white; background: ${verdictColor}; margin: 8px 0; }
  .filters { display: flex; gap: 24px; background: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 10px; }
  .section-title { font-size: 14px; font-weight: 700; color: #1e293b; margin: 20px 0 10px; border-left: 4px solid #2563eb; padding-left: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
  th { background: #1e293b; color: white; padding: 8px 10px; text-align: left; font-weight: 600; }
  td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .mono { font-family: 'SF Mono', 'Cascadia Code', monospace; }
  .severity { padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 600; text-transform: uppercase; }
  .severity.critical { background: #fee2e2; color: #dc2626; }
  .severity.high { background: #fef3c7; color: #d97706; }
  .severity.medium { background: #dbeafe; color: #2563eb; }
  .severity.low { background: #f0fdf4; color: #16a34a; }
  .status { padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 600; }
  .status.fail { background: #fee2e2; color: #dc2626; }
  .status.pass { background: #f0fdf4; color: #16a34a; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
  .summary-card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
  .summary-card .value { font-size: 18px; font-weight: 700; color: #1e293b; margin-top: 2px; }
  .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>FlowForge Compliance Report</h1>
      <p style="color: #64748b; margin-top: 4px;">${data.title}</p>
      <div class="verdict-badge">${data.verdict}</div>
    </div>
    <div class="meta">
      <p>Generated: ${new Date(data.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
      <p>Organization: ${data.organizationId}</p>
    </div>
  </div>

  ${filtersHtml}

  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Risk Score</div>
      <div class="value">${data.overallScore}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Findings</div>
      <div class="value">${data.findings.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">Failures</div>
      <div class="value" style="color: ${data.findings.filter((f) => f.status === "Fail").length > 0 ? "#dc2626" : "#16a34a"}">${data.findings.filter((f) => f.status === "Fail").length}</div>
    </div>
  </div>

  <h2 class="section-title">Compliance Findings</h2>
  <table>
    <thead>
      <tr>
        <th>ID</th><th>Authority</th><th>Standard</th><th>Severity</th><th>Status</th>
        <th>Measured</th><th>Required</th><th>Remediation</th><th>Deadline</th>
      </tr>
    </thead>
    <tbody>${findingsRows}</tbody>
  </table>

  <h2 class="section-title">Regulatory References</h2>
  <table>
    <thead><tr><th>Standard</th><th>Authority</th><th>Title</th><th>Edition</th></tr></thead>
    <tbody>${refsRows}</tbody>
  </table>

  <div class="footer">
    <span>FlowForge CFD — Compliance Report</span>
    <span>Confidential — For internal use only</span>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const data = (await req.json()) as ReportRequest;

    if (data.format === "csv") {
      const csv = generateCsv(data);
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="compliance-report-${Date.now()}.csv"`,
        },
      });
    }

    // PDF format → return print-ready HTML
    const html = generatePdfHtml(data);
    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (e) {
    console.error("compliance-export error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
