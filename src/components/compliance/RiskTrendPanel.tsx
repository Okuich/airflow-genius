import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Minus, History } from "lucide-react";
import { ComplianceOrchestrator } from "@/packages/compliance-engine";
import { ComplianceRiskEngine, type HistoricalSnapshot } from "@/packages/compliance-risk";
import type { AirflowComplianceDomain } from "@/packages/types";

interface RiskTrendPanelProps {
  domain: AirflowComplianceDomain;
  metrics: Record<string, number>;
}

/** Simulated historical snapshots — in production this would come from the database. */
function generateHistoricalSnapshots(
  domain: AirflowComplianceDomain,
  currentScore: number,
  currentViolations: number,
  currentFailedIds: string[]
): HistoricalSnapshot[] {
  const now = Date.now();
  const day = 86_400_000;

  return [
    { evaluatedAt: new Date(now - 30 * day).toISOString(), overallScore: Math.min(100, currentScore + 20), violationCount: currentViolations + 2, failedRuleIds: currentFailedIds },
    { evaluatedAt: new Date(now - 25 * day).toISOString(), overallScore: Math.min(100, currentScore + 18), violationCount: currentViolations + 2, failedRuleIds: currentFailedIds },
    { evaluatedAt: new Date(now - 20 * day).toISOString(), overallScore: Math.min(100, currentScore + 12), violationCount: currentViolations + 1, failedRuleIds: currentFailedIds.slice(0, -1) },
    { evaluatedAt: new Date(now - 15 * day).toISOString(), overallScore: Math.min(100, currentScore + 8), violationCount: currentViolations + 1, failedRuleIds: currentFailedIds.slice(0, -1) },
    { evaluatedAt: new Date(now - 10 * day).toISOString(), overallScore: Math.min(100, currentScore + 5), violationCount: currentViolations, failedRuleIds: currentFailedIds },
    { evaluatedAt: new Date(now - 5 * day).toISOString(), overallScore: Math.min(100, currentScore + 2), violationCount: currentViolations, failedRuleIds: currentFailedIds },
    { evaluatedAt: new Date(now).toISOString(), overallScore: currentScore, violationCount: currentViolations, failedRuleIds: currentFailedIds },
  ];
}

const trendConfig = {
  improving: { label: "Improving", icon: TrendingDown, color: "text-data-emerald", badge: "bg-data-emerald/15 text-data-emerald" },
  stable: { label: "Stable", icon: Minus, color: "text-data-amber", badge: "bg-data-amber/15 text-data-amber" },
  degrading: { label: "Degrading", icon: TrendingUp, color: "text-data-rose", badge: "bg-data-rose/15 text-data-rose" },
};

export function RiskTrendPanel({ domain, metrics }: RiskTrendPanelProps) {
  const analysis = useMemo(() => {
    const orch = new ComplianceOrchestrator();
    const result = orch.run({ simulationId: "trend", organizationId: "trend", domain, metrics });
    const failures = result.findings.filter((f) => f.status === "Fail");
    const failedIds = failures.map((f) => f.ruleId);

    const history = generateHistoricalSnapshots(domain, result.riskReport.overallScore, failures.length, failedIds);

    const riskEngine = new ComplianceRiskEngine();
    const report = riskEngine.computeRisk(result.findings, history);
    const breakdown = riskEngine.computeBreakdown(result.findings);

    // Determine trend from history
    const first = history[0];
    const last = history[history.length - 1];
    const delta = last.overallScore - first.overallScore;
    const trend: "improving" | "stable" | "degrading" = delta < -5 ? "improving" : delta > 5 ? "degrading" : "stable";

    return { report, breakdown, history, trend, delta };
  }, [domain, metrics]);

  const { history, trend, delta, breakdown } = analysis;
  const tc = trendConfig[trend];
  const TrendIcon = tc.icon;

  const chartData = history.map((h) => ({
    date: new Date(h.evaluatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: h.overallScore,
    violations: h.violationCount,
  }));

  return (
    <div className="surface-panel rounded-lg p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-data-cyan/15 flex items-center justify-center ring-1 ring-data-cyan/20">
            <History className="w-5 h-5 text-data-cyan" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Risk Trend</h2>
            <p className="text-xs text-muted-foreground mt-0.5">30-day compliance risk history</p>
          </div>
        </div>
        <div className={`status-badge ${tc.badge}`}>
          <TrendIcon className="w-3.5 h-3.5" />
          {tc.label} ({delta > 0 ? "+" : ""}{delta} pts)
        </div>
      </div>

      {/* Area Chart */}
      <div className="h-[220px] w-full mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--data-cyan))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--data-cyan))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="violationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--data-rose))" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(var(--data-rose))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--surface-border))" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--surface-border))" }}
              tickLine={false}
              domain={[0, 100]}
            />
            <ReferenceLine y={50} stroke="hsl(var(--data-rose) / 0.4)" strokeDasharray="6 3" label={{ value: "High Risk", position: "right", style: { fontSize: 9, fill: "hsl(var(--data-rose))" } }} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--surface))",
                border: "1px solid hsl(var(--surface-border))",
                borderRadius: 8,
                fontSize: 11,
                color: "hsl(var(--foreground))",
              }}
            />
            <Area type="monotone" dataKey="score" stroke="hsl(var(--data-cyan))" fill="url(#scoreGradient)" strokeWidth={2} name="Risk Score" />
            <Area type="monotone" dataKey="violations" stroke="hsl(var(--data-rose))" fill="url(#violationGradient)" strokeWidth={1.5} name="Violations" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Category Breakdown */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-3">Risk Breakdown by Category</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {breakdown.map((b) => (
            <div key={b.category} className="surface-raised rounded-lg p-3">
              <span className="text-[10px] capitalize text-muted-foreground block">{b.category}</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-lg font-mono font-semibold ${
                  b.score > 10 ? "text-data-rose" : b.score > 5 ? "text-data-amber" : "text-data-emerald"
                }`}>{b.score}</span>
                <span className="text-[10px] text-muted-foreground">{b.findingCount} findings</span>
              </div>
              {b.topFindings.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {b.topFindings.slice(0, 2).map((id) => (
                    <span key={id} className="text-[8px] font-mono px-1 py-0.5 rounded bg-surface-overlay text-muted-foreground">{id}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
