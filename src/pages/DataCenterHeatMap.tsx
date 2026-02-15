import { useState, useMemo, useCallback } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import {
  CoolingEfficiencyPredictor,
  CoolingTopologyOptimizer,
  type CoolingEfficiencyReport,
  type OptimizationResult,
} from "@/modules/cfd/datacenter";
import type {
  DataCenterSimulationConfig,
  RackTemperature,
  PUEBreakdown,
} from "@/packages/types";
import {
  Thermometer,
  Zap,
  Wind,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  BarChart3,
  Sparkles,
  ChevronRight,
} from "lucide-react";

// ── Demo Config ──────────────────────────────────────────────────────────

const DEMO_CONFIG: DataCenterSimulationConfig = {
  id: "dc-demo",
  name: "Data Hall A",
  description: "Primary compute data hall",
  flowType: "incompressible" as any,
  turbulenceModel: { type: "k-epsilon" as any, wallFunction: true, turbulentIntensity: 0.05, turbulentViscosityRatio: 10, kInitial: 0.1 },
  meshSettings: { baseSize: 0.5, minSize: 0.05, maxSize: 1, refinementLevels: 2, boundaryLayerCount: 3, boundaryLayerGrowthRate: 1.2, targetCellCount: 50000, featureAngle: 30, qualityThreshold: 0.7 },
  solverSettings: { flowType: "incompressible" as any, maxIterations: 500, convergenceCriteria: 1e-4, relaxationPressure: 0.3, relaxationVelocity: 0.7, relaxationTurbulence: 0.8 },
  boundaryConditions: [],
  fluidDensity: 1.2,
  fluidViscosity: 1.8e-5,
  enableHeatTransfer: true,
  referencePressure: 101325,
  rackHeatLoad: {
    totalITLoad: 600,
    rackLoads: [
      { id: "r1", name: "A-01", heatLoad: 12, rackUnits: 42, airflowDemand: 0.9, position: { row: 1, column: 1 } },
      { id: "r2", name: "A-02", heatLoad: 18, rackUnits: 42, airflowDemand: 0.7, position: { row: 1, column: 2 } },
      { id: "r3", name: "A-03", heatLoad: 22, rackUnits: 42, airflowDemand: 0.6, position: { row: 1, column: 3 } },
      { id: "r4", name: "A-04", heatLoad: 10, rackUnits: 42, airflowDemand: 1.0, position: { row: 1, column: 4 } },
      { id: "r5", name: "B-01", heatLoad: 25, rackUnits: 42, airflowDemand: 0.5, position: { row: 2, column: 1 } },
      { id: "r6", name: "B-02", heatLoad: 15, rackUnits: 42, airflowDemand: 0.8, position: { row: 2, column: 2 } },
      { id: "r7", name: "B-03", heatLoad: 30, rackUnits: 42, airflowDemand: 0.4, position: { row: 2, column: 3 } },
      { id: "r8", name: "B-04", heatLoad: 8, rackUnits: 42, airflowDemand: 1.1, position: { row: 2, column: 4 } },
      { id: "r9", name: "C-01", heatLoad: 20, rackUnits: 42, airflowDemand: 0.65, position: { row: 3, column: 1 } },
      { id: "r10", name: "C-02", heatLoad: 14, rackUnits: 42, airflowDemand: 0.85, position: { row: 3, column: 2 } },
      { id: "r11", name: "C-03", heatLoad: 28, rackUnits: 42, airflowDemand: 0.45, position: { row: 3, column: 3 } },
      { id: "r12", name: "C-04", heatLoad: 11, rackUnits: 42, airflowDemand: 0.95, position: { row: 3, column: 4 } },
    ],
    supplyAirTemperature: 17,
    returnAirThreshold: 35,
    hotspotThreshold: 5,
  },
  containment: {
    type: "hot-aisle",
    blankingPanelCoverage: 0.72,
    cableCutoutSealFraction: 0.60,
    aboveRackGap: 0.15,
    doorSealQuality: 0.65,
  },
  raisedFloorDepth: 0.25,
  tileOpenAreaFraction: 0.22,
  coolingUnitCount: 3,
  totalCoolingCapacity: 550,
  targetPUE: 1.4,
};

// ── Helpers ──────────────────────────────────────────────────────────────

