import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, Code2, Zap, Shield, Brain, Wind, Microscope, Gauge, Copy, Check,
  ExternalLink, Lock, ArrowRight, Layers, BookOpen, Terminal, Star, Clock,
  FileJson, Webhook, Key, Globe, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

// ── API Catalog ────────────────────────────────────────────────────────────────

interface APIEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  auth: "api_key" | "oauth2" | "service_token";
  rateLimit: string;
  latency: string;
}

interface APIProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: "simulation" | "compliance" | "ml" | "data" | "platform";
  icon: React.ElementType;
  version: string;
  status: "stable" | "beta" | "preview";
  tier: "free" | "pro" | "enterprise";
  endpoints: APIEndpoint[];
  codeExample: string;
  useCases: string[];
  pricing: string;
}

const API_CATALOG: APIProduct[] = [
  {
    id: "sim-api",
    name: "Simulation Engine API",
    slug: "simulation-engine",
    description: "Submit, monitor, and retrieve CFD simulation jobs. Supports steady-state RANS, transient, and multi-region solves with configurable mesh, boundary conditions, and solver parameters.",
    category: "simulation",
    icon: Wind,
    version: "v2.4",
    status: "stable",
    tier: "pro",
    endpoints: [
      { method: "POST", path: "/v2/simulations", description: "Create and queue a new simulation job", auth: "api_key", rateLimit: "100/min", latency: "~200ms" },
      { method: "GET", path: "/v2/simulations/{id}", description: "Get simulation status, progress, and metadata", auth: "api_key", rateLimit: "500/min", latency: "~50ms" },
      { method: "GET", path: "/v2/simulations/{id}/results", description: "Retrieve converged results, residuals, and mesh stats", auth: "api_key", rateLimit: "200/min", latency: "~80ms" },
      { method: "POST", path: "/v2/simulations/{id}/cancel", description: "Cancel a running simulation", auth: "api_key", rateLimit: "50/min", latency: "~100ms" },
      { method: "GET", path: "/v2/simulations", description: "List simulations with filters and pagination", auth: "api_key", rateLimit: "200/min", latency: "~60ms" },
    ],
    codeExample: `const response = await fetch('https://api.flowforge.dev/v2/simulations', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ff_sk_...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Heat Exchanger Optimization',
    mesh: { baseSize: 0.005, refinementLevels: 3 },
    solver: { type: 'steady', turbulenceModel: 'k-epsilon' },
    boundaries: [
      { name: 'inlet', type: 'velocity_inlet', velocity: { x: 2.5, y: 0, z: 0 } },
      { name: 'outlet', type: 'pressure_outlet', pressure: 0 }
    ]
  })
});

const { id, status } = await response.json();
console.log(\`Simulation \${id} status: \${status}\`);`,
    useCases: ["Automated design optimization loops", "CAD-to-CFD pipeline integration", "Parametric sweep orchestration", "CI/CD for simulation validation"],
    pricing: "$0.10 per API call + compute usage",
  },
  {
    id: "compliance-api",
    name: "Compliance Evaluation API",
    slug: "compliance-evaluation",
    description: "Evaluate simulation results against regulatory standards (ISO 14644, ASHRAE 62.1, FDA 21 CFR). Generate audit-ready reports with automated risk scoring and remediation recommendations.",
    category: "compliance",
    icon: Shield,
    version: "v1.8",
    status: "stable",
    tier: "pro",
    endpoints: [
      { method: "POST", path: "/v1/compliance/evaluate", description: "Run compliance evaluation against selected standards", auth: "api_key", rateLimit: "50/min", latency: "~500ms" },
      { method: "GET", path: "/v1/compliance/standards", description: "List available regulatory standards and rules", auth: "api_key", rateLimit: "200/min", latency: "~40ms" },
      { method: "POST", path: "/v1/compliance/reports", description: "Generate a formatted compliance report (PDF/JSON)", auth: "api_key", rateLimit: "20/min", latency: "~2s" },
      { method: "GET", path: "/v1/compliance/reports/{id}", description: "Retrieve a generated compliance report", auth: "api_key", rateLimit: "100/min", latency: "~60ms" },
      { method: "POST", path: "/v1/compliance/risk-score", description: "Calculate weighted risk score for a simulation", auth: "api_key", rateLimit: "100/min", latency: "~300ms" },
    ],
    codeExample: `const evaluation = await fetch('https://api.flowforge.dev/v1/compliance/evaluate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ff_sk_...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    simulation_id: 'sim_abc123',
    standards: ['ISO_14644_3', 'ASHRAE_62_1'],
    domain: 'cleanroom',
    generate_report: true,
  })
});

const { verdict, score, findings, report_url } = await evaluation.json();
// verdict: "compliant" | "non_compliant" | "needs_review"`,
    useCases: ["Automated compliance gates in CI/CD", "Regulatory submission preparation", "Multi-standard audit automation", "Risk trend monitoring"],
    pricing: "$0.25 per evaluation + $1.00 per report",
  },
  {
    id: "ml-inference-api",
    name: "ML Inference API",
    slug: "ml-inference",
    description: "Run surrogate model predictions for pressure drop, convergence probability, and efficiency rating without executing a full CFD solve. 95–99% cost reduction with <20ms latency.",
    category: "ml",
    icon: Brain,
    version: "v2.1",
    status: "stable",
    tier: "pro",
    endpoints: [
      { method: "POST", path: "/v2/inference/predict", description: "Run surrogate model inference on simulation parameters", auth: "api_key", rateLimit: "1000/min", latency: "~14ms" },
      { method: "POST", path: "/v2/inference/batch", description: "Batch predictions for parameter sweeps (up to 1000)", auth: "api_key", rateLimit: "50/min", latency: "~200ms" },
      { method: "GET", path: "/v2/inference/models", description: "List available surrogate models and their accuracy metrics", auth: "api_key", rateLimit: "100/min", latency: "~30ms" },
      { method: "GET", path: "/v2/inference/models/{type}/metrics", description: "Get model version history with MAE, R², and latency", auth: "api_key", rateLimit: "100/min", latency: "~40ms" },
    ],
    codeExample: `const prediction = await fetch('https://api.flowforge.dev/v2/inference/predict', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ff_sk_...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'pressure_drop',
    features: {
      cellCount: 250000,
      baseSize: 0.005,
      reynoldsNumber: 45000,
      turbulenceModel: 'k-epsilon',
      inletVelocity: 2.5,
      fluidDensity: 1.225,
    }
  })
});

const { value, confidence, latency_ms } = await prediction.json();
// value: 342.7 (Pa), confidence: 0.94, latency_ms: 12`,
    useCases: ["Real-time design space exploration", "Parametric optimization without GPU cost", "Pre-flight check before expensive solves", "Embedded predictions in CAD tools"],
    pricing: "$0.001 per prediction",
  },
  {
    id: "diagnostics-api",
    name: "AI Diagnostics Agent API",
    slug: "ai-diagnostics",
    description: "Autonomous CFD troubleshooting agent that diagnoses convergence failures, mesh quality issues, and solver instabilities. Returns root cause analysis and one-click remediation plans.",
    category: "ml",
    icon: Microscope,
    version: "v1.2",
    status: "beta",
    tier: "enterprise",
    endpoints: [
      { method: "POST", path: "/v1/agent/diagnose", description: "Submit simulation for AI-powered diagnostics", auth: "service_token", rateLimit: "20/min", latency: "~3s" },
      { method: "POST", path: "/v1/agent/execute-plan", description: "Execute a remediation plan from diagnostics", auth: "service_token", rateLimit: "10/min", latency: "~1s" },
      { method: "GET", path: "/v1/agent/history/{sim_id}", description: "Retrieve diagnostic history for a simulation", auth: "api_key", rateLimit: "100/min", latency: "~50ms" },
    ],
    codeExample: `const diagnosis = await fetch('https://api.flowforge.dev/v1/agent/diagnose', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ff_svc_...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    simulation_id: 'sim_abc123',
    auto_remediate: false,
  })
});

const { root_cause, severity, remediation_plan } = await diagnosis.json();
// root_cause: "Mesh skewness > 0.95 near inlet boundary"
// remediation_plan: [{ action: "refine_mesh", region: "inlet", ... }]`,
    useCases: ["Automated solver failure recovery", "24/7 unattended simulation monitoring", "Engineer training and onboarding", "SLA-driven simulation orchestration"],
    pricing: "$0.50 per diagnosis",
  },
  {
    id: "feature-store-api",
    name: "Feature Store API",
    slug: "feature-store",
    description: "Access the simulation feature store for ML model training. Query feature vectors, labels, and geometry clusters. Power custom model training on FlowForge's proprietary simulation dataset.",
    category: "data",
    icon: Layers,
    version: "v1.0",
    status: "preview",
    tier: "enterprise",
    endpoints: [
      { method: "GET", path: "/v1/features", description: "Query feature vectors with filters (cluster, version, date range)", auth: "service_token", rateLimit: "100/min", latency: "~80ms" },
      { method: "GET", path: "/v1/features/clusters", description: "List geometry clusters with sample counts", auth: "api_key", rateLimit: "100/min", latency: "~40ms" },
      { method: "POST", path: "/v1/features/export", description: "Export feature dataset as CSV/Parquet", auth: "service_token", rateLimit: "5/min", latency: "~5s" },
    ],
    codeExample: `const features = await fetch('https://api.flowforge.dev/v1/features?cluster=heat_exchanger&limit=1000', {
  headers: { 'Authorization': 'Bearer ff_svc_...' }
});

const { data, total_count, clusters } = await features.json();
// data: [{ feature_vector: [...], labels: {...}, geometry_cluster: "heat_exchanger" }]`,
    useCases: ["Custom surrogate model training", "Academic research datasets", "Benchmarking proprietary models", "Transfer learning from FlowForge data"],
    pricing: "$0.05 per 1,000 records",
  },
  {
    id: "webhooks-api",
    name: "Webhooks & Events API",
    slug: "webhooks",
    description: "Subscribe to real-time events: simulation completed, compliance violation detected, model retrained, GPU quota exceeded. Build event-driven workflows with your existing tools.",
    category: "platform",
    icon: Webhook,
    version: "v1.4",
    status: "stable",
    tier: "free",
    endpoints: [
      { method: "POST", path: "/v1/webhooks", description: "Register a new webhook subscription", auth: "api_key", rateLimit: "20/min", latency: "~100ms" },
      { method: "GET", path: "/v1/webhooks", description: "List registered webhooks", auth: "api_key", rateLimit: "100/min", latency: "~40ms" },
      { method: "DELETE", path: "/v1/webhooks/{id}", description: "Remove a webhook subscription", auth: "api_key", rateLimit: "20/min", latency: "~80ms" },
      { method: "GET", path: "/v1/webhooks/{id}/deliveries", description: "View delivery history and retry failed events", auth: "api_key", rateLimit: "100/min", latency: "~50ms" },
    ],
    codeExample: `await fetch('https://api.flowforge.dev/v1/webhooks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ff_sk_...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://your-app.com/webhooks/flowforge',
    events: ['simulation.completed', 'compliance.violation', 'model.retrained'],
    secret: 'whsec_...',
  })
});

// Your endpoint receives:
// { event: "simulation.completed", data: { id: "sim_abc123", status: "converged", ... } }`,
    useCases: ["Slack/Teams notifications on simulation completion", "Trigger downstream pipelines on compliance violations", "Sync simulation results to data warehouses", "Real-time dashboards and monitoring"],
    pricing: "Free — included with all plans",
  },
];

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  simulation: { label: "Simulation", color: "bg-primary/10 text-primary" },
  compliance: { label: "Compliance", color: "bg-chart-5/15 text-chart-5" },
  ml: { label: "Machine Learning", color: "bg-chart-3/15 text-chart-3" },
  data: { label: "Data", color: "bg-chart-2/15 text-chart-2" },
  platform: { label: "Platform", color: "bg-chart-4/15 text-chart-4" },
};

