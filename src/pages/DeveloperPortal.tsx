import { useState, useMemo } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Key, Plus, Copy, Eye, EyeOff, Trash2, BarChart3, Clock,
  Shield, AlertTriangle, Activity, ArrowUpRight, ArrowDownRight, Zap,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

/* ─── Mock data ─── */
const MOCK_KEYS = [
  {
    id: "k1", name: "Production Backend", prefix: "ff_sk_prod", scopes: ["read", "write", "simulate"],
    rateLimitPerMin: 500, isActive: true, createdAt: "2026-01-15T10:00:00Z",
    lastUsedAt: "2026-03-07T08:42:00Z", totalRequests: 184_320, errRate: 0.3,
  },
  {
    id: "k2", name: "Staging Environment", prefix: "ff_sk_stag", scopes: ["read", "write"],
    rateLimitPerMin: 200, isActive: true, createdAt: "2026-02-01T14:00:00Z",
    lastUsedAt: "2026-03-07T07:15:00Z", totalRequests: 42_810, errRate: 1.2,
  },
  {
    id: "k3", name: "CI / Testing", prefix: "ff_sk_test", scopes: ["read"],
    rateLimitPerMin: 100, isActive: false, createdAt: "2026-02-20T09:00:00Z",
    lastUsedAt: "2026-03-01T12:00:00Z", totalRequests: 8_440, errRate: 0.0,
  },
  {
    id: "k4", name: "Partner Integration", prefix: "ff_sk_part", scopes: ["read", "compliance"],
    rateLimitPerMin: 300, isActive: true, createdAt: "2026-02-28T16:00:00Z",
    lastUsedAt: "2026-03-07T09:01:00Z", totalRequests: 23_150, errRate: 0.8,
  },
];

const hourlyUsage = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  prod: Math.floor(300 + Math.random() * 400),
  staging: Math.floor(50 + Math.random() * 150),
  partner: Math.floor(30 + Math.random() * 100),
}));

const dailyUsage = Array.from({ length: 30 }, (_, i) => ({
  day: `Mar ${i + 1}`,
  requests: Math.floor(4000 + Math.random() * 8000),
  errors: Math.floor(5 + Math.random() * 40),
}));

const endpointBreakdown = [
  { name: "/v2/simulations", value: 42, color: "hsl(var(--data-cyan))" },
  { name: "/v2/compliance", value: 24, color: "hsl(var(--data-green))" },
  { name: "/v2/inference", value: 18, color: "hsl(var(--data-amber))" },
  { name: "/v2/features", value: 10, color: "hsl(var(--primary))" },
  { name: "Other", value: 6, color: "hsl(var(--muted-foreground))" },
];

const rateLimitEvents = [
  { time: "09:14", key: "Production Backend", endpoint: "/v2/simulations", used: 498, limit: 500 },
  { time: "08:52", key: "Partner Integration", endpoint: "/v2/compliance/evaluate", used: 300, limit: 300 },
  { time: "07:30", key: "Staging Environment", endpoint: "/v2/inference", used: 195, limit: 200 },
  { time: "03:15", key: "Production Backend", endpoint: "/v2/simulations/{id}/results", used: 487, limit: 500 },
];

const latencyPercentiles = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  p50: Math.floor(25 + Math.random() * 15),
  p95: Math.floor(80 + Math.random() * 60),
  p99: Math.floor(180 + Math.random() * 120),
}));

/* ─── Components ─── */

