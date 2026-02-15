import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ComplianceOverview } from "@/components/compliance/ComplianceOverview";
import { RegulationSelector } from "@/components/compliance/RegulationSelector";
import { ComplianceFilters } from "@/components/compliance/ComplianceFilters";
import type { ComplianceRegion, ComplianceIndustry } from "@/components/compliance/ComplianceFilters";
import { RiskHeatmap } from "@/components/compliance/RiskHeatmap";
import { AuditReportGenerator } from "@/components/compliance/AuditReportGenerator";
import { ComplianceExportPanel } from "@/components/compliance/ComplianceExportPanel";
import { AgricultureExportPanel } from "@/components/compliance/AgricultureExportPanel";
import { ViolationExplorer } from "@/components/compliance/ViolationExplorer";
import { RiskTrendPanel } from "@/components/compliance/RiskTrendPanel";
import { AIComplianceAdvisor } from "@/components/compliance/AIComplianceAdvisor";
import { ComplianceGuidedTour, TourLaunchButton } from "@/components/compliance/ComplianceGuidedTour";
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
  const [region, setRegion] = useState<ComplianceRegion>("US");
  const [industry, setIndustry] = useState<ComplianceIndustry>("Exhaust");
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tourKey, setTourKey] = useState(0);
  const metrics = DOMAIN_METRICS[domain];

  useEffect(() => {
    const handler = () => setTourKey((k) => k + 1);
    window.addEventListener("start-compliance-tour", handler);
    return () => window.removeEventListener("start-compliance-tour", handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden dark">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto bg-background grid-engineering">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Compliance & Audit</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Regulatory compliance analysis, risk assessment, and audit report generation</p>
          </div>
          <TourLaunchButton />
        </header>

        <div className="p-8 space-y-6">
          <div data-tour="regulation-selector">
            <RegulationSelector selected={domain} onChange={setDomain} />
          </div>
          <ComplianceFilters
            region={region}
            industry={industry}
            effectiveDate={effectiveDate}
            onRegionChange={setRegion}
            onIndustryChange={setIndustry}
            onEffectiveDateChange={setEffectiveDate}
          />
          <div data-tour="compliance-overview">
            <ComplianceOverview domain={domain} metrics={metrics} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div data-tour="risk-heatmap">
              <RiskHeatmap domain={domain} metrics={metrics} />
            </div>
            <div data-tour="risk-trend">
              <RiskTrendPanel domain={domain} metrics={metrics} />
            </div>
          </div>

          <div data-tour="violation-explorer">
            <ViolationExplorer domain={domain} metrics={metrics} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <AuditReportGenerator domain={domain} metrics={metrics} />
            <div data-tour="export-panel">
              <ComplianceExportPanel domain={domain} metrics={metrics} />
            </div>
            <div data-tour="ai-advisor">
              <AIComplianceAdvisor domain={domain} metrics={metrics} />
            </div>
          </div>

          <AgricultureExportPanel domain={domain} metrics={metrics} />
        </div>
      </main>

      <ComplianceGuidedTour key={tourKey} />
    </div>
  );
};

export default Compliance;