function tempColor(exhaust: number, isHotspot: boolean): string {
  if (isHotspot) return "bg-data-rose/80 ring-2 ring-data-rose/40";
  if (exhaust > 38) return "bg-data-amber/60";
  if (exhaust > 32) return "bg-data-amber/30";
  return "bg-data-emerald/30";
}

function tempTextColor(exhaust: number, isHotspot: boolean): string {
  if (isHotspot) return "text-data-rose";
  if (exhaust > 38) return "text-data-amber";
  return "text-data-emerald";
}

function pueColor(pue: number): string {
  if (pue <= 1.2) return "text-data-emerald";
  if (pue <= 1.5) return "text-data-cyan";
  if (pue <= 2.0) return "text-data-amber";
  return "text-data-rose";
}

function riskBadge(risk: string) {
  const map: Record<string, { bg: string; text: string }> = {
    safe: { bg: "bg-data-emerald/15", text: "text-data-emerald" },
    caution: { bg: "bg-data-amber/15", text: "text-data-amber" },
    warning: { bg: "bg-data-amber/15", text: "text-data-amber" },
    critical: { bg: "bg-data-rose/15", text: "text-data-rose" },
  };
  const s = map[risk] ?? map.caution;
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${s.bg} ${s.text}`}>{risk}</span>;
}

// ── Metric Card ──────────────────────────────────────────────────────────

function MetricTile({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="surface-raised rounded-xl border border-surface-border p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}/15`}>
        <Icon className={`w-4.5 h-4.5 ${color}`} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground font-mono mt-0.5">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── PUE Breakdown Bar ────────────────────────────────────────────────────

function PUEBreakdownBar({ breakdown, pue }: { breakdown: PUEBreakdown; pue: number }) {
  const total = 1 + breakdown.coolingOverhead + breakdown.airMovementOverhead + breakdown.otherOverhead;
  const pcts = {
    it: (1 / total) * 100,
    cooling: (breakdown.coolingOverhead / total) * 100,
    air: (breakdown.airMovementOverhead / total) * 100,
    other: (breakdown.otherOverhead / total) * 100,
  };

  return (
    <div className="surface-raised rounded-xl border border-surface-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-data-violet" />
          PUE Breakdown
        </h3>
        <span className={`text-sm font-mono font-bold ${pueColor(pue)}`}>{pue.toFixed(2)}</span>
      </div>
      <div className="w-full h-4 rounded-full overflow-hidden flex">
        <div className="bg-data-cyan h-full" style={{ width: `${pcts.it}%` }} title="IT Load" />
        <div className="bg-data-violet h-full" style={{ width: `${pcts.cooling}%` }} title="Cooling" />
        <div className="bg-data-amber h-full" style={{ width: `${pcts.air}%` }} title="Air Movement" />
        <div className="bg-muted-foreground/30 h-full" style={{ width: `${pcts.other}%` }} title="Other" />
      </div>
      <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-data-cyan" />IT Load</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-data-violet" />Cooling ({(breakdown.coolingOverhead * 100).toFixed(0)}%)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-data-amber" />Air Mvmt ({(breakdown.airMovementOverhead * 100).toFixed(0)}%)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/30" />Other</span>
      </div>
    </div>
  );
}

// ── Rack Heat Map Grid ───────────────────────────────────────────────────