function KPICard({ label, value, sub, icon: Icon, trend }: {
  label: string; value: string; sub: string; icon: React.ElementType; trend?: "up" | "down";
}) {
  return (
    <Card className="border-surface-border bg-surface-panel">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              {trend === "up" && <ArrowUpRight className="w-3 h-3 text-data-green" />}
              {trend === "down" && <ArrowDownRight className="w-3 h-3 text-data-red" />}
              {sub}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4.5 h-4.5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KeyRow({ apiKey, onToggle, onRevoke }: {
  apiKey: typeof MOCK_KEYS[0];
  onToggle: (id: string) => void;
  onRevoke: (id: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-surface-border bg-surface-panel hover:bg-surface-overlay/30 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Key className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{apiKey.name}</span>
          <Badge variant={apiKey.isActive ? "default" : "secondary"} className="text-[10px]">
            {apiKey.isActive ? "Active" : "Disabled"}
          </Badge>
          {apiKey.scopes.map((s) => (
            <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <code className="text-xs font-mono text-muted-foreground">
            {revealed ? `${apiKey.prefix}_${"•".repeat(32)}` : `${apiKey.prefix}_••••••••`}
          </code>
          <button onClick={() => setRevealed(!revealed)} className="text-muted-foreground hover:text-foreground">
            {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <button
            onClick={() => { navigator.clipboard.writeText(`${apiKey.prefix}_example_key`); toast.success("Key copied"); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {apiKey.totalRequests.toLocaleString()} requests · {apiKey.errRate}% error rate · Last used {new Date(apiKey.lastUsedAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground">{apiKey.rateLimitPerMin}/min</span>
        <Switch checked={apiKey.isActive} onCheckedChange={() => onToggle(apiKey.id)} />
        <Button variant="ghost" size="icon" className="text-destructive/60 hover:text-destructive" onClick={() => onRevoke(apiKey.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Page ─── */

export default function DeveloperPortal() {
  const [keys, setKeys] = useState(MOCK_KEYS);
  const [newKeyName, setNewKeyName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const toggleKey = (id: string) => {
    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, isActive: !k.isActive } : k));
    toast.success("Key status updated");
  };

  const revokeKey = (id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
    toast.success("API key revoked");
  };

  const createKey = () => {
    if (!newKeyName.trim()) return;
    const prefix = `ff_sk_${newKeyName.toLowerCase().replace(/\s+/g, "_").slice(0, 4)}`;
    setKeys((prev) => [
      ...prev,
      {
        id: `k${Date.now()}`, name: newKeyName, prefix, scopes: ["read"],
        rateLimitPerMin: 100, isActive: true, createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(), totalRequests: 0, errRate: 0,
      },
    ]);
    setNewKeyName("");
    setShowCreate(false);
    toast.success("API key created — copy it now, it won't be shown again");
  };

  const totalReqs = useMemo(() => keys.reduce((s, k) => s + k.totalRequests, 0), [keys]);
  const activeKeys = keys.filter((k) => k.isActive).length;

  return (
    <div className="flex h-screen bg-background dark">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs font-mono">Developer Portal</Badge>
              </div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">API Key Management</h1>
              <p className="text-muted-foreground mt-1">Create, monitor, and manage your API keys with real-time usage analytics.</p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Create Key
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            <KPICard label="Total Requests" value={totalReqs.toLocaleString()} sub="+12.4% vs last week" icon={BarChart3} trend="up" />
            <KPICard label="Active Keys" value={`${activeKeys}/${keys.length}`} sub={`${keys.length - activeKeys} disabled`} icon={Key} />
            <KPICard label="Avg Latency" value="38ms" sub="p95: 112ms" icon={Zap} trend="down" />
            <KPICard label="Rate Limit Hits" value="14" sub="Last 24h" icon={AlertTriangle} trend="down" />
          </div>

          {/* Create Key Panel */}
          {showCreate && (
            <Card className="border-primary/30 bg-surface-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Create New API Key</CardTitle>
                <CardDescription>Keys grant programmatic access to FlowForge APIs.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Key Name</label>
                  <Input
                    placeholder="e.g. Production Backend"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createKey()}
                  />
                </div>
                <Button onClick={createKey}>Generate Key</Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="keys" className="space-y-6">
            <TabsList>
              <TabsTrigger value="keys" className="gap-1.5"><Key className="w-3.5 h-3.5" /> API Keys</TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Usage Analytics</TabsTrigger>
              <TabsTrigger value="rate-limits" className="gap-1.5"><Shield className="w-3.5 h-3.5" /> Rate Limits</TabsTrigger>
            </TabsList>

            {/* ─── Keys Tab ─── */}
            <TabsContent value="keys" className="space-y-3">
              {keys.map((k) => (
                <KeyRow key={k.id} apiKey={k} onToggle={toggleKey} onRevoke={revokeKey} />
              ))}
              {keys.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Key className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No API keys yet. Create one to get started.</p>
                </div>
              )}
            </TabsContent>

            {/* ─── Analytics Tab ─── */}
            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Hourly traffic */}
                <Card className="border-surface-border bg-surface-panel">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-data-cyan" /> Requests Today (Hourly)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={hourlyUsage}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={3} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                          <Area type="monotone" dataKey="prod" stackId="1" stroke="hsl(var(--data-cyan))" fill="hsl(var(--data-cyan))" fillOpacity={0.3} name="Production" />
                          <Area type="monotone" dataKey="staging" stackId="1" stroke="hsl(var(--data-amber))" fill="hsl(var(--data-amber))" fillOpacity={0.3} name="Staging" />
                          <Area type="monotone" dataKey="partner" stackId="1" stroke="hsl(var(--data-green))" fill="hsl(var(--data-green))" fillOpacity={0.3} name="Partner" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Endpoint breakdown */}
                <Card className="border-surface-border bg-surface-panel">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-data-green" /> Endpoint Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-center gap-6">
                      <div className="w-1/2 h-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={endpointBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                              {endpointBreakdown.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2">
                        {endpointBreakdown.map((ep) => (
                          <div key={ep.name} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: ep.color }} />
                            <span className="text-xs text-muted-foreground">{ep.name}</span>
                            <span className="text-xs font-mono font-medium text-foreground ml-auto">{ep.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 30-day trend */}
              <Card className="border-surface-border bg-surface-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-data-amber" /> 30-Day Request Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyUsage}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={4} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="requests" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Requests" />
                        <Bar dataKey="errors" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} name="Errors" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── Rate Limits Tab ─── */}
            <TabsContent value="rate-limits" className="space-y-6">
              {/* Latency chart */}
              <Card className="border-surface-border bg-surface-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-data-cyan" /> Latency Percentiles (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={latencyPercentiles}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={3} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="ms" />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                        <Line type="monotone" dataKey="p50" stroke="hsl(var(--data-green))" strokeWidth={2} dot={false} name="p50" />
                        <Line type="monotone" dataKey="p95" stroke="hsl(var(--data-amber))" strokeWidth={2} dot={false} name="p95" />
                        <Line type="monotone" dataKey="p99" stroke="hsl(var(--data-red))" strokeWidth={2} dot={false} name="p99" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Rate limit events */}
              <Card className="border-surface-border bg-surface-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-data-amber" /> Recent Rate Limit Events</CardTitle>
                  <CardDescription>Keys approaching or hitting their rate limit threshold.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {rateLimitEvents.map((evt, i) => {
                      const pct = (evt.used / evt.limit) * 100;
                      const isHit = pct >= 99;
                      return (
                        <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-surface-border">
                          <span className="text-xs font-mono text-muted-foreground w-12">{evt.time}</span>
                          <Badge variant={isHit ? "destructive" : "secondary"} className="text-[10px] w-14 justify-center">
                            {isHit ? "HIT" : "WARN"}
                          </Badge>
                          <span className="text-sm text-foreground font-medium flex-1">{evt.key}</span>
                          <code className="text-xs text-muted-foreground font-mono">{evt.endpoint}</code>
                          <div className="flex items-center gap-2 w-40">
                            <div className="flex-1 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isHit ? "bg-destructive" : "bg-data-amber"}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground">{evt.used}/{evt.limit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Per-key limits */}
              <Card className="border-surface-border bg-surface-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Rate Limit Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-surface-border">
                          <th className="text-left py-2 text-xs text-muted-foreground font-medium">Key</th>
                          <th className="text-left py-2 text-xs text-muted-foreground font-medium">Limit</th>
                          <th className="text-left py-2 text-xs text-muted-foreground font-medium">Window</th>
                          <th className="text-left py-2 text-xs text-muted-foreground font-medium">Current Usage</th>
                          <th className="text-left py-2 text-xs text-muted-foreground font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keys.filter((k) => k.isActive).map((k) => {
                          const currentUsage = Math.floor(k.rateLimitPerMin * (0.4 + Math.random() * 0.5));
                          const pct = (currentUsage / k.rateLimitPerMin) * 100;
                          return (
                            <tr key={k.id} className="border-b border-surface-border/50">
                              <td className="py-3 font-medium text-foreground">{k.name}</td>
                              <td className="py-3 font-mono text-muted-foreground">{k.rateLimitPerMin}/min</td>
                              <td className="py-3 text-muted-foreground">Sliding window</td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${pct > 80 ? "bg-data-amber" : "bg-data-green"}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-mono">{currentUsage}/{k.rateLimitPerMin}</span>
                                </div>
                              </td>
                              <td className="py-3">
                                <Badge variant={pct > 80 ? "secondary" : "outline"} className="text-[10px]">
                                  {pct > 80 ? "Elevated" : "Normal"}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
