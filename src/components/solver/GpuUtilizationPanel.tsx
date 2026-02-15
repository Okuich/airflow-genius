import { useState, useEffect, useCallback } from "react";
import { Flame, Thermometer, MemoryStick, Zap, Activity } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { Progress } from "@/components/ui/progress";

// ── Types ────────────────────────────────────────────────────────────────

interface GpuDevice {
  id: string;
  name: string;
  utilization: number;
  memoryUsed: number;
  memoryTotal: number;
  temperature: number;
  power: number;
  powerLimit: number;
  assignedJob: string | null;
}

interface GpuSnapshot {
  timestamp: number;
  avgUtil: number;
  avgTemp: number;
  avgMem: number;
}

// ── Simulated GPU Data ──────────────────────────────────────────────────

const GPU_NAMES = [
  "NVIDIA A100 80GB #0",
  "NVIDIA A100 80GB #1",
  "NVIDIA A100 80GB #2",
  "NVIDIA A100 80GB #3",
];

const JOB_NAMES = [
  "HVAC-duct-sim-003",
  "turbine-blade-opt",
  null,
  "cleanroom-laminar",
];

function generateGpuSnapshot(prev?: GpuDevice[]): GpuDevice[] {
  return GPU_NAMES.map((name, i) => {
    const prevDev = prev?.[i];
    const hasJob = JOB_NAMES[i] !== null;
    const baseUtil = hasJob ? 75 + Math.random() * 20 : 2 + Math.random() * 5;
    const util = prevDev
      ? Math.max(0, Math.min(100, prevDev.utilization + (baseUtil - prevDev.utilization) * 0.3 + (Math.random() - 0.5) * 8))
      : baseUtil;
    const memTotal = 81920;
    const baseMem = hasJob ? 45000 + Math.random() * 25000 : 1200 + Math.random() * 800;
    const memUsed = prevDev
      ? Math.max(0, Math.min(memTotal, prevDev.memoryUsed + (baseMem - prevDev.memoryUsed) * 0.2 + (Math.random() - 0.5) * 2000))
      : baseMem;
    const baseTemp = hasJob ? 62 + Math.random() * 15 : 34 + Math.random() * 4;
    const temp = prevDev
      ? Math.max(25, Math.min(90, prevDev.temperature + (baseTemp - prevDev.temperature) * 0.15 + (Math.random() - 0.5) * 3))
      : baseTemp;
    const powerLimit = 300;
    const basePower = hasJob ? 180 + Math.random() * 100 : 25 + Math.random() * 15;
    const power = prevDev
      ? Math.max(0, Math.min(powerLimit, prevDev.power + (basePower - prevDev.power) * 0.2 + (Math.random() - 0.5) * 20))
      : basePower;

    return {
      id: `gpu-${i}`,
      name,
      utilization: Math.round(util * 10) / 10,
      memoryUsed: Math.round(memUsed),
      memoryTotal: memTotal,
      temperature: Math.round(temp * 10) / 10,
      power: Math.round(power),
      powerLimit,
      assignedJob: JOB_NAMES[i],
    };
  });
}

// ── Component ───────────────────────────────────────────────────────────

const MAX_HISTORY = 60;

