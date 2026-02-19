import { useEffect, useState } from "react";
import { Cpu, Zap, Clock, DollarSign, Activity, TrendingUp, AlertTriangle } from "lucide-react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/modules/tenant";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

// ─── Tier Limits (mirrors edge function) ─────────────────────────────────

const TIER_LIMITS: Record<string, { maxGpuHours: number; maxConcurrent: number; label: string }> = {
  "trial-cleanroom":  { maxGpuHours: 10,  maxConcurrent: 1,  label: "Cleanroom Trial" },
  "trial-datacenter": { maxGpuHours: 10,  maxConcurrent: 1,  label: "Data Center Trial" },
  "trial-data-center":{ maxGpuHours: 10,  maxConcurrent: 1,  label: "Data Center Trial" },
  "trial-hvac":       { maxGpuHours: 10,  maxConcurrent: 1,  label: "HVAC Trial" },
  "trial-automotive": { maxGpuHours: 20,  maxConcurrent: 2,  label: "Automotive Trial" },
  "trial-energy":     { maxGpuHours: 20,  maxConcurrent: 2,  label: "Energy Trial" },
  "trial-full":       { maxGpuHours: 50,  maxConcurrent: 3,  label: "Full Trial" },
  free:               { maxGpuHours: 5,   maxConcurrent: 1,  label: "Free" },
  pro:                { maxGpuHours: 500, maxConcurrent: 10, label: "Pro" },
  enterprise:         { maxGpuHours: -1,  maxConcurrent: 50, label: "Enterprise" },
};

interface UsageRow {
  id: string;
  gpu_hours: number;
  cpu_hours: number;
  cost_usd: number;
  duration_seconds: number;
  memory_gb_hours: number;
  recorded_at: string;
  simulation_id: string | null;
}

