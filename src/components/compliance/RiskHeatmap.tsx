import { useMemo } from "react";
import { ComplianceRulesEngine } from "@/packages/compliance-engine";
import type { AirflowComplianceDomain, ComplianceFinding } from "@/packages/types";

interface RiskHeatmapProps {
  domain: AirflowComplianceDomain;
  metrics: Record<string, number>;
}

const SEVERITY_CONFIG = {
  Critical: { bg: "bg-data-rose", text: "text-data-rose", intensity: "bg-data-rose/20" },
  High: { bg: "bg-data-amber", text: "text-data-amber", intensity: "bg-data-amber/20" },
  Medium: { bg: "bg-data-violet", text: "text-data-violet", intensity: "bg-data-violet/20" },
  Low: { bg: "bg-data-emerald", text: "text-data-emerald", intensity: "bg-data-emerald/20" },
} as const;

export function RiskHeatmap({ domain, metrics }: RiskHeatmapProps) {
  const findings = useMemo(() => {
    const engine = new ComplianceRulesEngine();
    return engine.evaluate(metrics, domain);
  }, [domain, metrics]);

  if (findings.length === 0) {
    return (
      <div className="surface-panel rounded-lg p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Risk Heatmap</h2>
        <p className="text-sm text-muted-foreground">No metrics provided for this domain.</p>
      </div>
    );
  }

  // Group by severity
  const grouped = {
    Critical: findings.filter((f) => f.riskLevel === "Critical"),
    High: findings.filter((f) => f.riskLevel === "High"),
    Medium: findings.filter((f) => f.riskLevel === "Medium"),
    Low: findings.filter((f) => f.riskLevel === "Low"),
  };

  return (
    <div className="surface-panel rounded-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-foreground">Risk Heatmap</h2>
        <div className="flex items-center gap-3">
          {(["Critical", "High", "Medium", "Low"] as const).map((level) => (
            <div key={level} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${SEVERITY_CONFIG[level].bg}`} />
              <span className="text-[10px] text-muted-foreground">{level}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {findings.map((f) => {
          const config = SEVERITY_CONFIG[f.riskLevel];
          const deviation = f.status === "Fail"
            ? Math.abs(((f.measuredValue - f.threshold) / f.threshold) * 100).toFixed(0)
            : null;

          return (
            <div
              key={f.ruleId}
              className={`relative rounded-lg p-3 border transition-all ${
                f.status === "Fail"
                  ? `${config.intensity} border-current/10`
                  : "bg-surface-raised border-surface-border"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-muted-foreground truncate">{f.ruleId}</span>
                <span className={`w-2 h-2 rounded-full ${f.status === "Pass" ? "bg-data-emerald" : config.bg}`} />
              </div>
              <div className="font-mono text-sm font-semibold text-foreground">
                {f.measuredValue.toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                threshold: {f.threshold}
              </div>
              {deviation && (
                <div className={`text-[10px] font-mono mt-1 ${config.text}`}>
                  {f.measuredValue > f.threshold ? "+" : "-"}{deviation}% deviation
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