export function GpuUtilizationPanel() {
  const [devices, setDevices] = useState<GpuDevice[]>(() => generateGpuSnapshot());
  const [history, setHistory] = useState<GpuSnapshot[]>([]);

  const tick = useCallback(() => {
    setDevices((prev) => {
      const next = generateGpuSnapshot(prev);
      const avgUtil = next.reduce((s, d) => s + d.utilization, 0) / next.length;
      const avgTemp = next.reduce((s, d) => s + d.temperature, 0) / next.length;
      const avgMem = next.reduce((s, d) => s + (d.memoryUsed / d.memoryTotal) * 100, 0) / next.length;
      setHistory((h) => [
        ...h.slice(-(MAX_HISTORY - 1)),
        { timestamp: Date.now(), avgUtil: Math.round(avgUtil * 10) / 10, avgTemp: Math.round(avgTemp), avgMem: Math.round(avgMem) },
      ]);
      return next;
    });
  }, []);

  useEffect(() => {
    tick();
    const interval = setInterval(tick, 2000);
    return () => clearInterval(interval);
  }, [tick]);

  const clusterUtil = devices.reduce((s, d) => s + d.utilization, 0) / devices.length;
  const clusterTemp = devices.reduce((s, d) => s + d.temperature, 0) / devices.length;
  const totalPower = devices.reduce((s, d) => s + d.power, 0);
  const activeGpus = devices.filter((d) => d.assignedJob).length;

  const tooltipStyle = {
    background: "hsl(var(--surface))",
    border: "1px solid hsl(var(--surface-border))",
    borderRadius: 8,
    fontSize: 11,
    color: "hsl(var(--foreground))",
  };

  return (
    <div className="surface-panel rounded-lg p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Flame className="w-4 h-4 text-data-amber" />
          GPU Cluster Utilization
          <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-data-emerald/15 text-data-emerald text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-data-emerald animate-pulse" />
            LIVE
          </span>
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span><strong className="text-foreground">{activeGpus}</strong>/{devices.length} active</span>
          <span className="text-surface-border">|</span>
          <span>{totalPower}W total</span>
        </div>
      </div>

      {/* Cluster overview gauges */}
      <div className="grid grid-cols-3 gap-4">
        <ClusterGauge label="Avg Utilization" value={clusterUtil} unit="%" color="data-cyan" max={100} />
        <ClusterGauge label="Avg Temperature" value={clusterTemp} unit="°C" color="data-amber" max={90} warn={75} />
        <ClusterGauge label="Total Power" value={totalPower} unit="W" color="data-violet" max={devices.length * 300} />
      </div>

      {/* Utilization Sparkline */}
      {history.length > 2 && (
        <div className="h-[100px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--data-cyan))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--data-cyan))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Tooltip contentStyle={tooltipStyle} labelFormatter={() => ""} formatter={(v: number, name: string) => {
                const labels: Record<string, string> = { avgUtil: "Util %", avgTemp: "Temp °C", avgMem: "Mem %" };
                return [`${v}`, labels[name] ?? name];
              }} />
              <Area type="monotone" dataKey="avgUtil" stroke="hsl(var(--data-cyan))" fill="url(#utilGrad)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="avgMem" stroke="hsl(var(--data-violet))" fill="none" strokeWidth={1} strokeDasharray="4 2" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-GPU Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {devices.map((gpu) => (
          <GpuDeviceCard key={gpu.id} gpu={gpu} />
        ))}
      </div>
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────────────────────

function ClusterGauge({ label, value, unit, color, max, warn }: {
  label: string;
  value: number;
  unit: string;
  color: string;
  max: number;
  warn?: number;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const isWarn = warn !== undefined && value >= warn;

  return (
    <div className="surface-raised rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`text-lg font-mono font-semibold ${isWarn ? "text-data-rose" : `text-${color}`}`}>
          {Math.round(value)}{unit}
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-surface-overlay overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isWarn ? "bg-data-rose" : `bg-${color}`}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function GpuDeviceCard({ gpu }: { gpu: GpuDevice }) {
  const memPct = (gpu.memoryUsed / gpu.memoryTotal) * 100;
  const tempColor = gpu.temperature >= 80 ? "text-data-rose" : gpu.temperature >= 65 ? "text-data-amber" : "text-data-emerald";
  const utilColor = gpu.utilization > 85 ? "text-data-cyan" : gpu.utilization > 30 ? "text-data-emerald" : "text-muted-foreground";

  return (
    <div className="surface-raised rounded-lg p-4 ring-1 ring-surface-border hover:ring-primary/20 transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">{gpu.name}</span>
        {gpu.assignedJob ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-data-cyan/15 text-data-cyan text-[10px] font-mono">
            <Activity className="w-3 h-3 animate-pulse" />
            {gpu.assignedJob}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50">Idle</span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 text-center">
        {/* Utilization */}
        <div>
          <Zap className={`w-3.5 h-3.5 mx-auto mb-1 ${utilColor}`} />
          <div className={`text-sm font-mono font-semibold ${utilColor}`}>{gpu.utilization.toFixed(1)}%</div>
          <div className="text-[9px] text-muted-foreground uppercase">Util</div>
        </div>

        {/* Memory */}
        <div>
          <MemoryStick className="w-3.5 h-3.5 mx-auto mb-1 text-data-violet" />
          <div className="text-sm font-mono font-semibold text-data-violet">{(gpu.memoryUsed / 1024).toFixed(1)}G</div>
          <div className="text-[9px] text-muted-foreground uppercase">{memPct.toFixed(0)}% Mem</div>
        </div>

        {/* Temperature */}
        <div>
          <Thermometer className={`w-3.5 h-3.5 mx-auto mb-1 ${tempColor}`} />
          <div className={`text-sm font-mono font-semibold ${tempColor}`}>{gpu.temperature.toFixed(0)}°C</div>
          <div className="text-[9px] text-muted-foreground uppercase">Temp</div>
        </div>

        {/* Power */}
        <div>
          <Flame className="w-3.5 h-3.5 mx-auto mb-1 text-data-amber" />
          <div className="text-sm font-mono font-semibold text-data-amber">{gpu.power}W</div>
          <div className="text-[9px] text-muted-foreground uppercase">{gpu.powerLimit}W max</div>
        </div>
      </div>

      {/* Utilization bar */}
      <div className="mt-3">
        <Progress value={gpu.utilization} className="h-1.5" />
      </div>
    </div>
  );
}
