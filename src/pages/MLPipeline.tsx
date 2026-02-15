import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/tenant";
import { AppSidebar } from "@/components/layout/AppSidebar";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Brain, Activity, Clock, CheckCircle, XCircle, Loader2, Layers,
  RefreshCw, Zap, TrendingUp, Database,
} from "lucide-react";

type TrainingJob = {
  id: string;
  organization_id: string;
  model_type: string;
  status: string;
  sample_count: number;
  metrics: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type ModelVersion = {
  id: string;
  organization_id: string;
  model_type: string;
  version: number;
  is_active: boolean;
  training_sample_count: number;
  metrics: Record<string, unknown>;
  created_at: string;
};

const STATUS_STYLES: Record<string, { icon: React.ElementType; color: string; badge: string }> = {
  completed: { icon: CheckCircle, color: "text-data-emerald", badge: "bg-data-emerald/15 text-data-emerald" },
  running: { icon: Loader2, color: "text-data-cyan", badge: "bg-data-cyan/15 text-data-cyan" },
  queued: { icon: Clock, color: "text-data-amber", badge: "bg-data-amber/15 text-data-amber" },
  failed: { icon: XCircle, color: "text-data-rose", badge: "bg-data-rose/15 text-data-rose" },
};

const MODEL_COLORS: Record<string, string> = {
  pressure_drop: "hsl(var(--data-cyan))",
  convergence: "hsl(var(--data-emerald))",
  efficiency: "hsl(var(--data-violet))",
};

const PIE_COLORS = [
  "hsl(var(--data-emerald))",
  "hsl(var(--data-cyan))",
  "hsl(var(--data-amber))",
  "hsl(var(--data-rose))",
];

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const sec = Math.round((e - s) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function timeAgo(date: string): string {
  const sec = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

const MLPipeline = () => {
  const { user } = useAuth();

  // Fetch training jobs
  const { data: jobs = [], refetch: refetchJobs } = useQuery({
    queryKey: ["training-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as TrainingJob[];
    },
    enabled: !!user,
  });

  // Fetch model versions
  const { data: models = [], refetch: refetchModels } = useQuery({
    queryKey: ["model-versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ml_model_versions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ModelVersion[];
    },
    enabled: !!user,
  });

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("ml-pipeline-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "training_jobs" }, () => {
        refetchJobs();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ml_model_versions" }, () => {
        refetchModels();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refetchJobs, refetchModels]);

  // Derived stats
  const stats = useMemo(() => {
    const running = jobs.filter((j) => j.status === "running").length;
    const completed = jobs.filter((j) => j.status === "completed").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    const activeModels = models.filter((m) => m.is_active).length;
    const totalSamples = models.reduce((sum, m) => sum + m.training_sample_count, 0);
    const avgR2 = models.filter((m) => m.is_active && (m.metrics as { r2?: number }).r2 != null)
      .reduce((acc, m, _, arr) => acc + ((m.metrics as { r2: number }).r2 / arr.length), 0);
    return { running, completed, failed, activeModels, totalSamples, avgR2 };
  }, [jobs, models]);

  // Status pie data
  const statusPie = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const j of jobs) counts[j.status] = (counts[j.status] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [jobs]);

  // R² over time per model type
  const r2Timeline = useMemo(() => {
    const byType = new Map<string, { date: string; r2: number; version: number }[]>();
    for (const m of [...models].reverse()) {
      const r2 = (m.metrics as { r2?: number }).r2;
      if (r2 == null) continue;
      if (!byType.has(m.model_type)) byType.set(m.model_type, []);
      byType.get(m.model_type)!.push({
        date: new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        r2,
        version: m.version,
      });
    }
    // Merge into flat array with model type keys
    const merged: Record<string, unknown>[] = [];
    const allDates = new Set<string>();
    byType.forEach((entries) => entries.forEach((e) => allDates.add(e.date)));
    for (const date of allDates) {
      const point: Record<string, unknown> = { date };
      byType.forEach((entries, type) => {
        const match = entries.find((e) => e.date === date);
        if (match) point[type] = match.r2;
      });
      merged.push(point);
    }
    return merged;
  }, [models]);

  // Sample count bar chart
  const sampleBars = useMemo(() => {
    const active = models.filter((m) => m.is_active);
    return active.map((m) => ({
      model: `${m.model_type} v${m.version}`,
      samples: m.training_sample_count,
      type: m.model_type,
    }));
  }, [models]);

  return (
    <div className="flex h-screen overflow-hidden dark">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto bg-background grid-engineering">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">ML Pipeline Monitor</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Real-time training jobs, model versions, and performance metrics</p>
          </div>
          <button
            onClick={() => { refetchJobs(); refetchModels(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg surface-raised text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </header>

        <div className="p-8 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={<Activity className="w-4 h-4" />} label="Running" value={stats.running} accent="text-data-cyan" />
            <KpiCard icon={<CheckCircle className="w-4 h-4" />} label="Completed" value={stats.completed} accent="text-data-emerald" />
            <KpiCard icon={<XCircle className="w-4 h-4" />} label="Failed" value={stats.failed} accent="text-data-rose" />
            <KpiCard icon={<Layers className="w-4 h-4" />} label="Active Models" value={stats.activeModels} accent="text-data-violet" />
            <KpiCard icon={<Database className="w-4 h-4" />} label="Total Samples" value={stats.totalSamples.toLocaleString()} accent="text-data-amber" />
            <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Avg R²" value={stats.avgR2 > 0 ? stats.avgR2.toFixed(3) : "—"} accent="text-data-cyan" />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* R² Timeline */}
            <div className="xl:col-span-2 surface-panel rounded-lg p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-data-cyan" />
                Model Performance (R²) Over Time
              </h2>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={r2Timeline} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--surface-border))", borderRadius: 8, fontSize: 11, color: "hsl(var(--foreground))" }} />
                    {["pressure_drop", "convergence", "efficiency"].map((type) => (
                      <Line key={type} type="monotone" dataKey={type} stroke={MODEL_COLORS[type]} strokeWidth={2} dot={{ r: 3 }} connectNulls name={type.replace("_", " ")} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="surface-panel rounded-lg p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-data-amber" />
                Job Status Distribution
              </h2>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">
                      {statusPie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--surface-border))", borderRadius: 8, fontSize: 11, color: "hsl(var(--foreground))" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                {statusPie.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-[10px] text-muted-foreground capitalize">{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sample Count Bar */}
          {sampleBars.length > 0 && (
            <div className="surface-panel rounded-lg p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-data-violet" />
                Training Sample Count (Active Models)
              </h2>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sampleBars} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" />
                    <XAxis dataKey="model" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--surface-border))", borderRadius: 8, fontSize: 11, color: "hsl(var(--foreground))" }} />
                    <Bar dataKey="samples" radius={[4, 4, 0, 0]}>
                      {sampleBars.map((entry, i) => (
                        <Cell key={i} fill={MODEL_COLORS[entry.type] ?? "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Active Model Versions */}
          <div className="surface-panel rounded-lg p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              Active Model Versions
            </h2>
            {models.filter((m) => m.is_active).length === 0 ? (
              <p className="text-sm text-muted-foreground">No active models yet. Train your first model to see it here.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {models.filter((m) => m.is_active).map((m) => {
                  const metrics = m.metrics as { r2?: number; mse?: number; mae?: number; testR2?: number; overfit?: boolean };
                  return (
                    <div key={m.id} className="surface-raised rounded-lg p-4 ring-1 ring-surface-border hover:ring-primary/30 transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-mono font-semibold text-foreground capitalize">{m.model_type.replace("_", " ")}</span>
                        <span className="status-badge bg-data-emerald/15 text-data-emerald text-[10px]">v{m.version}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-muted-foreground block">Train R²</span>
                          <span className="font-mono text-foreground font-semibold">{metrics.r2?.toFixed(4) ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Test R²</span>
                          <span className="font-mono text-foreground font-semibold">{metrics.testR2?.toFixed(4) ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">MSE</span>
                          <span className="font-mono text-foreground">{metrics.mse?.toFixed(6) ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Samples</span>
                          <span className="font-mono text-foreground">{m.training_sample_count}</span>
                        </div>
                      </div>
                      {metrics.overfit && (
                        <div className="mt-2 status-badge bg-data-rose/15 text-data-rose text-[10px]">⚠ Overfit detected</div>
                      )}
                      <div className="mt-2 text-[10px] text-muted-foreground">{timeAgo(m.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Training Jobs Table */}
          <div className="surface-panel rounded-lg p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-data-cyan" />
              Training Jobs
              {stats.running > 0 && (
                <span className="ml-2 flex items-center gap-1 status-badge bg-data-cyan/15 text-data-cyan text-[10px]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {stats.running} running
                </span>
              )}
            </h2>

            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No training jobs yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="text-left py-2 px-3">Model</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-right py-2 px-3">Samples</th>
                      <th className="text-right py-2 px-3">R²</th>
                      <th className="text-right py-2 px-3">Duration</th>
                      <th className="text-left py-2 px-3">Error</th>
                      <th className="text-right py-2 px-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => {
                      const st = STATUS_STYLES[job.status] ?? STATUS_STYLES.queued;
                      const StIcon = st.icon;
                      const metrics = job.metrics as { r2?: number };
                      return (
                        <tr key={job.id} className="border-b border-surface-border/50 hover:bg-surface-raised/50 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-foreground capitalize">{job.model_type.replace("_", " ")}</td>
                          <td className="py-2.5 px-3">
                            <span className={`status-badge ${st.badge} text-[10px] inline-flex items-center gap-1`}>
                              <StIcon className={`w-3 h-3 ${job.status === "running" ? "animate-spin" : ""}`} />
                              {job.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{job.sample_count}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-foreground">{metrics.r2?.toFixed(4) ?? "—"}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{formatDuration(job.started_at, job.completed_at)}</td>
                          <td className="py-2.5 px-3 text-data-rose text-xs max-w-[200px] truncate">{job.error_message ?? ""}</td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground text-xs">{timeAgo(job.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: string }) {
  return (
    <div className="surface-panel rounded-lg p-4 hover:ring-1 hover:ring-primary/20 transition-all">
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`${accent} opacity-60`}>{icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-mono font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

export default MLPipeline;
