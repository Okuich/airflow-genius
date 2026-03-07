import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, ComposedChart, Legend,
} from "recharts";
import {
  Database, Brain, TrendingUp, Zap, DollarSign, ArrowDownRight, ArrowUpRight,
  Repeat, CircleDot, Layers, Activity, Sparkles, Target, RefreshCw,
} from "lucide-react";

// ── Mock Data ──────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FLYWHEEL_HISTORY = MONTHS.map((month, i) => {
  const simCount = Math.round(1200 + i * 840 + Math.random() * 300);
  const datasetSize = Math.round(8000 + i * 6200);
  const accuracy = Math.min(97.8, 78.2 + i * 1.72 + Math.random() * 0.4);
  const inferenceMs = Math.max(12, 85 - i * 5.8 - Math.random() * 3);
  const cfdCostPerSim = Math.max(1.2, 8.5 - i * 0.58);
  const surrogateCost = Math.max(0.02, 0.15 - i * 0.01);
  const costSaving = ((1 - surrogateCost / cfdCostPerSim) * 100);
  return {
    month, simCount, datasetSize, accuracy: +accuracy.toFixed(1),
    inferenceMs: +inferenceMs.toFixed(0), cfdCostPerSim: +cfdCostPerSim.toFixed(2),
    surrogateCost: +surrogateCost.toFixed(3), costSaving: +costSaving.toFixed(1),
    trainingRuns: Math.round(2 + i * 1.3),
    featureCount: 24 + i * 3,
  };
});

const MODEL_VERSIONS = [
  { version: "v1.0", date: "Jan 2026", samples: 8000, mae: 0.142, r2: 0.781, latency: 85, status: "retired" },
  { version: "v1.1", date: "Mar 2026", samples: 20400, mae: 0.098, r2: 0.856, latency: 62, status: "retired" },
  { version: "v1.2", date: "May 2026", samples: 38800, mae: 0.071, r2: 0.912, latency: 41, status: "retired" },
  { version: "v1.3", date: "Jul 2026", samples: 51000, mae: 0.052, r2: 0.943, latency: 28, status: "retired" },
  { version: "v2.0", date: "Sep 2026", samples: 63200, mae: 0.038, r2: 0.965, latency: 19, status: "shadow" },
  { version: "v2.1", date: "Nov 2026", samples: 82400, mae: 0.024, r2: 0.978, latency: 14, status: "active" },
];

const GEOMETRY_CLUSTERS = [
  { cluster: "Duct / Channel", samples: 18420, accuracy: 96.2, coverage: 92 },
  { cluster: "Heat Exchanger", samples: 14800, accuracy: 94.8, coverage: 88 },
  { cluster: "Server Rack", samples: 12350, accuracy: 95.1, coverage: 90 },
  { cluster: "Cleanroom Plenum", samples: 9870, accuracy: 93.4, coverage: 85 },
  { cluster: "Exhaust Stack", samples: 8200, accuracy: 91.7, coverage: 78 },
  { cluster: "Mixing Chamber", samples: 6540, accuracy: 89.2, coverage: 72 },
  { cluster: "Valve Body", samples: 5100, accuracy: 87.9, coverage: 65 },
  { cluster: "Custom / Other", samples: 7120, accuracy: 84.3, coverage: 58 },
];

const latest = FLYWHEEL_HISTORY[FLYWHEEL_HISTORY.length - 1];
const earliest = FLYWHEEL_HISTORY[0];

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--foreground))",
};

// ── Flywheel Visual ────────────────────────────────────────────────────────────