function RackHeatGrid({ racks, selected, onSelect }: {
  racks: RackTemperature[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  // Group by row
  const rows = useMemo(() => {
    const map = new Map<number, { rack: RackTemperature; col: number }[]>();
    racks.forEach((r, i) => {
      const cfg = DEMO_CONFIG.rackHeatLoad.rackLoads[i];
      const row = cfg?.position.row ?? 1;
      const col = cfg?.position.column ?? (i + 1);
      if (!map.has(row)) map.set(row, []);
      map.get(row)!.push({ rack: r, col });
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [racks]);

  return (
    <div className="surface-raised rounded-xl border border-surface-border p-5">
      <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 mb-4">
        <Thermometer className="w-3.5 h-3.5 text-data-rose" />
        Rack Thermal Map
      </h3>
      <div className="space-y-2">
        {rows.map(([rowIdx, cols]) => (
          <div key={rowIdx} className="flex gap-2">
            <span className="text-[10px] text-muted-foreground font-mono w-10 shrink-0 pt-3">Row {rowIdx}</span>
            <div className="flex gap-2 flex-1">
              {cols.sort((a, b) => a.col - b.col).map(({ rack }) => {
                const isSelected = selected === rack.rackId;
                return (
                  <button
                    key={rack.rackId}
                    onClick={() => onSelect(rack.rackId)}
                    className={`flex-1 rounded-lg p-3 transition-all border ${tempColor(rack.exhaustTemperature, rack.isHotspot)} ${
                      isSelected ? "ring-2 ring-primary border-primary" : "border-transparent"
                    }`}
                  >
                    <span className="text-[10px] font-semibold text-foreground block">{rack.rackName}</span>
                    <span className={`text-sm font-mono font-bold block mt-1 ${tempTextColor(rack.exhaustTemperature, rack.isHotspot)}`}>
                      {rack.exhaustTemperature.toFixed(1)}°C
                    </span>
                    <span className="text-[9px] text-muted-foreground block mt-0.5">
                      ΔT {rack.deltaT.toFixed(1)}°
                    </span>
                    {rack.isHotspot && (
                      <span className="text-[8px] font-bold text-data-rose uppercase mt-1 block">HOTSPOT</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex gap-3 mt-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-data-emerald/30" />Normal</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-data-amber/30" />Warm</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-data-amber/60" />Hot</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-data-rose/80" />Hotspot</span>
      </div>
    </div>
  );
}

// ── Selected Rack Detail ─────────────────────────────────────────────────

function RackDetail({ rack }: { rack: RackTemperature }) {
  return (
    <div className="surface-raised rounded-xl border border-surface-border p-5 animate-fade-in">
      <h3 className="text-xs font-semibold text-foreground mb-3">Rack {rack.rackName}</h3>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground">Inlet</span>
          <span className="block font-mono text-foreground">{rack.inletTemperature.toFixed(1)} °C</span>
        </div>
        <div>
          <span className="text-muted-foreground">Exhaust</span>
          <span className={`block font-mono font-semibold ${tempTextColor(rack.exhaustTemperature, rack.isHotspot)}`}>
            {rack.exhaustTemperature.toFixed(1)} °C
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">ΔT</span>
          <span className="block font-mono text-foreground">{rack.deltaT.toFixed(1)} °C</span>
        </div>
        <div>
          <span className="text-muted-foreground">Status</span>
          <span className="block">{rack.isHotspot
            ? <span className="text-data-rose font-semibold">⚠ Hotspot</span>
            : <span className="text-data-emerald">Normal</span>
          }</span>
        </div>
      </div>
    </div>
  );
}

// ── Optimization Result Panel ────────────────────────────────────────────

function OptimizationPanel({ result }: { result: OptimizationResult }) {
  return (
    <div className="surface-raised rounded-xl border border-surface-border p-5 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-data-violet" />
        <h3 className="text-xs font-semibold text-foreground">Optimization Results</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Before</p>
          <p className="text-lg font-mono font-bold text-muted-foreground">{(result.initialScore * 100).toFixed(1)}%</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase">After</p>
          <p className="text-lg font-mono font-bold text-data-emerald">{(result.finalScore * 100).toFixed(1)}%</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Improvement</p>
          <p className="text-lg font-mono font-bold text-data-cyan flex items-center justify-center gap-1">
            <ArrowUpRight className="w-4 h-4" />
            +{(result.improvement * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {result.changeLog.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Applied Nudges ({result.iterations})</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {result.changeLog.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] surface-overlay rounded-md px-3 py-2">
                <ChevronRight className="w-3 h-3 text-data-cyan shrink-0" />
                <span className="text-foreground flex-1">{r.parameter}</span>
                <span className="font-mono text-muted-foreground">{String(r.from)}</span>
                <ArrowDownRight className="w-3 h-3 text-muted-foreground rotate-[-90deg]" />
                <span className="font-mono text-data-emerald">{String(r.to)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final PUE & hotspots */}
      <div className="flex gap-4 text-xs">
        <div>
          <span className="text-muted-foreground">Final PUE: </span>
          <span className={`font-mono font-bold ${pueColor(result.finalReport.pueEstimate.estimatedPUE)}`}>
            {result.finalReport.pueEstimate.estimatedPUE.toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Hotspots: </span>
          <span className="font-mono font-bold text-foreground">{result.finalReport.hotspotAssessment.hotspotCount}</span>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

const DataCenterHeatMap = () => {
  const [selectedRack, setSelectedRack] = useState<string | null>(null);
  const [optimResult, setOptimResult] = useState<OptimizationResult | null>(null);
  const [isOptimising, setIsOptimising] = useState(false);

  const report = useMemo<CoolingEfficiencyReport>(() => {
    const predictor = new CoolingEfficiencyPredictor();
    return predictor.predict(DEMO_CONFIG);
  }, []);

  const { hotspotAssessment, containmentAssessment, pueEstimate } = report;

  const selectedRackData = useMemo(
    () => hotspotAssessment.rackTemperatures.find((r) => r.rackId === selectedRack) ?? null,
    [selectedRack, hotspotAssessment]
  );

  const handleOptimise = useCallback(() => {
    setIsOptimising(true);
    // Small timeout so UI shows loading state
    setTimeout(() => {
      const optimizer = new CoolingTopologyOptimizer();
      const result = optimizer.optimise(DEMO_CONFIG, { maxIterations: 20 });
      setOptimResult(result);
      setIsOptimising(false);
    }, 100);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden dark">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto bg-background">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-8 py-4">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Data Center Heat Map</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Rack thermal visualization, cooling efficiency analysis &amp; PUE optimization
          </p>
        </header>

        <div className="p-8 space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricTile
              icon={Thermometer}
              label="Hotspots"
              value={String(hotspotAssessment.hotspotCount)}
              sub={`of ${hotspotAssessment.rackTemperatures.length} racks`}
              color="text-data-rose"
            />
            <MetricTile
              icon={Zap}
              label="PUE"
              value={pueEstimate.estimatedPUE.toFixed(2)}
              sub={`Target: ${DEMO_CONFIG.targetPUE} · ${pueEstimate.efficiencyClass}`}
              color="text-data-cyan"
            />
            <MetricTile
              icon={Wind}
              label="Containment"
              value={`${(containmentAssessment.containmentScore * 100).toFixed(0)}%`}
              sub={`${containmentAssessment.leakSources.length} leak source(s)`}
              color="text-data-violet"
            />
            <MetricTile
              icon={Activity}
              label="Efficiency"
              value={`${(report.coolingEfficiencyScore * 100).toFixed(1)}%`}
              sub={`Thermal risk: `}
              color="text-data-emerald"
            />
          </div>
          {/* Thermal risk badge inline */}
          <div className="flex items-center gap-2 -mt-3 pl-1">
            <span className="text-[10px] text-muted-foreground">Thermal Risk:</span>
            {riskBadge(hotspotAssessment.thermalRisk)}
          </div>

          {/* Main grid: Heat Map + Detail/Optimizer */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <RackHeatGrid
                racks={hotspotAssessment.rackTemperatures}
                selected={selectedRack}
                onSelect={setSelectedRack}
              />
              <PUEBreakdownBar breakdown={pueEstimate.breakdown} pue={pueEstimate.estimatedPUE} />
            </div>

            <div className="space-y-4">
              {/* Selected rack detail */}
              {selectedRackData && <RackDetail rack={selectedRackData} />}

              {/* Optimizer */}
              <div className="surface-raised rounded-xl border border-surface-border p-5">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-data-violet" />
                  Cooling Topology Optimizer
                </h3>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Run the hill-climbing optimizer to nudge containment, supply temperature, and cooling parameters for improved PUE and fewer hotspots.
                </p>
                <button
                  onClick={handleOptimise}
                  disabled={isOptimising}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {isOptimising ? "Optimising…" : "Run Optimization"}
                </button>
              </div>

              {optimResult && <OptimizationPanel result={optimResult} />}

              {/* Recommendations */}
              <div className="surface-raised rounded-xl border border-surface-border p-5">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-3.5 h-3.5 text-data-amber" />
                  Top Recommendations
                </h3>
                <div className="space-y-2">
                  {report.topRecommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <ChevronRight className="w-3 h-3 text-data-amber shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DataCenterHeatMap;
