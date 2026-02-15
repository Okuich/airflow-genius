import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  PUEForecaster,
  type PUEForecast,
  type ForecastOptions,
  type PlannedUpgrade,
} from "@/modules/cfd/datacenter/pue-forecaster";
import type { DataCenterSimulationConfig } from "@/packages/types";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Zap,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ── Presets ──────────────────────────────────────────────────────────────

const PRESET_UPGRADES: PlannedUpgrade[] = [
  { monthOffset: 3, description: "Blanking panel retrofit", pueReduction: 0.04 },
  { monthOffset: 6, description: "Variable-speed CRAH fans", pueReduction: 0.06 },
  { monthOffset: 9, description: "Free cooling economiser", pueReduction: 0.08 },
];

type Scenario = "baseline" | "with-upgrades" | "aggressive-growth";

const SCENARIOS: { id: Scenario; label: string; opts: ForecastOptions }[] = [
  {
    id: "baseline",
    label: "Baseline",
    opts: { horizonMonths: 12 },
  },
  {
    id: "with-upgrades",
    label: "With Upgrades",
    opts: { horizonMonths: 12, plannedUpgrades: PRESET_UPGRADES },
  },
  {
    id: "aggressive-growth",
    label: "Aggressive Growth",
    opts: {
      horizonMonths: 12,
      workloadTrend: {
        currentUtilisation: 0.65,
        monthlyGrowthRate: 0.04,
        maxCapacity: 1000,
      },
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function trendIcon(dir: string) {
  if (dir === "improving") return <TrendingDown className="w-3.5 h-3.5 text-data-emerald" />;
  if (dir === "degrading") return <TrendingUp className="w-3.5 h-3.5 text-data-rose" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

function trendColor(dir: string) {
  if (dir === "improving") return "text-data-emerald";
  if (dir === "degrading") return "text-data-rose";
  return "text-muted-foreground";
}

// ── Custom Tooltip ───────────────────────────────────────────────────────

function ForecastTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="surface-raised border border-surface-border rounded-lg px-3 py-2 text-[11px] shadow-lg">
      <p className="font-semibold text-foreground mb-1">{d.label}</p>
      <div className="space-y-0.5 text-muted-foreground">
        <p>PUE: <span className="font-mono text-foreground">{d.pue.toFixed(3)}</span> ± {d.confidence.toFixed(3)}</p>
        <p>IT Load: <span className="font-mono text-foreground">{d.itLoad.toFixed(0)} kW</span></p>
        <p>Cooling: <span className="font-mono text-foreground">{d.coolingPower.toFixed(0)} kW</span></p>
        {d.upgradeApplied && (
          <p className="text-data-cyan font-medium mt-1">⬆ {d.upgradeApplied}</p>
        )}
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────

interface Props {
  config: DataCenterSimulationConfig;
}

export function PUEForecastPanel({ config }: Props) {
  const [scenario, setScenario] = useState<Scenario>("baseline");
  const [showDetails, setShowDetails] = useState(false);

  const forecast = useMemo<PUEForecast>(() => {
    const forecaster = new PUEForecaster();
    const opts = SCENARIOS.find((s) => s.id === scenario)?.opts ?? {};
    return forecaster.forecast(config, opts);
  }, [config, scenario]);

  const { summary, points } = forecast;

  // Build chart data with confidence bands
  const chartData = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        pueLow: Math.max(1.0, p.pue - p.confidence),
        pueHigh: p.pue + p.confidence,
      })),
    [points]
  );

  return (
    <div className="surface-raised rounded-xl border border-surface-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-data-cyan" />
          <h3 className="text-sm font-semibold text-foreground">PUE Forecast</h3>
        </div>
        <div className="flex items-center gap-1">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                scenario === s.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-3 px-5 py-3 border-b border-surface-border">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Trend</p>
          <div className={`flex items-center gap-1 mt-0.5 text-xs font-semibold capitalize ${trendColor(summary.trendDirection)}`}>
            {trendIcon(summary.trendDirection)}
            {summary.trendDirection}
          </div>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Avg PUE</p>
          <p className="text-xs font-mono font-semibold text-foreground mt-0.5">{summary.avgPUE.toFixed(3)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Range</p>
          <p className="text-xs font-mono text-foreground mt-0.5">
            {summary.minPUE.toFixed(2)} – {summary.maxPUE.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Target Hit</p>
          <p className="text-xs font-mono font-semibold mt-0.5">
            {summary.monthsUntilTarget !== null ? (
              <span className="text-data-emerald">{summary.monthsUntilTarget === 0 ? "Now" : `Month ${summary.monthsUntilTarget}`}</span>
            ) : (
              <span className="text-data-rose">Not in range</span>
            )}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="px-5 pt-4 pb-2">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="pueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(192, 85%, 55%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(192, 85%, 55%)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(192, 85%, 55%)" stopOpacity={0.08} />
                <stop offset="100%" stopColor="hsl(192, 85%, 55%)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 18%, 18%)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "hsl(215, 12%, 50%)" }}
              axisLine={{ stroke: "hsl(220, 18%, 18%)" }}
              tickLine={false}
              interval={1}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "hsl(215, 12%, 50%)" }}
              axisLine={false}
              tickLine={false}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => v.toFixed(2)}
            />
            <Tooltip content={<ForecastTooltip />} />
            <ReferenceLine
              y={config.targetPUE}
              stroke="hsl(160, 70%, 45%)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Target ${config.targetPUE}`,
                position: "insideTopRight",
                fill: "hsl(160, 70%, 45%)",
                fontSize: 9,
              }}
            />
            {/* Confidence band */}
            <Area
              type="monotone"
              dataKey="pueHigh"
              stroke="none"
              fill="url(#confGrad)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="pueLow"
              stroke="none"
              fill="transparent"
              isAnimationActive={false}
            />
            {/* Main PUE line */}
            <Area
              type="monotone"
              dataKey="pue"
              stroke="hsl(192, 85%, 55%)"
              strokeWidth={2}
              fill="url(#pueGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "hsl(192, 85%, 55%)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Upgrade timeline (for with-upgrades scenario) */}
      {scenario === "with-upgrades" && (
        <div className="px-5 pb-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Planned Upgrades Timeline
          </button>
          {showDetails && (
            <div className="mt-2 space-y-1.5 animate-fade-in">
              {PRESET_UPGRADES.map((u, i) => {
                const point = points.find((p) => p.month === u.monthOffset);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 surface-overlay rounded-md px-3 py-2 text-[11px] border border-surface-border"
                  >
                    <span className="font-mono text-data-cyan w-16">{point?.label ?? `M+${u.monthOffset}`}</span>
                    <span className="text-foreground flex-1">{u.description}</span>
                    <span className="font-mono text-data-emerald">-{u.pueReduction.toFixed(2)} PUE</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 border-t border-surface-border flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          Baseline: {forecast.baselinePUE.toFixed(3)}
        </span>
        <span className="flex items-center gap-1">
          <Target className="w-3 h-3" />
          Target: {config.targetPUE}
        </span>
        <span>Horizon: {forecast.horizonMonths} months</span>
      </div>
    </div>
  );
}
