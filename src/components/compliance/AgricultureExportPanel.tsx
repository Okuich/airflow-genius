import { useState, useMemo, useCallback } from "react";
import { Wheat, Download, FileJson, FileSpreadsheet, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  AgricultureMetricsExporter,
  downloadBlob,
  type AgricultureExportPayload,
  type AgricultureExportFormat,
} from "@/modules/cfd/agriculture/agriculture-metrics-exporter";
import { AmmoniaRiskEstimator } from "@/modules/cfd/agriculture/ammonia-risk-estimator";
import { HeatStressPredictor } from "@/modules/cfd/agriculture/heat-stress-predictor";
import type {
  AgricultureVentilationMetrics,
  AgricultureSimulationConfig,
} from "@/packages/types";

// ── Demo config for standalone use ─────────────────────────────────────────

const DEMO_CONFIG: AgricultureSimulationConfig = {
  id: "demo-agri",
  name: "Demo Livestock Facility",
  description: "Demo agriculture simulation for export",
  flowType: "incompressible" as any,
  turbulenceModel: { type: "k-epsilon" as any, wallFunction: true, turbulentIntensity: 0.05, turbulentViscosityRatio: 10, kInitial: 0.1 },
  meshSettings: { baseSize: 0.5, minSize: 0.05, maxSize: 1, refinementLevels: 2, boundaryLayerCount: 3, boundaryLayerGrowthRate: 1.2, targetCellCount: 50000, featureAngle: 30, qualityThreshold: 0.7 },
  solverSettings: { flowType: "incompressible" as any, maxIterations: 500, convergenceCriteria: 1e-4, relaxationPressure: 0.3, relaxationVelocity: 0.7, relaxationTurbulence: 0.8 },
  boundaryConditions: [],
  fluidDensity: 1.2,
  fluidViscosity: 1.8e-5,
  enableHeatTransfer: true,
  referencePressure: 101325,
  multiZoneModel: {
    enabled: true,
    zones: [
      { id: "z1", name: "Main Barn", volume: 4000, temperature: 28, relativeHumidity: 0.65, ammoniaEmissionRate: 120, animalHeatLoad: 800, moistureProductionRate: 0.5, animalCount: 200 },
      { id: "z2", name: "Farrowing Unit", volume: 800, temperature: 30, relativeHumidity: 0.70, ammoniaEmissionRate: 60, animalHeatLoad: 300, moistureProductionRate: 0.4, animalCount: 40 },
      { id: "z3", name: "Feed Storage", volume: 600, temperature: 24, relativeHumidity: 0.50, ammoniaEmissionRate: 5, animalHeatLoad: 0, moistureProductionRate: 0.05, animalCount: 0 },
    ],
    connections: [],
    enableStackEffect: true,
    windPressureCoefficient: 0.6,
  },
  moistureTransport: {
    enabled: true,
    ambientHumidity: 0.60,
    ambientTemperature: 26,
    enableCondensation: false,
    enableEvaporation: true,
    latentHeatCoupling: false,
  },
  ammoniaLimit: 25,
  heatStressThreshold: 0.5,
  buildingVolume: 5400,
  livestockType: "swine",
};

const DEMO_METRICS: AgricultureVentilationMetrics = {
  ammoniaConcentration: 18,
  heatStressIndex: 0.35,
  humidityStability: 0.82,
  airflowUniformityIndex: 0.71,
};

// ── Component ──────────────────────────────────────────────────────────────

interface AgricultureExportPanelProps {
  domain: string;
  metrics: Record<string, number>;
}

const FORMAT_OPTIONS: { id: AgricultureExportFormat; label: string; icon: React.ElementType }[] = [
  { id: "csv", label: "CSV", icon: FileSpreadsheet },
  { id: "json", label: "JSON", icon: FileJson },
];

const STATUS_STYLE = {
  pass: { icon: CheckCircle2, color: "text-data-emerald", bg: "bg-data-emerald/10" },
  warning: { icon: AlertTriangle, color: "text-data-amber", bg: "bg-data-amber/10" },
  fail: { icon: AlertTriangle, color: "text-data-rose", bg: "bg-data-rose/10" },
};