const STATUS_STYLES: Record<string, string> = {
  stable: "bg-chart-4/15 text-chart-4",
  beta: "bg-chart-5/15 text-chart-5",
  preview: "bg-muted text-muted-foreground",
};

const METHOD_COLORS: Record<string, string> = {
  GET: "text-chart-4",
  POST: "text-primary",
  PUT: "text-chart-5",
  DELETE: "text-destructive",
  PATCH: "text-chart-3",
};

// ── Components ─────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-chart-4" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function APICard({ api, onSelect }: { api: APIProduct; onSelect: () => void }) {
  const cat = CATEGORY_LABELS[api.category];
  return (
    <Card className="group hover:shadow-lg transition-all cursor-pointer border-border hover:border-primary/30" onClick={onSelect}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="p-2.5 rounded-xl bg-muted">
            <api.icon className="h-5 w-5 text-foreground" />
          </div>
          <div className="flex gap-1.5">
            <Badge className={`text-[10px] ${STATUS_STYLES[api.status]}`}>{api.status}</Badge>
            <Badge variant="outline" className="text-[10px] font-mono">{api.version}</Badge>
          </div>
        </div>
        <CardTitle className="text-base mt-3 group-hover:text-primary transition-colors">{api.name}</CardTitle>
        <CardDescription className="text-xs line-clamp-2">{api.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <Badge className={`text-[10px] ${cat.color}`}>{cat.label}</Badge>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Terminal className="h-3 w-3" />
            {api.endpoints.length} endpoints
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-[11px] text-muted-foreground">{api.pricing}</span>
          <Badge variant={api.tier === "free" ? "secondary" : api.tier === "enterprise" ? "default" : "outline"} className="text-[10px]">
            {api.tier}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function APIDetailView({ api, onBack }: { api: APIProduct; onBack: () => void }) {
  const [expandedEndpoint, setExpandedEndpoint] = useState<number | null>(null);
  const cat = CATEGORY_LABELS[api.category];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-muted">
            <api.icon className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← APIs</button>
              <span className="text-muted-foreground">/</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mt-1">{api.name}</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{api.description}</p>
            <div className="flex gap-2 mt-3">
              <Badge className={`${cat.color}`}>{cat.label}</Badge>
              <Badge className={`${STATUS_STYLES[api.status]}`}>{api.status}</Badge>
              <Badge variant="outline" className="font-mono">{api.version}</Badge>
              <Badge variant={api.tier === "free" ? "secondary" : "default"}>{api.tier}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />Full Docs
          </Button>
          <Button size="sm" className="gap-1.5">
            <Key className="h-3.5 w-3.5" />Get API Key
          </Button>
        </div>
      </div>

      <Tabs defaultValue="endpoints" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="endpoints" className="gap-1.5"><Terminal className="h-4 w-4" />Endpoints</TabsTrigger>
          <TabsTrigger value="quickstart" className="gap-1.5"><Code2 className="h-4 w-4" />Quick Start</TabsTrigger>
          <TabsTrigger value="usecases" className="gap-1.5"><Star className="h-4 w-4" />Use Cases</TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Endpoints</CardTitle>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Lock className="h-3 w-3" />Auth required</span>
                  <span className="flex items-center gap-1"><Globe className="h-3 w-3" />Base: api.flowforge.dev</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {api.endpoints.map((ep, i) => (
                <div key={i} className="rounded-lg border border-border overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => setExpandedEndpoint(expandedEndpoint === i ? null : i)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-mono text-xs font-bold w-14 ${METHOD_COLORS[ep.method]}`}>{ep.method}</span>
                      <span className="font-mono text-sm text-foreground">{ep.path}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground hidden sm:inline">{ep.description}</span>
                      {expandedEndpoint === i ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>
                  {expandedEndpoint === i && (
                    <div className="px-4 pb-4 pt-2 border-t border-border bg-muted/30 space-y-3">
                      <p className="text-sm text-muted-foreground">{ep.description}</p>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Auth</span>
                          <div className="flex items-center gap-1 mt-1 font-mono">
                            <Lock className="h-3 w-3" />{ep.auth}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Rate Limit</span>
                          <div className="flex items-center gap-1 mt-1 font-mono">
                            <Gauge className="h-3 w-3" />{ep.rateLimit}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Latency</span>
                          <div className="flex items-center gap-1 mt-1 font-mono">
                            <Clock className="h-3 w-3" />{ep.latency}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quickstart">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Quick Start Example</CardTitle>
                <CopyButton text={api.codeExample} />
              </div>
              <CardDescription>JavaScript / TypeScript — copy and paste into your project</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-xs font-mono text-foreground leading-relaxed">
                <code>{api.codeExample}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usecases">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Common Use Cases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {api.useCases.map((uc) => (
                  <div key={uc} className="flex items-start gap-3 rounded-lg border border-border p-4">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground">{uc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function APIMarketplace() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedAPI, setSelectedAPI] = useState<APIProduct | null>(null);

  const categories = ["all", ...new Set(API_CATALOG.map((a) => a.category))];

  const filtered = API_CATALOG.filter((api) => {
    const matchesSearch = search === "" || api.name.toLowerCase().includes(search.toLowerCase()) || api.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || api.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (selectedAPI) {
    return (
      <div className="min-h-screen bg-background p-6">
        <APIDetailView api={selectedAPI} onBack={() => setSelectedAPI(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-8">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
          <Zap className="h-3.5 w-3.5" /> Developer Platform
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">API Marketplace</h1>
        <p className="text-muted-foreground">
          Build on FlowForge — integrate simulation, compliance, and ML inference into your own products. Production-ready REST APIs with predictable pricing.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
        {[
          { label: "APIs Available", value: API_CATALOG.length.toString(), icon: FileJson },
          { label: "Total Endpoints", value: API_CATALOG.reduce((s, a) => s + a.endpoints.length, 0).toString(), icon: Terminal },
          { label: "Avg Latency", value: "<50ms", icon: Clock },
          { label: "Uptime SLA", value: "99.9%", icon: Globe },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4 text-center">
              <s.icon className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search APIs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
              className="text-xs capitalize"
            >
              {cat === "all" ? "All" : CATEGORY_LABELS[cat]?.label || cat}
            </Button>
          ))}
        </div>
      </div>

      {/* API Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((api) => (
          <APICard key={api.id} api={api} onSelect={() => setSelectedAPI(api)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>No APIs match your search</p>
        </div>
      )}

      {/* Rate limits overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rate Limits & Authentication</CardTitle>
          <CardDescription>All APIs use Bearer token authentication. Rate limits are per-organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Rate Limit</TableHead>
                <TableHead className="text-right">Concurrent Connections</TableHead>
                <TableHead className="text-right">Webhook Events</TableHead>
                <TableHead>Auth Methods</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { tier: "Free", rate: "100 req/min", concurrent: "5", webhooks: "10 events", auth: "API Key" },
                { tier: "Pro", rate: "1,000 req/min", concurrent: "25", webhooks: "Unlimited", auth: "API Key, OAuth 2.0" },
                { tier: "Enterprise", rate: "10,000 req/min", concurrent: "100", webhooks: "Unlimited", auth: "API Key, OAuth 2.0, Service Token" },
              ].map((row) => (
                <TableRow key={row.tier}>
                  <TableCell className="font-medium">{row.tier}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.rate}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.concurrent}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.webhooks}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.auth}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
