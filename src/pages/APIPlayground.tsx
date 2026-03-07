import { useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Play, Copy, Check, Clock, ChevronDown, Wind, Shield, Brain,
  Microscope, Layers, Webhook, Zap, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";

/* ─── Endpoint catalog ─── */

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  defaultBody?: string;
  sampleResponse: string;
  latency: number;
  statusCode: number;
}

interface APIGroup {
  id: string;
  name: string;
  icon: React.ElementType;
  baseUrl: string;
  endpoints: Endpoint[];
}

const API_GROUPS: APIGroup[] = [
  {
    id: "simulation", name: "Simulation Engine", icon: Wind, baseUrl: "https://api.flowforge.dev",
    endpoints: [
      {
        method: "POST", path: "/v2/simulations", description: "Create a new simulation job",
        defaultBody: JSON.stringify({
          name: "Heat Exchanger Optimization",
          mesh: { baseSize: 0.005, refinementLevels: 3 },
          solver: { type: "steady", turbulenceModel: "k-epsilon" },
          boundaries: [
            { name: "inlet", type: "velocity_inlet", velocity: { x: 2.5, y: 0, z: 0 } },
            { name: "outlet", type: "pressure_outlet", pressure: 0 },
          ],
        }, null, 2),
        sampleResponse: JSON.stringify({
          id: "sim_7f3a9b2c",
          status: "queued",
          name: "Heat Exchanger Optimization",
          created_at: "2026-03-07T10:15:00Z",
          estimated_time: 1200,
          cell_count: null,
          progress: 0,
        }, null, 2),
        latency: 187, statusCode: 201,
      },
      {
        method: "GET", path: "/v2/simulations/{id}", description: "Get simulation status",
        sampleResponse: JSON.stringify({
          id: "sim_7f3a9b2c",
          status: "running",
          progress: 0.42,
          current_iteration: 210,
          cell_count: 248000,
          mesh_stats: { minQuality: 0.31, avgQuality: 0.87, maxSkewness: 0.72 },
          residuals: { continuity: 2.1e-4, x_momentum: 8.3e-5, energy: 1.4e-5 },
        }, null, 2),
        latency: 34, statusCode: 200,
      },
      {
        method: "GET", path: "/v2/simulations/{id}/results", description: "Retrieve converged results",
        sampleResponse: JSON.stringify({
          simulation_id: "sim_7f3a9b2c",
          converged: true,
          total_iterations: 500,
          solve_time_seconds: 1142,
          pressure_drop: 342.7,
          efficiency_rating: "Excellent",
          residuals: { continuity: 4.2e-6, x_momentum: 1.1e-6, energy: 8.7e-7 },
        }, null, 2),
        latency: 62, statusCode: 200,
      },
      {
        method: "GET", path: "/v2/simulations", description: "List simulations with filters",
        sampleResponse: JSON.stringify({
          data: [
            { id: "sim_7f3a9b2c", name: "Heat Exchanger Optimization", status: "completed", created_at: "2026-03-07T10:15:00Z" },
            { id: "sim_a1b2c3d4", name: "Cleanroom Airflow Study", status: "running", created_at: "2026-03-06T14:30:00Z" },
          ],
          pagination: { page: 1, per_page: 20, total: 47 },
        }, null, 2),
        latency: 48, statusCode: 200,
      },
    ],
  },
  {
    id: "compliance", name: "Compliance Evaluation", icon: Shield, baseUrl: "https://api.flowforge.dev",
    endpoints: [
      {
        method: "POST", path: "/v1/compliance/evaluate", description: "Run compliance evaluation",
        defaultBody: JSON.stringify({
          simulation_id: "sim_7f3a9b2c",
          standards: ["ISO_14644_3", "ASHRAE_62_1"],
          domain: "cleanroom",
          generate_report: true,
        }, null, 2),
        sampleResponse: JSON.stringify({
          evaluation_id: "eval_x9k2m",
          verdict: "compliant",
          score: 94.2,
          findings: [
            { standard: "ISO_14644_3", status: "pass", details: "Particle count within Class 7 limits" },
            { standard: "ASHRAE_62_1", status: "pass", details: "Ventilation rate exceeds minimum by 15%" },
          ],
          report_url: "/v1/compliance/reports/rpt_abc123",
        }, null, 2),
        latency: 423, statusCode: 200,
      },
      {
        method: "GET", path: "/v1/compliance/standards", description: "List regulatory standards",
        sampleResponse: JSON.stringify({
          standards: [
            { code: "ISO_14644_3", name: "Cleanrooms — Test Methods", version: "2019", domain: "cleanroom" },
            { code: "ASHRAE_62_1", name: "Ventilation for Acceptable IAQ", version: "2022", domain: "hvac" },
            { code: "FDA_21_CFR", name: "Current Good Manufacturing Practice", version: "2024", domain: "pharma" },
          ],
        }, null, 2),
        latency: 28, statusCode: 200,
      },
      {
        method: "POST", path: "/v1/compliance/risk-score", description: "Calculate risk score",
        defaultBody: JSON.stringify({
          simulation_id: "sim_7f3a9b2c",
          domain: "cleanroom",
          weight_profile: "conservative",
        }, null, 2),
        sampleResponse: JSON.stringify({
          risk_score: 12.4,
          risk_level: "low",
          breakdown: { airflow: 8.2, temperature: 14.1, particle_count: 11.3, pressure_differential: 15.8 },
          trend: "improving",
        }, null, 2),
        latency: 278, statusCode: 200,
      },
    ],
  },
  {
    id: "inference", name: "ML Inference", icon: Brain, baseUrl: "https://api.flowforge.dev",
    endpoints: [
      {
        method: "POST", path: "/v2/inference/predict", description: "Run surrogate model prediction",
        defaultBody: JSON.stringify({
          model: "pressure_drop",
          features: {
            cellCount: 250000,
            reynoldsNumber: 45000,
            turbulenceModel: "k-epsilon",
            inletVelocity: 2.5,
            fluidDensity: 1.225,
          },
        }, null, 2),
        sampleResponse: JSON.stringify({
          prediction_id: "pred_m8n3x",
          model: "pressure_drop",
          model_version: 14,
          value: 342.7,
          unit: "Pa",
          confidence: 0.94,
          latency_ms: 12,
          feature_importance: { reynoldsNumber: 0.38, cellCount: 0.22, inletVelocity: 0.19, turbulenceModel: 0.14, fluidDensity: 0.07 },
        }, null, 2),
        latency: 14, statusCode: 200,
      },
      {
        method: "POST", path: "/v2/inference/batch", description: "Batch predictions (up to 1000)",
        defaultBody: JSON.stringify({
          model: "pressure_drop",
          feature_sets: [
            { inletVelocity: 1.0, cellCount: 250000 },
            { inletVelocity: 2.0, cellCount: 250000 },
            { inletVelocity: 3.0, cellCount: 250000 },
          ],
        }, null, 2),
        sampleResponse: JSON.stringify({
          batch_id: "batch_q2w3e",
          model: "pressure_drop",
          results: [
            { index: 0, value: 54.8, confidence: 0.96 },
            { index: 1, value: 219.3, confidence: 0.95 },
            { index: 2, value: 493.1, confidence: 0.93 },
          ],
          total_latency_ms: 38,
        }, null, 2),
        latency: 42, statusCode: 200,
      },
      {
        method: "GET", path: "/v2/inference/models", description: "List surrogate models",
        sampleResponse: JSON.stringify({
          models: [
            { type: "pressure_drop", version: 14, r_squared: 0.973, mae: 8.4, status: "active" },
            { type: "convergence_probability", version: 8, r_squared: 0.941, mae: 0.03, status: "active" },
            { type: "efficiency_rating", version: 6, r_squared: 0.918, mae: 0.12, status: "active" },
          ],
        }, null, 2),
        latency: 31, statusCode: 200,
      },
    ],
  },
  {
    id: "diagnostics", name: "AI Diagnostics", icon: Microscope, baseUrl: "https://api.flowforge.dev",
    endpoints: [
      {
        method: "POST", path: "/v1/agent/diagnose", description: "AI-powered simulation diagnostics",
        defaultBody: JSON.stringify({
          simulation_id: "sim_7f3a9b2c",
          include_recommendations: true,
          max_depth: 3,
        }, null, 2),
        sampleResponse: JSON.stringify({
          diagnosis_id: "diag_k9p2",
          simulation_id: "sim_7f3a9b2c",
          issues: [
            {
              severity: "warning",
              title: "High mesh skewness near inlet",
              description: "Mesh skewness exceeds 0.85 in 12 cells near the inlet boundary.",
              recommendation: "Increase local refinement at inlet region to level 4",
            },
          ],
          remediation_plan: {
            id: "plan_r3m4",
            steps: [
              { action: "refine_mesh", target: "inlet_region", params: { refinement_level: 4 } },
              { action: "adjust_relaxation", target: "pressure", params: { factor: 0.25 } },
            ],
            estimated_improvement: "~15% faster convergence",
          },
        }, null, 2),
        latency: 2840, statusCode: 200,
      },
    ],
  },
];

