import { useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ComplianceOverview } from "@/components/compliance/ComplianceOverview";
import { RegulationSelector } from "@/components/compliance/RegulationSelector";
import { RiskHeatmap } from "@/components/compliance/RiskHeatmap";
import { AuditReportGenerator } from "@/components/compliance/AuditReportGenerator";
import { ViolationExplorer } from "@/components/compliance/ViolationExplorer";
import { AIComplianceAdvisor } from "@/components/compliance/AIComplianceAdvisor";
import type { AirflowComplianceDomain } from "@/packages/types";

/** Sample metric sets per domain for demonstration. */
const DOMAIN_METRICS: Record<AirflowComplianceDomain, Record<string, number>> = {
  hvac: { outdoorAirRate: 2.0, exhaustAirflow: 0.3, operativeTemperature: 28.5, maxAirSpeed: 1.1 },
  cleanroom: { airChangeRate: 200, laminarCoverage: 0.72, recoveryTime: 1500 },
  exhaust: { captureVelocity: 0.3, peakConcentration: 65, twaConcentration: 30, faceVelocity: 0.35 },
  agriculture: { ammoniaConcentration: 30 },
  "data-center": { estimatedPUE: 1.6, rackInletTemp: 16 },
  general: {},
};

const Compliance = () => {
  const [domain, setDomain] = useState<AirflowComplianceDomain>("exhaust");
  const metrics = DOMAIN_METRICS[domain];

  return (
    <div className="flex h-screen overflow-hidden dark">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto bg-background grid-engineering">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-8 py-4">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Compliance & Audit</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Regulatory compliance analysis, risk assessment, and audit report generation</p>
        </header>

        <div className="p-8 space-y-6">
          <RegulationSelector selected={domain} onChange={setDomain} />
          <ComplianceOverview domain={domain} metrics={metrics} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <RiskHeatmap domain={domain} metrics={metrics} />
            <ViolationExplorer domain={domain} metrics={metrics} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <AuditReportGenerator domain={domain} metrics={metrics} />
            <AIComplianceAdvisor domain={domain} metrics={metrics} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Compliance;
