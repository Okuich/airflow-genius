import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { ComplianceOrchestrator } from "@/packages/compliance-engine";
import type { AirflowComplianceDomain, ComplianceFinding } from "@/packages/types";

interface ViolationExplorerProps {
  domain: AirflowComplianceDomain;
  metrics: Record<string, number>;
}

export function ViolationExplorer({ domain, metrics }: ViolationExplorerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const result = useMemo(() => {
    const orch = new ComplianceOrchestrator();
    return orch.run({
      simulationId: "violations",
      organizationId: "violations",
      domain,
      metrics,
    });
  }, [domain, metrics]);

  const violations = result.findings.filter((f) => f.status === "Fail");
  const auditFindings = result.auditDocument.findings;

  const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const sorted = [...violations].sort((a, b) => severityOrder[a.riskLevel] - severityOrder[b.riskLevel]);

  const severityStyle = {
    Critical: { dot: "bg-data-rose", badge: "bg-data-rose/15 text-data-rose" },
    High: { dot: "bg-data-amber", badge: "bg-data-amber/15 text-data-amber" },
    Medium: { dot: "bg-data-violet", badge: "bg-data-violet/15 text-data-violet" },
    Low: { dot: "bg-muted-foreground", badge: "bg-muted/50 text-muted-foreground" },
  };

  return (
    <div className="surface-panel rounded-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-data-rose/15 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-data-rose" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Violation Explorer</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{violations.length} violation(s) detected</p>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="surface-raised rounded-lg p-8 text-center">
          <span className="text-data-emerald text-sm font-medium">All checks passed — no violations found.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((v) => {
            const isExpanded = expandedId === v.ruleId;
            const style = severityStyle[v.riskLevel];
            const audit = auditFindings.find((af) => af.standardCode.includes(v.ruleId.split("-").slice(1).join("-")) || af.remediation === v.recommendation);

            return (
              <div key={v.ruleId} className="rounded-lg border border-surface-border overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : v.ruleId)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-raised/50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <div className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} />
                  <span className="text-sm font-mono text-foreground flex-1">{v.ruleId}</span>
                  <span className={`status-badge ${style.badge} text-[10px]`}>{v.riskLevel}</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {v.measuredValue.toFixed(2)} <span className="text-muted-foreground/50">vs</span> {v.threshold}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pl-12 space-y-3 border-t border-surface-border pt-3">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground block mb-1">Measured Value</span>
                        <span className="font-mono text-data-rose font-semibold">{v.measuredValue.toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-1">Required Threshold</span>
                        <span className="font-mono text-foreground font-semibold">{v.threshold}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block mb-1">Recommendation</span>
                      <p className="text-sm text-foreground leading-relaxed">{v.recommendation}</p>
                    </div>
                    {audit?.deadline && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Deadline:</span>
                        <span className={`status-badge text-[10px] ${
                          audit.deadline === "immediate" ? "bg-data-rose/15 text-data-rose" : "bg-data-amber/15 text-data-amber"
                        }`}>
                          {audit.deadline}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