/* ─── Helpers ─── */

const METHOD_COLORS: Record<string, string> = {
  GET: "text-data-green",
  POST: "text-data-cyan",
  PUT: "text-data-amber",
  DELETE: "text-data-red",
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast.success("Copied"); setTimeout(() => setCopied(false), 1500); }}
      className="text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-data-green" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

/* ─── Request Panel ─── */

function RequestPanel({ group, endpoint }: { group: APIGroup; endpoint: Endpoint }) {
  const [body, setBody] = useState(endpoint.defaultBody ?? "");
  const [apiKey, setApiKey] = useState("ff_sk_test_...");
  const [response, setResponse] = useState<{ status: number; body: string; latency: number; headers: Record<string, string> } | null>(null);
  const [loading, setLoading] = useState(false);

  const fullUrl = `${group.baseUrl}${endpoint.path}`;

  const sendRequest = () => {
    setLoading(true);
    setResponse(null);
    // Simulate network latency
    const jitter = Math.floor(endpoint.latency * (0.8 + Math.random() * 0.4));
    setTimeout(() => {
      setResponse({
        status: endpoint.statusCode,
        body: endpoint.sampleResponse,
        latency: jitter,
        headers: {
          "content-type": "application/json",
          "x-request-id": `req_${Math.random().toString(36).slice(2, 10)}`,
          "x-ratelimit-limit": "100",
          "x-ratelimit-remaining": String(Math.floor(70 + Math.random() * 28)),
          "x-response-time": `${jitter}ms`,
        },
      });
      setLoading(false);
    }, jitter);
  };

  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {/* Request */}
      <div className="space-y-4 flex flex-col">
        {/* URL bar */}
        <Card className="border-surface-border bg-surface-panel">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Badge className={`font-mono text-xs shrink-0 ${endpoint.method === "GET" ? "bg-data-green/15 text-data-green border-data-green/30" : "bg-data-cyan/15 text-data-cyan border-data-cyan/30"}`} variant="outline">
                {endpoint.method}
              </Badge>
              <code className="text-sm font-mono text-foreground flex-1 truncate">{fullUrl}</code>
              <CopyBtn text={fullUrl} />
            </div>
          </CardContent>
        </Card>

        {/* Auth */}
        <Card className="border-surface-border bg-surface-panel">
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-xs text-muted-foreground">Authorization</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] shrink-0">Bearer</Badge>
              <Input
                className="font-mono text-xs h-8 bg-background"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Body */}
        {endpoint.defaultBody && (
          <Card className="border-surface-border bg-surface-panel flex-1 flex flex-col min-h-0">
            <CardHeader className="py-2 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-muted-foreground">Request Body</CardTitle>
              <Badge variant="outline" className="text-[10px]">JSON</Badge>
            </CardHeader>
            <CardContent className="px-4 pb-3 flex-1 min-h-0">
              <textarea
                className="w-full h-full min-h-[200px] bg-background rounded-lg border border-surface-border p-3 font-mono text-xs text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
              />
            </CardContent>
          </Card>
        )}

        {/* Send */}
        <Button onClick={sendRequest} disabled={loading} className="gap-2 w-full">
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> Send Request
            </>
          )}
        </Button>
      </div>

      {/* Response */}
      <div className="space-y-4 flex flex-col">
        {!response && !loading && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Send a request to see the response</p>
              <p className="text-xs mt-1 opacity-60">Responses are simulated with realistic data</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Awaiting response…</p>
            </div>
          </div>
        )}

        {response && (
          <>
            {/* Status */}
            <Card className="border-surface-border bg-surface-panel">
              <CardContent className="p-3 flex items-center gap-3">
                {response.status < 300 ? (
                  <CheckCircle2 className="w-4 h-4 text-data-green shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-data-red shrink-0" />
                )}
                <span className={`font-mono text-sm font-bold ${response.status < 300 ? "text-data-green" : "text-data-red"}`}>
                  {response.status} {response.status === 200 ? "OK" : response.status === 201 ? "Created" : "Error"}
                </span>
                <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {response.latency}ms
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {new TextEncoder().encode(response.body).length} bytes
                </Badge>
              </CardContent>
            </Card>

            {/* Response Tabs */}
            <Tabs defaultValue="body" className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-fit">
                <TabsTrigger value="body" className="text-xs">Body</TabsTrigger>
                <TabsTrigger value="headers" className="text-xs">Headers</TabsTrigger>
                <TabsTrigger value="curl" className="text-xs">cURL</TabsTrigger>
              </TabsList>
              <TabsContent value="body" className="flex-1 min-h-0 mt-2">
                <Card className="border-surface-border bg-surface-panel h-full">
                  <CardContent className="p-0 h-full relative">
                    <div className="absolute top-2 right-2 z-10">
                      <CopyBtn text={response.body} />
                    </div>
                    <pre className="p-4 font-mono text-xs text-data-green overflow-auto h-full max-h-[420px] leading-relaxed">
                      {response.body}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="headers" className="mt-2">
                <Card className="border-surface-border bg-surface-panel">
                  <CardContent className="p-4 space-y-1.5">
                    {Object.entries(response.headers).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-3 text-xs">
                        <span className="font-mono font-medium text-foreground min-w-[180px]">{k}</span>
                        <span className="font-mono text-muted-foreground">{v}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="curl" className="mt-2">
                <Card className="border-surface-border bg-surface-panel">
                  <CardContent className="p-0 relative">
                    <div className="absolute top-2 right-2 z-10">
                      <CopyBtn text={`curl -X ${endpoint.method} '${fullUrl}' \\\n  -H 'Authorization: Bearer ${apiKey}' \\\n  -H 'Content-Type: application/json'${endpoint.defaultBody ? ` \\\n  -d '${body}'` : ""}`} />
                    </div>
                    <pre className="p-4 font-mono text-xs text-muted-foreground overflow-auto max-h-[300px] leading-relaxed">
{`curl -X ${endpoint.method} '${fullUrl}' \\
  -H 'Authorization: Bearer ${apiKey}' \\
  -H 'Content-Type: application/json'${endpoint.defaultBody ? ` \\
  -d '${body}'` : ""}`}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Page ─── */

export default function APIPlayground() {
  const [selectedGroup, setSelectedGroup] = useState(API_GROUPS[0].id);
  const [selectedEndpoint, setSelectedEndpoint] = useState(0);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(API_GROUPS[0].id);

  const group = API_GROUPS.find((g) => g.id === selectedGroup)!;
  const endpoint = group.endpoints[selectedEndpoint];

  const handleSelectEndpoint = (groupId: string, epIdx: number) => {
    setSelectedGroup(groupId);
    setSelectedEndpoint(epIdx);
  };

  return (
    <div className="flex h-screen bg-background dark">
      <AppSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 py-5 border-b border-surface-border shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs font-mono">Interactive</Badge>
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">API Playground</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Test API endpoints with live request/response previews. Responses are simulated with realistic data.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs gap-1">
                <AlertTriangle className="w-3 h-3" /> Sandbox Mode
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar: endpoint picker */}
          <div className="w-72 border-r border-surface-border overflow-y-auto p-3 space-y-1 shrink-0">
            {API_GROUPS.map((g) => {
              const Icon = g.icon;
              const isExpanded = expandedGroup === g.id;
              return (
                <div key={g.id}>
                  <button
                    onClick={() => setExpandedGroup(isExpanded ? null : g.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-overlay/50 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="font-medium flex-1 text-left">{g.name}</span>
                    <Badge variant="outline" className="text-[10px]">{g.endpoints.length}</Badge>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {isExpanded && (
                    <div className="ml-3 pl-3 border-l border-surface-border space-y-0.5 mt-0.5 mb-1">
                      {g.endpoints.map((ep, idx) => {
                        const active = selectedGroup === g.id && selectedEndpoint === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSelectEndpoint(g.id, idx)}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs transition-colors text-left ${
                              active
                                ? "bg-primary/10 text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-surface-overlay/30"
                            }`}
                          >
                            <span className={`font-mono font-bold shrink-0 w-10 ${METHOD_COLORS[ep.method]}`}>
                              {ep.method}
                            </span>
                            <span className="font-mono truncate">{ep.path}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Main content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Endpoint header */}
            <div className="mb-5">
              <div className="flex items-center gap-3">
                <Badge className={`font-mono text-xs ${endpoint.method === "GET" ? "bg-data-green/15 text-data-green border-data-green/30" : "bg-data-cyan/15 text-data-cyan border-data-cyan/30"}`} variant="outline">
                  {endpoint.method}
                </Badge>
                <code className="text-lg font-mono font-medium text-foreground">{endpoint.path}</code>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{endpoint.description}</p>
            </div>

            <RequestPanel key={`${selectedGroup}-${selectedEndpoint}`} group={group} endpoint={endpoint} />
          </div>
        </div>
      </main>
    </div>
  );
}
