import { useMemo } from "react";
import { Shield, AlertTriangle, CheckCircle, XCircle, TrendingDown, DollarSign, Activity } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ComplianceOrchestrator } from "@/packages/compliance-engine";
import type { AirflowComplianceDomain } from "@/packages/types";

interface ComplianceOverviewProps {
  domain: AirflowComplianceDomain;
  metrics: Record<string, number>;
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "hsl(var(--data-rose))",
  High: "hsl(var(--data-amber))",
  Medium: "hsl(var(--data-violet))",
  Low: "hsl(var(--data-emerald))",
  Pass: "hsl(var(--data-emerald))",
};

export function ComplianceOverview({ domain, metrics }: ComplianceOverviewProps) {
  const result = useMemo(() => {
    const orch = new ComplianceOrchestrator();
    return orch.run({
      simulationId: "overview",
      organizationId: "overview",
      domain,
      metrics,
    });
  }, [domain, metrics]);

  const { riskReport, findings, auditDocument } = result;
  const passes = findings.filter((f) => f.status === "Pass").length;
  const fails = findings.filter((f) => f.status === "Fail").length;

  const verdictConfig = {
    compliant: { label: "Compliant", icon: CheckCircle, color: "text-data-emerald", bg: "bg-data-emerald/15", ring: "ring-data-emerald/30" },
    conditionally_compliant: { label: "Conditionally Compliant", icon: AlertTriangle, color: "text-data-amber", bg: "bg-data-amber/15", ring: "ring-data-amber/30" },
    non_compliant: { label: "Non-Compliant", icon: XCircle, color: "text-data-rose", bg: "bg-data-rose/15", ring: "ring-data-rose/30" },
  };

  const verdict = verdictConfig[auditDocument.overallVerdict];
  const VerdictIcon = verdict.icon;

  // Donut chart data
  const severityCounts = findings.reduce<Record<string, number>>((acc, f) => {
    const key = f.status === "Pass" ? "Pass" : f.riskLevel;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const donutData = Object.entries(severityCounts).map(([name, value]) => ({
    name,
    value,
    color: SEVERITY_COLORS[name] ?? "hsl(var(--muted))",
  }));

  const scoreColor = riskReport.overallScore >= 50
    ? "text-data-rose"
    : riskReport.overallScore >= 25
      ? "text-data-amber"
      : "text-data-emerald";

  const barColor = riskReport.overallScore >= 50
    ? "bg-data-rose"
    : riskReport.overallScore >= 25
      ? "bg-data-amber"
      : "bg-data-emerald";

  return (
    <div className="surface-panel rounded-lg p-6 space-y-6 animate-fade-in">
      {/* Header with verdict */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Compliance Overview</h2>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{domain.replace("-", " ")} Domain · {findings.length} rules evaluated</p>
          </div>
        </div>
        <div className={`status-badge ${verdict.bg} ${verdict.color} ring-1 ${verdict.ring}`}>
          <VerdictIcon className="w-3.5 h-3.5" />
          {verdict.label}
        </div>
      </div>

      {/* Metrics + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricTile
            label="Risk Score"
            value={<><span className={scoreColor}>{riskReport.overallScore}</span><span className="text-sm text-muted-foreground">/100</span></>}
            icon={<Activity className="w-4 h-4" />}
            accent={scoreColor}
          />
          <MetricTile
            label="Compliance Prob."
            value={<span className="text-data-cyan">{(riskReport.complianceProbability * 100).toFixed(0)}%</span>}
            icon={<TrendingDown className="w-4 h-4" />}
            accent="text-data-cyan"
          />
          <MetricTile
            label="Pass / Fail"
            value={
              <div className="flex items-baseline gap-1.5">
                <span className="text-data-emerald">{passes}</span>
                <span className="text-xs text-muted-foreground">/</span>
                <span className="text-data-rose">{fails}</span>
              </div>
            }
            icon={<CheckCircle className="w-4 h-4" />}
            accent="text-foreground"
          />
          <MetricTile
            label="Remediation Cost"
            value={<span className="text-foreground">${riskReport.projectedRemediationCost.toLocaleString()}</span>}
            icon={<DollarSign className="w-4 h-4" />}
            accent="text-foreground"
          />
        </div>

        {/* Donut Chart */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-[140px] h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={62}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-xl font-mono font-bold ${scoreColor}`}>{riskReport.overallScore}</span>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Risk</span>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
            {donutData.map((d) => (
              <div key={d.name} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[9px] text-muted-foreground">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk Level</span>
          <span className="text-[10px] text-muted-foreground">{riskReport.highRiskCount} high-risk finding(s)</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-surface-overlay overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
            style={{ width: `${Math.min(riskReport.overallScore, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="surface-raised rounded-lg p-4 group hover:ring-1 hover:ring-primary/20 transition-all duration-200">
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`${accent} opacity-60`}>{icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-mono font-semibold">{value}</div>
    </div>
  );
}
