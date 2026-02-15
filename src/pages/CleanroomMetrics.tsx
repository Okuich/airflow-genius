import { AppSidebar } from "@/components/layout/AppSidebar";
import { ArrowLeft, Wind, Atom, ShieldCheck, Waves, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from "recharts";

// ── Mock Data ───────────────────────────────────────────────────────────────

function generateTimeSeries(hours: number) {
  const now = Date.now();
  return Array.from({ length: hours }, (_, i) => {
    const t = new Date(now - (hours - 1 - i) * 3600_000);
    return {
      time: t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      airChangeRate: 40 + Math.sin(i / 4) * 8 + Math.random() * 4,
      particleRetention: Math.max(0, 0.02 + Math.sin(i / 6) * 0.015 + Math.random() * 0.005),
      laminarStability: 0.85 + Math.sin(i / 5) * 0.08 + Math.random() * 0.03,
    };
  });
}

const ISO_CLASSES = [
  { class: "ISO 1", maxParticles: 10, color: "hsl(var(--data-cyan))" },
  { class: "ISO 2", maxParticles: 100, color: "hsl(var(--data-emerald))" },
  { class: "ISO 3", maxParticles: 1000, color: "hsl(var(--data-emerald))" },
  { class: "ISO 4", maxParticles: 10000, color: "hsl(var(--data-amber))" },
  { class: "ISO 5", maxParticles: 100000, color: "hsl(var(--data-amber))" },
  { class: "ISO 6", maxParticles: 1000000, color: "hsl(var(--data-rose))" },
];

const ZONE_DATA = [
  { zone: "Zone A", airChangeRate: 52, particleCount: 320, isoClass: 5, laminar: 0.94 },
  { zone: "Zone B", airChangeRate: 38, particleCount: 8500, isoClass: 7, laminar: 0.78 },
  { zone: "Zone C", airChangeRate: 61, particleCount: 85, isoClass: 4, laminar: 0.97 },
  { zone: "Zone D", airChangeRate: 45, particleCount: 1200, isoClass: 6, laminar: 0.88 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoClassColor(iso: number) {
  if (iso <= 3) return "text-data-cyan";
  if (iso <= 5) return "text-data-emerald";
  if (iso <= 7) return "text-data-amber";
  return "text-data-rose";
}

function stabilityLabel(v: number) {
  if (v >= 0.9) return { label: "Excellent", color: "text-data-cyan" };
  if (v >= 0.8) return { label: "Good", color: "text-data-emerald" };
  if (v >= 0.6) return { label: "Fair", color: "text-data-amber" };
  return { label: "Poor", color: "text-data-rose" };
}

// ── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, unit, accent }: {
  icon: React.ElementType; label: string; value: string; unit?: string; accent?: string;
}) {
  return (
    <div className="surface-raised rounded-xl border border-surface-border p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent ?? "bg-primary/10"}`}>
        <Icon className={`w-5 h-5 ${accent ? "text-foreground" : "text-primary"}`} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-semibold text-foreground font-mono mt-1">
          {value}
          {unit && <span className="text-sm text-muted-foreground ml-1 font-normal">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CleanroomMetrics() {
  const [hours] = useState(24);
  const timeSeries = useMemo(() => generateTimeSeries(hours), [hours]);

  const avgACR = timeSeries.reduce((s, d) => s + d.airChangeRate, 0) / timeSeries.length;
  const avgRetention = timeSeries.reduce((s, d) => s + d.particleRetention, 0) / timeSeries.length;
  const avgLaminar = timeSeries.reduce((s, d) => s + d.laminarStability, 0) / timeSeries.length;
  const estimatedISO = avgRetention < 0.01 ? 4 : avgRetention < 0.03 ? 5 : avgRetention < 0.08 ? 6 : 7;

  const radialData = [{ name: "Laminar", value: Math.round(avgLaminar * 100), fill: "hsl(var(--data-cyan))" }];

  return (
    <div className="flex h-screen overflow-hidden dark">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto bg-background grid-engineering">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-8 py-4 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />Dashboard
          </Link>
          <div className="h-5 w-px bg-border" />
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Cleanroom Metrics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Air quality, particle retention &amp; laminar stability</p>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <KpiCard icon={Wind} label="Avg Air Change Rate" value={avgACR.toFixed(1)} unit="ACH" />
            <KpiCard icon={Atom} label="Avg Particle Retention" value={(avgRetention * 100).toFixed(2)} unit="%" />
            <KpiCard icon={ShieldCheck} label="ISO Class Estimate" value={`ISO ${estimatedISO}`} />
            <KpiCard icon={Waves} label="Laminar Stability" value={(avgLaminar * 100).toFixed(1)} unit="%" />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Air Change Rate */}
            <section className="surface-raised rounded-xl border border-surface-border p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Wind className="w-4 h-4 text-data-cyan" />Air Change Rate (ACH) — 24 h
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={timeSeries}>
                  <defs>
                    <linearGradient id="acrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--data-cyan))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--data-cyan))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={3} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={[20, 70]} />
                  <Tooltip contentStyle={{ background: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="airChangeRate" stroke="hsl(var(--data-cyan))" fill="url(#acrGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </section>

            {/* Particle Retention */}
            <section className="surface-raised rounded-xl border border-surface-border p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Atom className="w-4 h-4 text-data-emerald" />Particle Retention (%) — 24 h
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={3} />
                  <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(v: number) => `${(v * 100).toFixed(3)}%`} contentStyle={{ background: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="particleRetention" stroke="hsl(var(--data-emerald))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </section>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Laminar Stability Gauge */}
            <section className="surface-raised rounded-xl border border-surface-border p-6 flex flex-col items-center">
              <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Waves className="w-4 h-4 text-data-cyan" />Laminar Stability
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" startAngle={180} endAngle={0} data={radialData}>
                  <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "hsl(var(--surface-overlay))" }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <p className="text-3xl font-bold text-foreground font-mono -mt-6">{(avgLaminar * 100).toFixed(1)}%</p>
              <p className={`text-xs mt-1 ${stabilityLabel(avgLaminar).color}`}>{stabilityLabel(avgLaminar).label}</p>
            </section>

            {/* ISO Class Distribution */}
            <section className="surface-raised rounded-xl border border-surface-border p-6 col-span-1 lg:col-span-2">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-data-amber" />ISO Class Particle Limits vs Measured
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ISO_CLASSES} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" />
                  <XAxis type="number" scale="log" domain={[1, 10000000]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: number) => v >= 1000000 ? `${v / 1000000}M` : v >= 1000 ? `${v / 1000}k` : String(v)} />
                  <YAxis type="category" dataKey="class" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={50} />
                  <Tooltip contentStyle={{ background: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="maxParticles" name="Max Particles/m³" radius={[0, 4, 4, 0]}>
                    {ISO_CLASSES.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>

          {/* Zone Table */}
          <section className="surface-raised rounded-xl border border-surface-border p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-data-violet" />Zone Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-left">
                    <th className="pb-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Zone</th>
                    <th className="pb-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">ACH</th>
                    <th className="pb-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Particles / m³</th>
                    <th className="pb-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">ISO Class</th>
                    <th className="pb-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Laminar Score</th>
                    <th className="pb-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {ZONE_DATA.map((z) => {
                    const stab = stabilityLabel(z.laminar);
                    const passing = z.isoClass <= 5 && z.laminar >= 0.85;
                    return (
                      <tr key={z.zone} className="hover:bg-surface-overlay/40 transition-colors">
                        <td className="py-3 font-medium text-foreground">{z.zone}</td>
                        <td className="py-3 font-mono text-foreground">{z.airChangeRate}</td>
                        <td className="py-3 font-mono text-foreground">{z.particleCount.toLocaleString()}</td>
                        <td className={`py-3 font-mono font-semibold ${isoClassColor(z.isoClass)}`}>ISO {z.isoClass}</td>
                        <td className={`py-3 font-mono ${stab.color}`}>{(z.laminar * 100).toFixed(0)}% — {stab.label}</td>
                        <td className="py-3">
                          {passing ? (
                            <span className="inline-flex items-center gap-1 text-xs text-data-emerald"><CheckCircle2 className="w-3.5 h-3.5" />Pass</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-data-amber"><AlertTriangle className="w-3.5 h-3.5" />Review</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
