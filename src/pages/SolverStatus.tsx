import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/tenant";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SEOHead } from "@/components/SEOHead";
import { GpuUtilizationPanel } from "@/components/solver/GpuUtilizationPanel";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Cpu, Activity, Clock, CheckCircle, XCircle, Loader2, Gauge,
  RefreshCw, Zap, TrendingUp, Timer, Flame, MemoryStick,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

// ── Types ────────────────────────────────────────────────────────────────

interface SimulationRow {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  current_iteration: number | null;
  cell_count: number | null;
  solver_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  organization_id: string;
}

interface ComputeRow {
  id: string;
  cpu_hours: number;
  gpu_hours: number;
  memory_gb_hours: number;
  cost_usd: number;
  duration_seconds: number;
  recorded_at: string;
  simulation_id: string | null;
}

interface ResultRow {
  simulation_id: string | null;
  converged: boolean;
  total_iterations: number;
  solve_time_seconds: number;
  efficiency_rating: string;
  pressure_drop: number;
  created_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; badge: string }> = {
  solving: { icon: Loader2, color: "text-data-cyan", badge: "bg-data-cyan/15 text-data-cyan" },
  meshing: { icon: Activity, color: "text-data-violet", badge: "bg-data-violet/15 text-data-violet" },
  queued: { icon: Clock, color: "text-data-amber", badge: "bg-data-amber/15 text-data-amber" },
  completed: { icon: CheckCircle, color: "text-data-emerald", badge: "bg-data-emerald/15 text-data-emerald" },
  failed: { icon: XCircle, color: "text-data-rose", badge: "bg-data-rose/15 text-data-rose" },
  draft: { icon: Clock, color: "text-muted-foreground", badge: "bg-muted/50 text-muted-foreground" },
  post_processing: { icon: Gauge, color: "text-data-cyan", badge: "bg-data-cyan/15 text-data-cyan" },
  cancelled: { icon: XCircle, color: "text-muted-foreground", badge: "bg-muted/50 text-muted-foreground" },
};

