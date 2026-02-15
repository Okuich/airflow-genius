import { useMemo } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { ComplianceRulesEngine } from "@/packages/compliance-engine";
import { RiskMatrixEngine } from "@/packages/compliance-risk";
import type { AirflowComplianceDomain } from "@/packages/types";

interface RiskHeatmapProps {
  domain: AirflowComplianceDomain;
  metrics: Record<string, number>;
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "hsl(var(--data-rose))",
  High: "hsl(var(--data-amber))",
  Medium: "hsl(var(--data-violet))",
  Low: "hsl(var(--data-emerald))",
};

export function RiskHeatmap({ domain, metrics }: RiskHeatmapProps) {
  const { findings, matrixResult } = useMemo(() => {
    const engine = new ComplianceRulesEngine();
    const f = engine.evaluate(metrics, domain);
    const matrix = new RiskMatrixEngine();
    return { findings: f, matrixResult: matrix.build(f) };
  }, [domain, metrics]);

  if (findings.length === 0) {
    return (
      <div className="surface-panel rounded-lg p-6 animate-fade-in">
        <h2 className="text-base font-semibold text-foreground mb-4">Risk Matrix</h2>
        <p className="text-sm text-muted-foreground">No metrics provided for this domain.</p>
      </div>
    );
  }

  const scatterData = matrixResult.entries.map((e) => ({
    likelihood: e.likelihood,
    impact: e.impact,
    ruleId: e.ruleId,
    riskLevel: e.riskLevel,
    fill: SEVERITY_COLORS[e.riskLevel] ?? "hsl(var(--muted))",
  }));

  return (
    <div className="surface-panel rounded-lg p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Risk Matrix</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Likelihood × Impact · {matrixResult.highRiskQuadrant.length} in high-risk quadrant · Aggregate risk: {matrixResult.aggregateRisk.toFixed(2)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(["Critical", "High", "Medium", "Low"] as const).map((level) => (
            <div key={level} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[level] }} />
              <span className="text-[10px] text-muted-foreground">{level}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scatter Plot */}
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <XAxis
              type="number"
              dataKey="likelihood"
              domain={[0, 1]}
              name="Likelihood"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--surface-border))" }}
              label={{ value: "Likelihood →", position: "bottom", offset: 2, style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }}
            />
            <YAxis
              type="number"
              dataKey="impact"
              domain={[0, 1]}
              name="Impact"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--surface-border))" }}
              label={{ value: "Impact →", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }}
            />
            <ReferenceLine x={0.5} stroke="hsl(var(--data-rose) / 0.3)" strokeDasharray="4 4" />
            <ReferenceLine y={0.5} stroke="hsl(var(--data-rose) / 0.3)" strokeDasharray="4 4" />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="surface-panel rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-xs font-mono font-semibold text-foreground">{d.ruleId}</p>
                    <p className="text-[10px] text-muted-foreground">
                      L: {d.likelihood.toFixed(2)} · I: {d.impact.toFixed(2)} · {d.riskLevel}
                    </p>
                  </div>
                );
              }}
            />
            <Scatter data={scatterData}>
              {scatterData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} r={entry.riskLevel === "Critical" ? 8 : entry.riskLevel === "High" ? 7 : 5} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="surface-raised rounded-lg p-3 text-center">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Total Findings</span>
          <span className="text-lg font-mono font-semibold text-foreground">{matrixResult.entries.length}</span>
        </div>
        <div className="surface-raised rounded-lg p-3 text-center">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">High-Risk Quadrant</span>
          <span className="text-lg font-mono font-semibold text-data-rose">{matrixResult.highRiskQuadrant.length}</span>
        </div>
        <div className="surface-raised rounded-lg p-3 text-center">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Aggregate Risk</span>
          <span className="text-lg font-mono font-semibold text-data-amber">{matrixResult.aggregateRisk.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
