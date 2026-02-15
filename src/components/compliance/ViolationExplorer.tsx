import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Clock, Filter } from "lucide-react";
import { ComplianceOrchestrator } from "@/packages/compliance-engine";
import { STANDARD_CATALOG } from "@/packages/compliance-knowledge/standard-catalog";
import { RULE_LIBRARY } from "@/packages/compliance-knowledge";
import type { AirflowComplianceDomain, ComplianceFinding } from "@/packages/types";

interface ViolationExplorerProps {
  domain: AirflowComplianceDomain;
  metrics: Record<string, number>;
}

type SeverityFilter = "all" | "Critical" | "High" | "Medium" | "Low";

export function ViolationExplorer({ domain, metrics }: ViolationExplorerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<SeverityFilter>("all");

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

  const severityOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const sorted = [...violations]
    .filter((v) => filter === "all" || v.riskLevel === filter)
    .sort((a, b) => severityOrder[a.riskLevel] - severityOrder[b.riskLevel]);

  const severityStyle: Record<string, { dot: string; badge: string; border: string }> = {
    Critical: { dot: "bg-data-rose", badge: "bg-data-rose/15 text-data-rose", border: "border-l-data-rose" },
    High: { dot: "bg-data-amber", badge: "bg-data-amber/15 text-data-amber", border: "border-l-data-amber" },
    Medium: { dot: "bg-data-violet", badge: "bg-data-violet/15 text-data-violet", border: "border-l-data-violet" },
    Low: { dot: "bg-muted-foreground", badge: "bg-muted/50 text-muted-foreground", border: "border-l-muted-foreground" },
  };

  const severityCounts = violations.reduce<Record<string, number>>((acc, v) => {
    acc[v.riskLevel] = (acc[v.riskLevel] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="surface-panel rounded-lg p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-data-rose/15 flex items-center justify-center ring-1 ring-data-rose/20">
            <AlertTriangle className="w-5 h-5 text-data-rose" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Violation Explorer</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{violations.length} violation(s) detected</p>
          </div>
        </div>
      </div>

      {/* Severity Filter Chips */}
      {violations.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <button
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
              filter === "all" ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "surface-raised text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({violations.length})
          </button>
          {(["Critical", "High", "Medium", "Low"] as const).map((level) => {
            const count = severityCounts[level] ?? 0;
            if (count === 0) return null;
            const style = severityStyle[level];
            return (
              <button
                key={level}
                onClick={() => setFilter(filter === level ? "all" : level)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  filter === level ? `${style.badge} ring-1 ring-current/20` : "surface-raised text-muted-foreground hover:text-foreground"
                }`}
              >
                {level} ({count})
              </button>
            );
          })}
        </div>
      )}

      {sorted.length === 0 && violations.length === 0 ? (
        <div className="surface-raised rounded-lg p-8 text-center">
          <span className="text-data-emerald text-sm font-medium">All checks passed — no violations found.</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="surface-raised rounded-lg p-6 text-center">
          <span className="text-sm text-muted-foreground">No violations match the current filter.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((v) => {
            const isExpanded = expandedId === v.ruleId;
            const style = severityStyle[v.riskLevel];
            const audit = auditFindings.find((af) => af.standardCode.includes(v.ruleId.split("-").slice(1).join("-")) || af.remediation === v.recommendation);
            const rule = RULE_LIBRARY.find((r) => r.id === v.ruleId);
            const standard = rule
              ? STANDARD_CATALOG.find((s) => s.clauses.some((c) => rule.standardCode.includes(c.clauseId)))
              : undefined;

            return (
              <div key={v.ruleId} className={`rounded-lg border border-surface-border overflow-hidden border-l-2 ${style.border} transition-all duration-200`}>
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
                  <div className="px-4 pb-4 pl-12 space-y-3 border-t border-surface-border pt-3 animate-fade-in">
                    {/* Description */}
                    {rule && (
                      <p className="text-xs text-muted-foreground italic">{rule.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground block mb-1">Measured Value</span>
                        <span className="font-mono text-data-rose font-semibold">{v.measuredValue.toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-1">Required Threshold</span>
                        <span className="font-mono text-foreground font-semibold">{rule?.operator ?? "≤"} {v.threshold}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-muted-foreground block mb-1">Recommendation</span>
                      <p className="text-sm text-foreground leading-relaxed">{v.recommendation}</p>
                    </div>

                    {/* Regulatory Reference */}
                    {standard && (
                      <div className="surface-raised rounded-md p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <ExternalLink className="w-3 h-3 text-primary" />
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Regulatory Reference</span>
                        </div>
                        <p className="text-xs text-foreground font-medium">{standard.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{standard.issuingBody} · Edition {standard.editionYear}</p>
                      </div>
                    )}

                    {audit?.deadline && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-muted-foreground" />
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