export function AgricultureExportPanel({ domain, metrics }: AgricultureExportPanelProps) {
  const [format, setFormat] = useState<AgricultureExportFormat>("csv");
  const [payload, setPayload] = useState<AgricultureExportPayload | null>(null);

  const isAgri = domain === "agriculture";

  const handleGenerate = useCallback(() => {
    const exporter = new AgricultureMetricsExporter();

    // Use demo metrics enriched with any passed-in metric overrides
    const ventMetrics: AgricultureVentilationMetrics = {
      ...DEMO_METRICS,
      ammoniaConcentration: metrics.ammoniaConcentration ?? DEMO_METRICS.ammoniaConcentration,
    };

    const ammoniaEstimator = new AmmoniaRiskEstimator();
    const heatPredictor = new HeatStressPredictor();

    const ammoniaAssessment = ammoniaEstimator.estimate(DEMO_CONFIG, ventMetrics);
    const heatStressAssessment = heatPredictor.assess(DEMO_CONFIG, ventMetrics);

    const today = new Date().toISOString().slice(0, 10);
    const result = exporter.buildPayload({
      organizationId: "org-current",
      facilityName: "Livestock Facility A",
      livestockType: DEMO_CONFIG.livestockType,
      reportingPeriod: { from: today, to: today },
      metrics: ventMetrics,
      ammoniaAssessment,
      heatStressAssessment,
      ammoniaLimitPpm: DEMO_CONFIG.ammoniaLimit,
    });
    setPayload(result);
  }, [metrics]);

  const handleDownload = useCallback(() => {
    if (!payload) return;
    const exporter = new AgricultureMetricsExporter();
    const { content, filename, mimeType } = exporter.export(payload, format);
    downloadBlob(content, filename, mimeType);
  }, [payload, format]);

  if (!isAgri) return null;

  return (
    <div className="surface-panel rounded-lg p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-data-emerald/15 flex items-center justify-center ring-1 ring-data-emerald/20">
          <Wheat className="w-5 h-5 text-data-emerald" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Agriculture Metrics Export</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Export ventilation, ammonia &amp; heat stress data for regulatory reporting
          </p>
        </div>
      </div>

      {/* Format Selection */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 block">Export Format</label>
        <div className="flex gap-2">
          {FORMAT_OPTIONS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                  format === f.id
                    ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/20"
                    : "border-surface-border bg-surface-raised text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Generate */}
      <button
        onClick={handleGenerate}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium"
      >
        <Wheat className="w-4 h-4" />
        Generate Agriculture Report
      </button>

      {/* Results */}
      {payload && (
        <div className="space-y-4 animate-fade-in">
          {/* Regulatory summary */}
          <div className="surface-raised rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-data-emerald" />
              <span className="text-xs font-semibold text-foreground">Regulatory Compliance Summary</span>
            </div>

            <div className="space-y-2">
              {payload.regulatoryStandards.map((r, i) => {
                const st = STATUS_STYLE[r.status];
                const StIcon = st.icon;
                return (
                  <div key={i} className={`flex items-center justify-between rounded-md px-3 py-2 ${st.bg}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <StIcon className={`w-3.5 h-3.5 shrink-0 ${st.color}`} />
                      <span className="text-xs text-foreground truncate">{r.description}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {r.actualValue} / {r.threshold} {r.unit}
                      </span>
                      <span className={`text-[10px] font-bold uppercase ${st.color}`}>{r.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg surface-raised border border-surface-border text-sm text-foreground hover:bg-surface-overlay transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download {format.toUpperCase()} Report
          </button>

          {/* Preview */}
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Preview</span>
            <pre className="surface-raised rounded-lg p-4 text-xs font-mono text-muted-foreground overflow-auto max-h-48 whitespace-pre-wrap">
              {format === "json"
                ? JSON.stringify(payload, null, 2).slice(0, 1500)
                : new AgricultureMetricsExporter().export(payload, "csv").content.slice(0, 1500)}
              {"\n… (truncated)"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