const GpuUsage = () => {
  const { currentOrg } = useAuth();
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const orgTier = currentOrg?.tier ?? "free";
  const limits = TIER_LIMITS[orgTier] ?? TIER_LIMITS.free;
  const isUnlimited = limits.maxGpuHours < 0;

  useEffect(() => {
    if (!currentOrg?.id) return;
    (async () => {
      const { data } = await supabase
        .from("compute_usage")
        .select("*")
        .eq("organization_id", currentOrg.id)
        .order("recorded_at", { ascending: false })
        .limit(50);
      setUsage((data as UsageRow[]) ?? []);
      setLoading(false);
    })();
  }, [currentOrg?.id]);

  const totalGpuHours = usage.reduce((s, r) => s + Number(r.gpu_hours), 0);
  const totalCpuHours = usage.reduce((s, r) => s + Number(r.cpu_hours), 0);
  const totalCost = usage.reduce((s, r) => s + Number(r.cost_usd), 0);
  const totalDuration = usage.reduce((s, r) => s + Number(r.duration_seconds), 0);
  const usagePercent = isUnlimited ? 0 : Math.min((totalGpuHours / limits.maxGpuHours) * 100, 100);
  const isNearLimit = !isUnlimited && usagePercent >= 80;

  return (
    <div className="flex h-screen overflow-hidden dark">
      <SEOHead title="GPU Usage — FlowForge CFD" description="Monitor GPU compute usage, tier limits, and cost breakdown." />
      <AppSidebar />

      <main className="flex-1 overflow-y-auto bg-background grid-engineering">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-8 py-4">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">GPU Usage Metering</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {limits.label} — {isUnlimited ? "Unlimited GPU hours" : `${limits.maxGpuHours} GPU-hours included`}
          </p>
        </header>

        <div className="p-8 space-y-8">
          {/* Usage Progress */}
          {!isUnlimited && (
            <div className="surface-panel rounded-lg p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-data-cyan" />
                  <span className="text-sm font-medium text-foreground">GPU Hour Budget</span>
                </div>
                {isNearLimit && (
                  <div className="flex items-center gap-1.5 text-data-amber text-xs font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {usagePercent >= 100 ? "Limit reached" : "Approaching limit"}
                  </div>
                )}
              </div>
              <Progress value={usagePercent} className="h-3 mb-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{totalGpuHours.toFixed(1)} GPU-hrs used</span>
                <span>{limits.maxGpuHours} GPU-hrs limit</span>
              </div>
            </div>
          )}

          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricTile icon={Cpu} label="GPU Hours" value={totalGpuHours.toFixed(1)} color="cyan" />
            <MetricTile icon={Activity} label="CPU Hours" value={totalCpuHours.toFixed(1)} color="emerald" />
            <MetricTile icon={Clock} label="Total Runtime" value={formatDuration(totalDuration)} color="amber" />
            <MetricTile icon={DollarSign} label="Estimated Cost" value={`$${totalCost.toFixed(2)}`} color="violet" />
          </div>

          {/* Tier Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="surface-panel rounded-lg p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Current Plan</div>
              <div className="text-lg font-semibold text-foreground">{limits.label}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Max concurrent jobs: {limits.maxConcurrent}
              </div>
            </div>
            <div className="surface-panel rounded-lg p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Jobs Submitted</div>
              <div className="text-lg font-semibold text-foreground font-mono">{usage.length}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Showing last 50 entries
              </div>
            </div>
            <div className="surface-panel rounded-lg p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Avg GPU/Job</div>
              <div className="text-lg font-semibold text-foreground font-mono">
                {usage.length > 0 ? (totalGpuHours / usage.length).toFixed(2) : "0.00"} hrs
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Avg duration: {usage.length > 0 ? formatDuration(totalDuration / usage.length) : "—"}
              </div>
            </div>
          </div>

          {/* Usage History */}
          <div className="surface-panel rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-data-cyan" />
                <h2 className="text-sm font-semibold text-foreground">Usage History</h2>
              </div>
            </div>
            {loading ? (
              <div className="px-6 py-12 text-center text-muted-foreground text-sm">Loading usage data…</div>
            ) : usage.length === 0 ? (
              <div className="px-6 py-12 text-center text-muted-foreground text-sm">
                No compute usage recorded yet. Submit a simulation to see data here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border/30">
                      <th className="text-left px-6 py-3 font-medium">Date</th>
                      <th className="text-right px-6 py-3 font-medium">GPU Hrs</th>
                      <th className="text-right px-6 py-3 font-medium">CPU Hrs</th>
                      <th className="text-right px-6 py-3 font-medium">Duration</th>
                      <th className="text-right px-6 py-3 font-medium">Memory (GB·h)</th>
                      <th className="text-right px-6 py-3 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((row) => (
                      <tr key={row.id} className="border-b border-border/20 hover:bg-surface-overlay/30 transition-colors">
                        <td className="px-6 py-3 text-foreground font-mono text-xs">
                          {new Date(row.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="text-right px-6 py-3 font-mono text-data-cyan">{Number(row.gpu_hours).toFixed(2)}</td>
                        <td className="text-right px-6 py-3 font-mono text-data-emerald">{Number(row.cpu_hours).toFixed(2)}</td>
                        <td className="text-right px-6 py-3 font-mono text-foreground">{formatDuration(Number(row.duration_seconds))}</td>
                        <td className="text-right px-6 py-3 font-mono text-muted-foreground">{Number(row.memory_gb_hours).toFixed(2)}</td>
                        <td className="text-right px-6 py-3 font-mono text-data-amber">${Number(row.cost_usd).toFixed(2)}</td>
                      </tr>
                    ))}
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

// ─── Helpers ──────────────────────────────────────────────────────────────

function MetricTile({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  const colorClass = `text-data-${color}`;
  return (
    <div className="surface-panel rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${colorClass}`} />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-mono font-semibold ${colorClass}`}>{value}</div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default GpuUsage;
