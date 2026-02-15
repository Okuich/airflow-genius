import { useState, useMemo } from "react";
import { Shield, AlertTriangle, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { ComplianceOrchestrator } from "@/packages/compliance-engine";
import type { CompliancePipelineResult, AirflowComplianceDomain } from "@/packages/types";

interface ComplianceOverviewProps {
  domain: AirflowComplianceDomain;
  metrics: Record<string, number>;
}

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
    compliant: { label: "Compliant", icon: CheckCircle, color: "text-data-emerald", bg: "bg-data-emerald/15" },
    conditionally_compliant: { label: "Conditionally Compliant", icon: AlertTriangle, color: "text-data-amber", bg: "bg-data-amber/15" },
    non_compliant: { label: "Non-Compliant", icon: XCircle, color: "text-data-rose", bg: "bg-data-rose/15" },
  };

  const verdict = verdictConfig[auditDocument.overallVerdict];
  const VerdictIcon = verdict.icon;

  return (
    <div className="surface-panel rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Compliance Overview</h2>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{domain.replace("-", " ")} Domain</p>
          </div>
        </div>
        <div className={`status-badge ${verdict.bg} ${verdict.color}`}>
          <VerdictIcon className="w-3.5 h-3.5" />
          {verdict.label}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface-raised rounded-lg p-4">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Risk Score</span>
          <div className={`text-2xl font-mono font-semibold mt-1 ${
            riskReport.overallScore >= 50 ? "text-data-rose" : riskReport.overallScore >= 25 ? "text-data-amber" : "text-data-emerald"
          }`}>
            {riskReport.overallScore}<span className="text-sm text-muted-foreground">/100</span>
          </div>
        </div>
        <div className="surface-raised rounded-lg p-4">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Compliance Prob.</span>
          <div className="text-2xl font-mono font-semibold mt-1 text-data-cyan">
            {(riskReport.complianceProbability * 100).toFixed(0)}%
          </div>
        </div>
        <div className="surface-raised rounded-lg p-4">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Checks</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-mono font-semibold text-data-emerald">{passes}</span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-2xl font-mono font-semibold text-data-rose">{fails}</span>
          </div>
        </div>
        <div className="surface-raised rounded-lg p-4">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Remediation Cost</span>
          <div className="text-2xl font-mono font-semibold mt-1 text-foreground">
            ${riskReport.projectedRemediationCost.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Risk Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Risk Level</span>
          <span className="text-xs text-muted-foreground">{riskReport.highRiskCount} high-risk finding(s)</span>
        </div>
        <div className="w-full h-2 rounded-full bg-surface-overlay overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              riskReport.overallScore >= 50 ? "bg-data-rose" : riskReport.overallScore >= 25 ? "bg-data-amber" : "bg-data-emerald"
            }`}
            style={{ width: `${Math.min(riskReport.overallScore, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
