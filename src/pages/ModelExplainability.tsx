import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/tenant";
import { AppSidebar } from "@/components/layout/AppSidebar";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter, Cell,
  LineChart, Line, Legend,
} from "recharts";
import {
  Brain, Eye, Layers, Activity, ArrowUpDown,
  Info, ChevronDown,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

interface ModelVersion {
  id: string;
  organization_id: string;
  model_type: string;
  version: number;
  is_active: boolean;
  training_sample_count: number;
  metrics: Record<string, unknown>;
  weights: Record<string, unknown>;
  normalization: Record<string, unknown>;
  created_at: string;
}

interface Weights {
  coefficients: number[];
  intercept: number;
  featureNames: string[];
}

interface Normalization {
  mean: number[];
  std: number[];
  featureNames: string[];
}

interface Metrics {
  r2?: number;
  mse?: number;
  mae?: number;
  sampleCount?: number;
  testR2?: number;
  overfit?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  pressure_drop: "hsl(var(--data-cyan))",
  convergence: "hsl(var(--data-emerald))",
  efficiency: "hsl(var(--data-violet))",
};

const ACCENT_CLASSES: Record<string, string> = {
  pressure_drop: "text-data-cyan",
  convergence: "text-data-emerald",
  efficiency: "text-data-violet",
};

function truncateFeatureName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ── Component ────────────────────────────────────────────────────────────

const ModelExplainability = () => {
  const { user } = useAuth();
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const { data: models = [] } = useQuery({
    queryKey: ["model-versions-explain"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ml_model_versions")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ModelVersion[];
    },
    enabled: !!user,
  });

  // Also fetch all versions for comparison charts
  const { data: allVersions = [] } = useQuery({
    queryKey: ["all-model-versions-explain"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ml_model_versions")
        .select("*")
        .order("version", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ModelVersion[];
    },
    enabled: !!user,
  });

  const selected = useMemo(() => {
    if (selectedModelId) return models.find((m) => m.id === selectedModelId) ?? models[0];
    return models[0] ?? null;
  }, [models, selectedModelId]);

  const weights = selected?.weights as unknown as Weights | undefined;
  const normalization = selected?.normalization as unknown as Normalization | undefined;
  const metrics = selected?.metrics as Metrics | undefined;

  // Feature importance: |coefficient| * std (unstandardized effect)
  const featureImportance = useMemo(() => {
    if (!weights?.coefficients || !normalization?.std) return [];
    return weights.featureNames.map((name, i) => {
      const absCoeff = Math.abs(weights.coefficients[i]);
      const std = normalization.std[i] ?? 1;
      return {
        name: truncateFeatureName(name),
        rawName: name,
        coefficient: weights.coefficients[i],
        absCoefficient: absCoeff,
        importance: absCoeff * std,
        normalizedImportance: 0, // set below
        direction: weights.coefficients[i] >= 0 ? "positive" : "negative",
        mean: normalization.mean[i] ?? 0,
        std,
      };
    }).sort((a, b) => b.importance - a.importance);
  }, [weights, normalization]);

  // Normalize importance to 0-1
  const normalizedFeatures = useMemo(() => {
    if (featureImportance.length === 0) return [];
    const maxImp = featureImportance[0]?.importance ?? 1;
    return featureImportance.map((f) => ({
      ...f,
      normalizedImportance: maxImp > 0 ? f.importance / maxImp : 0,
    }));
  }, [featureImportance]);

  // Top 6 for radar chart
  const radarData = useMemo(() => {
    return normalizedFeatures.slice(0, 6).map((f) => ({
      feature: f.name.length > 14 ? f.name.slice(0, 12) + "…" : f.name,
      importance: Math.round(f.normalizedImportance * 100),
    }));
  }, [normalizedFeatures]);

  // Coefficient waterfall (signed)
  const waterfallData = useMemo(() => {
    if (!weights?.coefficients) return [];
    return weights.featureNames
      .map((name, i) => ({
        name: truncateFeatureName(name),
        coefficient: Math.round(weights.coefficients[i] * 10000) / 10000,
      }))
      .sort((a, b) => b.coefficient - a.coefficient);
  }, [weights]);

  // Version comparison line chart per model type
  const versionComparison = useMemo(() => {
    if (!selected) return [];
    return allVersions
      .filter((v) => v.model_type === selected.model_type && v.organization_id === selected.organization_id)
      .map((v) => {
        const m = v.metrics as Metrics;
        return {
          version: `v${v.version}`,
          r2: m.r2 ?? 0,
          mse: m.mse ?? 0,
          samples: v.training_sample_count,
        };
      });
  }, [allVersions, selected]);

  // Scatter: coefficient vs std (bubble-like)
  const scatterData = useMemo(() => {
    return normalizedFeatures.map((f) => ({
      name: f.name,
      x: f.std,
      y: f.absCoefficient,
      importance: f.normalizedImportance,
    }));
  }, [normalizedFeatures]);

  if (!selected) {
    return (
      <div className="flex h-screen overflow-hidden dark">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center">
            <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground text-sm">No deployed models found. Train a model first.</p>
          </div>
        </main>
      </div>
    );
  }

  const accentClass = ACCENT_CLASSES[selected.model_type] ?? "text-data-cyan";
  const accentColor = MODEL_COLORS[selected.model_type] ?? "hsl(var(--data-cyan))";

  return (
    <div className="flex h-screen overflow-hidden dark">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto bg-background grid-engineering">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Model Explainability
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Feature importance, coefficient analysis & prediction diagnostics
            </p>
          </div>

          {/* Model selector */}
          <div className="relative">
            <select
              value={selected.id}
              onChange={(e) => setSelectedModelId(e.target.value)}
              className="appearance-none surface-raised rounded-lg px-4 py-2 pr-8 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.model_type.replace("_", " ")} v{m.version}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </header>

        <div className="p-8 space-y-6">
          {/* Model summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <SummaryCard label="Model Type" value={selected.model_type.replace("_", " ")} accent={accentClass} />
            <SummaryCard label="Version" value={`v${selected.version}`} accent={accentClass} />
            <SummaryCard label="Train R²" value={metrics?.r2?.toFixed(4) ?? "—"} accent={accentClass} />
            <SummaryCard label="Test R²" value={(metrics as Record<string, unknown>)?.testR2 != null ? Number((metrics as Record<string, unknown>).testR2).toFixed(4) : "—"} accent={accentClass} />
            <SummaryCard label="MSE" value={metrics?.mse?.toFixed(6) ?? "—"} accent="text-data-amber" />
            <SummaryCard label="Samples" value={String(selected.training_sample_count)} accent="text-data-emerald" />
            <SummaryCard label="Features" value={String(weights?.featureNames?.length ?? 0)} accent="text-data-violet" />
          </div>

          {/* Overfit warning */}
          {metrics?.overfit && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-data-rose/10 border border-data-rose/20">
              <Info className="w-4 h-4 text-data-rose shrink-0" />
              <span className="text-sm text-data-rose">
                Overfit detected — train R² significantly exceeds test R². Consider collecting more training data or applying regularization.
              </span>
            </div>
          )}

          {/* Main grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Feature Importance Bar */}
            <div className="surface-panel rounded-lg p-6">
              <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-data-cyan" />
                Feature Importance
              </h2>
              <p className="text-[11px] text-muted-foreground mb-4">
                |coefficient| × feature std — measures each feature's impact on predictions
              </p>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={normalizedFeatures} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" horizontal={false} />
                    <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={95}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--surface-border))", borderRadius: 8, fontSize: 11, color: "hsl(var(--foreground))" }}
                      formatter={(value: number, _name: string, props: { payload: { direction: string; coefficient: number; std: number } }) => {
                        const p = props.payload;
                        return [
                          `${(value * 100).toFixed(1)}% — coeff: ${p.coefficient.toFixed(4)}, std: ${p.std.toFixed(4)} (${p.direction})`,
                          "Importance",
                        ];
                      }}
                    />
                    <Bar dataKey="normalizedImportance" radius={[0, 4, 4, 0]}>
                      {normalizedFeatures.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.direction === "positive" ? "hsl(var(--data-emerald))" : "hsl(var(--data-rose))"}
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-data-emerald inline-block" /> Positive effect</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-data-rose inline-block" /> Negative effect</span>
              </div>
            </div>

            {/* Radar */}
            <div className="surface-panel rounded-lg p-6">
              <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <Activity className="w-4 h-4 text-data-violet" />
                Top Features Radar
              </h2>
              <p className="text-[11px] text-muted-foreground mb-4">
                Top 6 features by importance — radar shape shows relative contribution
              </p>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="hsl(var(--surface-border))" />
                    <PolarAngleAxis dataKey="feature" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <Radar name="Importance" dataKey="importance" stroke={accentColor} fill={accentColor} fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Coefficient Waterfall */}
            <div className="surface-panel rounded-lg p-6">
              <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <Layers className="w-4 h-4 text-data-amber" />
                Coefficient Values
              </h2>
              <p className="text-[11px] text-muted-foreground mb-4">
                Signed OLS regression coefficients — positive values increase the prediction
              </p>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfallData} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--surface-border))", borderRadius: 8, fontSize: 11, color: "hsl(var(--foreground))" }} />
                    <Bar dataKey="coefficient" radius={[4, 4, 0, 0]}>
                      {waterfallData.map((entry, i) => (
                        <Cell key={i} fill={entry.coefficient >= 0 ? "hsl(var(--data-cyan))" : "hsl(var(--data-rose))"} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {weights && (
                <div className="mt-3 text-[11px] text-muted-foreground font-mono">
                  Intercept: <span className="text-foreground font-semibold">{weights.intercept.toFixed(6)}</span>
                </div>
              )}
            </div>

            {/* Coefficient vs Feature Variability scatter */}
            <div className="surface-panel rounded-lg p-6">
              <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <Eye className="w-4 h-4 text-data-emerald" />
                Coefficient vs Feature Variability
              </h2>
              <p className="text-[11px] text-muted-foreground mb-4">
                Features with both high coefficient and high std have the most influence
              </p>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Feature Std"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: "Feature Std Dev", position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="|Coefficient|"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: "|Coefficient|", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--surface-border))", borderRadius: 8, fontSize: 11, color: "hsl(var(--foreground))" }}
                      formatter={(_v: unknown, _n: string, props: { payload: { name: string; importance: number } }) => {
                        return [`${props.payload.name} (imp: ${(props.payload.importance * 100).toFixed(1)}%)`, "Feature"];
                      }}
                    />
                    <Scatter data={scatterData}>
                      {scatterData.map((_, i) => (
                        <Cell key={i} fill={accentColor} fillOpacity={0.7} r={6 + normalizedFeatures[i]?.normalizedImportance * 8} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Version comparison */}
          {versionComparison.length > 1 && (
            <div className="surface-panel rounded-lg p-6">
              <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                Version Performance History
              </h2>
              <p className="text-[11px] text-muted-foreground mb-4">
                R² and sample count across model versions for {selected.model_type.replace("_", " ")}
              </p>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={versionComparison} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" />
                    <XAxis dataKey="version" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" domain={[0, 1]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--surface-border))", borderRadius: 8, fontSize: 11, color: "hsl(var(--foreground))" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line yAxisId="left" type="monotone" dataKey="r2" stroke={accentColor} strokeWidth={2} dot={{ r: 3 }} name="R²" />
                    <Line yAxisId="right" type="monotone" dataKey="samples" stroke="hsl(var(--data-amber))" strokeWidth={2} dot={{ r: 3 }} name="Samples" strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Normalization Table */}
          <div className="surface-panel rounded-lg p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-muted-foreground" />
              Feature Normalization Parameters
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left py-2 px-3">Feature</th>
                    <th className="text-right py-2 px-3">Mean (μ)</th>
                    <th className="text-right py-2 px-3">Std (σ)</th>
                    <th className="text-right py-2 px-3">Coefficient</th>
                    <th className="text-right py-2 px-3">Importance</th>
                    <th className="text-left py-2 px-3">Direction</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedFeatures.map((f, i) => (
                    <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-raised/50 transition-colors">
                      <td className="py-2 px-3 font-mono text-foreground text-xs">{f.name}</td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground text-xs">{f.mean.toFixed(4)}</td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground text-xs">{f.std.toFixed(4)}</td>
                      <td className="py-2 px-3 text-right font-mono text-foreground text-xs">{f.coefficient.toFixed(6)}</td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${f.normalizedImportance * 100}%`,
                                backgroundColor: f.direction === "positive" ? "hsl(var(--data-emerald))" : "hsl(var(--data-rose))",
                              }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground w-10 text-right">
                            {(f.normalizedImportance * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`status-badge text-[10px] ${f.direction === "positive" ? "bg-data-emerald/15 text-data-emerald" : "bg-data-rose/15 text-data-rose"}`}>
                          {f.direction === "positive" ? "↑ positive" : "↓ negative"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="surface-panel rounded-lg p-3 hover:ring-1 hover:ring-primary/20 transition-all">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-mono font-semibold ${accent} capitalize`}>{value}</div>
    </div>
  );
}

export default ModelExplainability;