const PIE_COLORS = [
  "hsl(var(--data-cyan))",
  "hsl(var(--data-violet))",
  "hsl(var(--data-amber))",
  "hsl(var(--data-emerald))",
  "hsl(var(--data-rose))",
  "hsl(var(--muted-foreground))",
];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function timeAgo(date: string): string {
  const sec = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

// ── Page ─────────────────────────────────────────────────────────────────

const SolverStatus = () => {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);

  // Auto-refresh ticker for "time ago" labels
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  // Fetch simulations
  const { data: simulations = [], refetch: refetchSims } = useQuery({
    queryKey: ["solver-simulations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulations")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as SimulationRow[];
    },
    enabled: !!user,
  });

  // Fetch compute usage
  const { data: compute = [], refetch: refetchCompute } = useQuery({
    queryKey: ["solver-compute"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compute_usage")
        .select("*")
        .order("recorded_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ComputeRow[];
    },
    enabled: !!user,
  });

  // Fetch results
  const { data: results = [], refetch: refetchResults } = useQuery({
    queryKey: ["solver-results"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulation_results")
        .select("simulation_id, converged, total_iterations, solve_time_seconds, efficiency_rating, pressure_drop, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ResultRow[];
    },
    enabled: !!user,
  });

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("solver-status-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "simulations" }, () => refetchSims())
      .on("postgres_changes", { event: "*", schema: "public", table: "compute_usage" }, () => refetchCompute())
      .on("postgres_changes", { event: "*", schema: "public", table: "simulation_results" }, () => refetchResults())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetchSims, refetchCompute, refetchResults]);

  const refetchAll = () => { refetchSims(); refetchCompute(); refetchResults(); };

  // ── Derived Stats ────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active = simulations.filter((s) => s.status === "solving" || s.status === "meshing");
    const queued = simulations.filter((s) => s.status === "queued");
    const completed = simulations.filter((s) => s.status === "completed");
    const failed = simulations.filter((s) => s.status === "failed");

    const totalCpuHrs = compute.reduce((sum, c) => sum + c.cpu_hours, 0);
    const totalGpuHrs = compute.reduce((sum, c) => sum + c.gpu_hours, 0);
    const totalMemGbHrs = compute.reduce((sum, c) => sum + c.memory_gb_hours, 0);
    const totalCost = compute.reduce((sum, c) => sum + c.cost_usd, 0);

    const convergenceRate = results.length > 0
      ? results.filter((r) => r.converged).length / results.length
      : 0;

    const avgSolveTime = results.length > 0
      ? results.reduce((sum, r) => sum + r.solve_time_seconds, 0) / results.length
      : 0;

    return {
      activeCount: active.length,
      queuedCount: queued.length,
      completedCount: completed.length,
      failedCount: failed.length,
      totalCpuHrs,
      totalGpuHrs,
      totalMemGbHrs,
      totalCost,
      convergenceRate,
      avgSolveTime,
      active,
    };
  }, [simulations, compute, results, tick]);

  // ── Status pie ───────────────────────────────────────────────────────

  const statusPie = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of simulations) counts[s.status] = (counts[s.status] ?? 0) + 1;
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [simulations]);

  // ── Compute timeline ─────────────────────────────────────────────────

  const computeTimeline = useMemo(() => {
    const byDay = new Map<string, { cpu: number; gpu: number; cost: number }>();
    for (const c of [...compute].reverse()) {
      const day = new Date(c.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const prev = byDay.get(day) ?? { cpu: 0, gpu: 0, cost: 0 };
      byDay.set(day, {
        cpu: prev.cpu + c.cpu_hours,
        gpu: prev.gpu + c.gpu_hours,
        cost: prev.cost + c.cost_usd,
      });
    }
    return [...byDay.entries()].map(([date, v]) => ({ date, ...v }));
  }, [compute]);

  // ── Solve time distribution ──────────────────────────────────────────

  const solveTimeDistribution = useMemo(() => {
    const buckets = [
      { label: "<1m", max: 60, count: 0 },
      { label: "1–5m", max: 300, count: 0 },
      { label: "5–30m", max: 1800, count: 0 },
      { label: "30m–2h", max: 7200, count: 0 },
      { label: "2–8h", max: 28800, count: 0 },
      { label: ">8h", max: Infinity, count: 0 },
    ];
    for (const r of results) {
      const bucket = buckets.find((b) => r.solve_time_seconds < b.max);
      if (bucket) bucket.count++;
    }
    return buckets.filter((b) => b.count > 0);
  }, [results]);

  // ── Efficiency rating breakdown ──────────────────────────────────────

  const efficiencyBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of results) counts[r.efficiency_rating] = (counts[r.efficiency_rating] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [results]);

  // ── Convergence trend (by day) ───────────────────────────────────────

  const convergenceTrend = useMemo(() => {
    const byDay = new Map<string, { converged: number; total: number }>();
    for (const r of [...results].reverse()) {
      const day = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const prev = byDay.get(day) ?? { converged: 0, total: 0 };
      byDay.set(day, {
        converged: prev.converged + (r.converged ? 1 : 0),
        total: prev.total + 1,
      });
    }
    return [...byDay.entries()].map(([date, v]) => ({
      date,
      rate: v.total > 0 ? Math.round((v.converged / v.total) * 100) : 0,
    }));
  }, [results]);

  return (
    <div className="flex h-screen overflow-hidden dark">
      <AppSidebar />
      <SEOHead title="Solver Status — FlowForge CFD" description="Real-time CFD solver monitoring with GPU utilization, job queue, and convergence analytics." />
      <main className="flex-1 overflow-y-auto bg-background grid-engineering">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              Solver Status
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real-time simulation queue, compute metrics & convergence analytics
            </p>
          </div>
          <button
            onClick={refetchAll}
            className="flex items-center gap-2 px-3 py-2 rounded-lg surface-raised text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </header>

        <div className="p-8 space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-3">
            <KpiCard icon={<Loader2 className="w-4 h-4 animate-spin" />} label="Active" value={stats.activeCount} accent="text-data-cyan" />
            <KpiCard icon={<Clock className="w-4 h-4" />} label="Queued" value={stats.queuedCount} accent="text-data-amber" />
            <KpiCard icon={<CheckCircle className="w-4 h-4" />} label="Completed" value={stats.completedCount} accent="text-data-emerald" />
            <KpiCard icon={<XCircle className="w-4 h-4" />} label="Failed" value={stats.failedCount} accent="text-data-rose" />
            <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Conv. Rate" value={`${(stats.convergenceRate * 100).toFixed(0)}%`} accent="text-data-emerald" />
            <KpiCard icon={<Timer className="w-4 h-4" />} label="Avg Solve" value={formatDuration(Math.round(stats.avgSolveTime))} accent="text-data-cyan" />
            <KpiCard icon={<Cpu className="w-4 h-4" />} label="CPU Hrs" value={stats.totalCpuHrs.toFixed(1)} accent="text-data-violet" />
            <KpiCard icon={<Flame className="w-4 h-4" />} label="GPU Hrs" value={stats.totalGpuHrs.toFixed(1)} accent="text-data-amber" />
            <KpiCard icon={<MemoryStick className="w-4 h-4" />} label="Mem GB·h" value={stats.totalMemGbHrs.toFixed(0)} accent="text-data-cyan" />
            <KpiCard icon={<Zap className="w-4 h-4" />} label="Cost" value={`$${stats.totalCost.toFixed(2)}`} accent="text-data-emerald" />
          </div>

          {/* Active Simulations */}
          {stats.active.length > 0 && (
            <div className="surface-panel rounded-lg p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-data-cyan" />
                Active Simulations
                <span className="ml-1 status-badge bg-data-cyan/15 text-data-cyan text-[10px]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {stats.active.length} running
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {stats.active.map((sim) => {
                  const progress = sim.progress ?? 0;
                  const maxIter = (sim.solver_config as { maxIterations?: number })?.maxIterations ?? 1000;
                  const iterProgress = sim.current_iteration ? Math.min(100, (sim.current_iteration / maxIter) * 100) : progress;
                  const st = STATUS_CONFIG[sim.status] ?? STATUS_CONFIG.solving;
                  const StIcon = st.icon;

                  return (
                    <div key={sim.id} className="surface-raised rounded-lg p-4 ring-1 ring-surface-border hover:ring-primary/30 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-foreground truncate max-w-[180px]">{sim.name}</span>
                        <span className={`status-badge ${st.badge} text-[10px]`}>
                          <StIcon className={`w-3 h-3 ${sim.status === "solving" ? "animate-spin" : ""}`} />
                          {sim.status}
                        </span>
                      </div>
                      <div className="mb-3">
                        <Progress value={iterProgress} className="h-2" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <span className="text-muted-foreground block">Iteration</span>
                          <span className="font-mono text-foreground">
                            {sim.current_iteration?.toLocaleString() ?? "—"} / {maxIter.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Cells</span>
                          <span className="font-mono text-foreground">{sim.cell_count?.toLocaleString() ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Updated</span>
                          <span className="font-mono text-muted-foreground">{timeAgo(sim.updated_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* GPU Utilization Panel */}
          <GpuUtilizationPanel />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Compute Timeline */}
            <div className="surface-panel rounded-lg p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-data-violet" />
                Compute Usage Over Time
              </h2>
              <div className="h-[220px]">
                {computeTimeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={computeTimeline} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="cpu" stackId="1" stroke="hsl(var(--data-cyan))" fill="hsl(var(--data-cyan))" fillOpacity={0.3} name="CPU hrs" />
                      <Area type="monotone" dataKey="gpu" stackId="1" stroke="hsl(var(--data-violet))" fill="hsl(var(--data-violet))" fillOpacity={0.3} name="GPU hrs" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart label="No compute usage recorded yet" />
                )}
              </div>
            </div>

            {/* Convergence Trend */}
            <div className="surface-panel rounded-lg p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-data-emerald" />
                Convergence Rate Trend
              </h2>
              <div className="h-[220px]">
                {convergenceTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={convergenceTrend} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="%" />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, "Conv. Rate"]} />
                      <Line type="monotone" dataKey="rate" stroke="hsl(var(--data-emerald))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart label="No results yet" />
                )}
              </div>
            </div>

            {/* Status Distribution */}
            <div className="surface-panel rounded-lg p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-data-amber" />
                Simulation Status Distribution
              </h2>
              <div className="h-[200px]">
                {statusPie.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusPie} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                        {statusPie.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart label="No simulations yet" />
                )}
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

            {/* Solve Time Distribution */}
            <div className="surface-panel rounded-lg p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Timer className="w-4 h-4 text-data-cyan" />
                Solve Time Distribution
              </h2>
              <div className="h-[200px]">
                {solveTimeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={solveTimeDistribution} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" name="Simulations" radius={[4, 4, 0, 0]} fill="hsl(var(--data-cyan))" fillOpacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart label="No solve times recorded" />
                )}
              </div>
            </div>
          </div>

          {/* Efficiency Breakdown */}
          {efficiencyBreakdown.length > 0 && (
            <div className="surface-panel rounded-lg p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-data-emerald" />
                Efficiency Rating Breakdown
              </h2>
              <div className="flex items-center gap-4">
                {efficiencyBreakdown.map((e) => {
                  const total = efficiencyBreakdown.reduce((s, v) => s + v.value, 0);
                  const pct = total > 0 ? ((e.value / total) * 100).toFixed(0) : "0";
                  const colorMap: Record<string, string> = {
                    Excellent: "bg-data-emerald",
                    Good: "bg-data-cyan",
                    Average: "bg-data-amber",
                    Poor: "bg-data-rose",
                  };
                  return (
                    <div key={e.name} className="flex-1 surface-raised rounded-lg p-4 text-center">
                      <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${colorMap[e.name] ?? "bg-muted"}`} />
                      <div className="text-lg font-mono font-semibold text-foreground">{e.value}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{e.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Simulations Table */}
          <div className="surface-panel rounded-lg p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Recent Simulations
            </h2>
            {simulations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No simulations yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="text-left py-2 px-3">Name</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-right py-2 px-3">Progress</th>
                      <th className="text-right py-2 px-3">Iteration</th>
                      <th className="text-right py-2 px-3">Cells</th>
                      <th className="text-right py-2 px-3">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulations.slice(0, 20).map((sim) => {
                      const st = STATUS_CONFIG[sim.status] ?? STATUS_CONFIG.draft;
                      const StIcon = st.icon;
                      const progress = sim.progress ?? 0;
                      return (
                        <tr key={sim.id} className="border-b border-surface-border/50 hover:bg-surface-raised/50 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-foreground truncate max-w-[200px]">{sim.name}</td>
                          <td className="py-2.5 px-3">
                            <span className={`status-badge ${st.badge} text-[10px] inline-flex items-center gap-1`}>
                              <StIcon className={`w-3 h-3 ${sim.status === "solving" || sim.status === "meshing" ? "animate-spin" : ""}`} />
                              {sim.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">{progress}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                            {sim.current_iteration?.toLocaleString() ?? "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                            {sim.cell_count?.toLocaleString() ?? "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground text-xs">
                            {timeAgo(sim.updated_at)}
                          </td>
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

// ── Sub-Components ───────────────────────────────────────────────────────

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: string }) {
  return (
    <div className="surface-panel rounded-lg p-3 hover:ring-1 hover:ring-primary/20 transition-all">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`${accent} opacity-60`}>{icon}</span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className={`text-xl font-mono font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

const tooltipStyle = {
  background: "hsl(var(--surface))",
  border: "1px solid hsl(var(--surface-border))",
  borderRadius: 8,
  fontSize: 11,
  color: "hsl(var(--foreground))",
};

export default SolverStatus;