function FlywheelDiagram() {
  const steps = [
    { icon: Activity, label: "Simulations Run", detail: `${(latest.simCount).toLocaleString()} this month`, color: "text-primary" },
    { icon: Database, label: "Data Captured", detail: `${latest.datasetSize.toLocaleString()} total samples`, color: "text-chart-2" },
    { icon: Brain, label: "Models Trained", detail: `${latest.trainingRuns} runs this month`, color: "text-chart-3" },
    { icon: Zap, label: "Faster Inference", detail: `${latest.inferenceMs}ms latency`, color: "text-chart-4" },
    { icon: DollarSign, label: "Cost Reduced", detail: `${latest.costSaving}% cheaper`, color: "text-chart-5" },
    { icon: TrendingUp, label: "More Customers", detail: "Flywheel accelerates", color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {steps.map((step, i) => (
        <div key={step.label} className="relative">
          <Card className="h-full">
            <CardContent className="pt-5 pb-4 px-4 text-center space-y-2">
              <div className={`mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center`}>
                <step.icon className={`h-5 w-5 ${step.color}`} />
              </div>
              <p className="text-xs font-semibold text-foreground leading-tight">{step.label}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{step.detail}</p>
            </CardContent>
          </Card>
          {i < steps.length - 1 && (
            <div className="hidden lg:flex absolute top-1/2 -right-2 z-10 -translate-y-1/2">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/40" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function DataFlywheel() {
  const totalSims = FLYWHEEL_HISTORY.reduce((s, m) => s + m.simCount, 0);
  const accuracyGain = latest.accuracy - earliest.accuracy;
  const latencyReduction = ((earliest.inferenceMs - latest.inferenceMs) / earliest.inferenceMs * 100);
  const annualSavings = totalSims * (earliest.cfdCostPerSim - latest.surrogateCost);

  return (
    <div className="min-h-screen bg-background p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Data Flywheel</h1>
          <p className="text-muted-foreground mt-1">How every simulation makes the platform smarter and cheaper</p>
        </div>
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
          <Sparkles className="h-3.5 w-3.5" /> {latest.datasetSize.toLocaleString()} training samples
        </Badge>
      </div>

      {/* Flywheel Diagram */}
      <FlywheelDiagram />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10"><Database className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Dataset Size</p>
                <p className="text-2xl font-bold text-foreground">{latest.datasetSize.toLocaleString()}</p>
              </div>
            </div>
            <p className="text-xs text-chart-4 mt-2 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />+{(latest.datasetSize - earliest.datasetSize).toLocaleString()} YTD
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-chart-3/15"><Target className="h-5 w-5 text-chart-3" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Model Accuracy (R²)</p>
                <p className="text-2xl font-bold text-foreground">{latest.accuracy}%</p>
              </div>
            </div>
            <p className="text-xs text-chart-4 mt-2 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />+{accuracyGain.toFixed(1)}pp improvement
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-chart-4/15"><Zap className="h-5 w-5 text-chart-4" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Inference Latency</p>
                <p className="text-2xl font-bold text-foreground">{latest.inferenceMs}ms</p>
              </div>
            </div>
            <p className="text-xs text-chart-4 mt-2 flex items-center gap-1">
              <ArrowDownRight className="h-3 w-3" />{latencyReduction.toFixed(0)}% faster than baseline
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-chart-5/15"><DollarSign className="h-5 w-5 text-chart-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Est. Annual Savings</p>
                <p className="text-2xl font-bold text-foreground">${Math.round(annualSavings).toLocaleString()}</p>
              </div>
            </div>
            <p className="text-xs text-chart-4 mt-2 flex items-center gap-1">
              <ArrowDownRight className="h-3 w-3" />Surrogate vs full CFD
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="growth" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="growth" className="gap-1.5"><TrendingUp className="h-4 w-4" />Growth</TabsTrigger>
          <TabsTrigger value="accuracy" className="gap-1.5"><Target className="h-4 w-4" />Model Accuracy</TabsTrigger>
          <TabsTrigger value="cost" className="gap-1.5"><DollarSign className="h-4 w-4" />Cost Impact</TabsTrigger>
          <TabsTrigger value="models" className="gap-1.5"><Layers className="h-4 w-4" />Model Registry</TabsTrigger>
        </TabsList>

        {/* Growth Tab */}
        <TabsContent value="growth" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dataset Growth</CardTitle>
                <CardDescription>Cumulative training samples from simulation runs</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={FLYWHEEL_HISTORY}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="datasetSize" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} name="Total Samples" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Monthly Simulations</CardTitle>
                <CardDescription>Each simulation generates new training data</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={FLYWHEEL_HISTORY}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="simCount" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Simulations" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Geometry cluster coverage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Geometry Cluster Coverage</CardTitle>
              <CardDescription>Training data distribution across geometry types — larger coverage = better generalization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {GEOMETRY_CLUSTERS.map((g) => (
                  <div key={g.cluster} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{g.cluster}</p>
                      <Badge variant="secondary" className="text-[10px]">{g.accuracy}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{g.samples.toLocaleString()} samples</p>
                    <Progress value={g.coverage} className="h-1.5" />
                    <p className="text-[11px] text-muted-foreground">{g.coverage}% coverage</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accuracy Tab */}
        <TabsContent value="accuracy" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Accuracy vs Dataset Size</CardTitle>
                <CardDescription>More data → better predictions (diminishing returns expected at scale)</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={FLYWHEEL_HISTORY}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                    <YAxis yAxisId="left" domain={[75, 100]} className="text-xs fill-muted-foreground" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs fill-muted-foreground" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="accuracy" stroke="hsl(var(--chart-3))" strokeWidth={2.5} dot={{ r: 3 }} name="Accuracy (%)" />
                    <Bar yAxisId="right" dataKey="datasetSize" fill="hsl(var(--primary))" fillOpacity={0.2} radius={[4, 4, 0, 0]} name="Dataset Size" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Inference Latency Reduction</CardTitle>
                <CardDescription>Surrogate model response time improves with architecture optimization</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={FLYWHEEL_HISTORY}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" unit="ms" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v}ms`, "Latency"]} />
                    <Area type="monotone" dataKey="inferenceMs" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.15} name="Latency (ms)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cost Impact Tab */}
        <TabsContent value="cost" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cost per Prediction: CFD vs Surrogate</CardTitle>
                <CardDescription>Surrogate models deliver near-instant results at a fraction of CFD cost</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={FLYWHEEL_HISTORY}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" unit="$" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend />
                    <Line type="monotone" dataKey="cfdCostPerSim" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} name="Full CFD ($)" />
                    <Line type="monotone" dataKey="surrogateCost" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 3 }} name="Surrogate ($)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cost Saving Percentage</CardTitle>
                <CardDescription>Percentage reduction when using surrogate vs full CFD solve</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={FLYWHEEL_HISTORY}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                    <YAxis domain={[90, 100]} className="text-xs fill-muted-foreground" unit="%" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, "Saving"]} />
                    <Area type="monotone" dataKey="costSaving" stroke="hsl(var(--chart-5))" fill="hsl(var(--chart-5))" fillOpacity={0.15} name="Cost Saving (%)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Model Registry Tab */}
        <TabsContent value="models">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Surrogate Model Version History</CardTitle>
              <CardDescription>Each version trains on more data, improving accuracy and reducing latency</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Training Samples</TableHead>
                    <TableHead className="text-right">MAE</TableHead>
                    <TableHead className="text-right">R²</TableHead>
                    <TableHead className="text-right">Latency</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MODEL_VERSIONS.map((m) => (
                    <TableRow key={m.version}>
                      <TableCell className="font-mono font-semibold">{m.version}</TableCell>
                      <TableCell className="text-muted-foreground">{m.date}</TableCell>
                      <TableCell className="text-right font-mono">{m.samples.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">{m.mae.toFixed(3)}</TableCell>
                      <TableCell className="text-right font-mono">{m.r2.toFixed(3)}</TableCell>
                      <TableCell className="text-right font-mono">{m.latency}ms</TableCell>
                      <TableCell>
                        <Badge
                          variant={m.status === "active" ? "default" : "secondary"}
                          className={m.status === "active" ? "bg-chart-4/15 text-chart-4" : m.status === "shadow" ? "bg-chart-3/15 text-chart-3" : ""}
                        >
                          {m.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
