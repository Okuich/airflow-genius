import { useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Copy, Check, Download, Package, FileCode2, Terminal,
  Wind, Shield, Brain, Microscope, Layers, Webhook, Zap, ArrowRight,
} from "lucide-react";

/* ─── API definitions for codegen ─── */

const APIS = [
  { id: "simulation", name: "Simulation Engine", icon: Wind, version: "v2.4", endpoints: 5 },
  { id: "compliance", name: "Compliance Evaluation", icon: Shield, version: "v1.8", endpoints: 5 },
  { id: "inference", name: "ML Inference", icon: Brain, version: "v2.1", endpoints: 4 },
  { id: "diagnostics", name: "AI Diagnostics Agent", icon: Microscope, version: "v1.2", endpoints: 3 },
  { id: "features", name: "Feature Store", icon: Layers, version: "v1.0", endpoints: 4 },
  { id: "webhooks", name: "Webhooks", icon: Webhook, version: "v1.1", endpoints: 2 },
] as const;

type Lang = "python" | "javascript" | "go";

const LANG_META: Record<Lang, { label: string; icon: string; ext: string; pkg: string; install: string }> = {
  python: { label: "Python", icon: "🐍", ext: ".py", pkg: "flowforge-sdk", install: "pip install flowforge-sdk" },
  javascript: { label: "JavaScript / TypeScript", icon: "⚡", ext: ".ts", pkg: "@flowforge/sdk", install: "npm install @flowforge/sdk" },
  go: { label: "Go", icon: "🔵", ext: ".go", pkg: "flowforge-go", install: "go get github.com/flowforge/flowforge-go" },
};

/* ─── Code generators ─── */

function genPython(apis: string[]): string {
  const imports = apis.map((a) => `    ${a}`).join(",\n");
  const usage = apis.map((a) => {
    switch (a) {
      case "simulation":
        return `# ── Simulation Engine ──────────────────────────────
sim = client.simulations.create(
    name="Heat Exchanger Optimization",
    mesh={"baseSize": 0.005, "refinementLevels": 3},
    solver={"type": "steady", "turbulenceModel": "k-epsilon"},
    boundaries=[
        {"name": "inlet", "type": "velocity_inlet", "velocity": {"x": 2.5}},
        {"name": "outlet", "type": "pressure_outlet", "pressure": 0},
    ],
)
print(f"Simulation {sim.id} — status: {sim.status}")

# Poll until complete
result = client.simulations.wait(sim.id, timeout=3600)
print(f"Pressure drop: {result.pressure_drop} Pa")`;
      case "compliance":
        return `# ── Compliance Evaluation ──────────────────────────
evaluation = client.compliance.evaluate(
    simulation_id=sim.id,
    standards=["ISO_14644_3", "ASHRAE_62_1"],
    domain="cleanroom",
)
print(f"Verdict: {evaluation.verdict} (score: {evaluation.score})")

# Generate PDF report
report = client.compliance.create_report(
    simulation_id=sim.id,
    format="pdf",
    standards=["ISO_14644_3"],
)
report.download("compliance_report.pdf")`;
      case "inference":
        return `# ── ML Inference ──────────────────────────────────
prediction = client.inference.predict(
    model="pressure_drop",
    features={
        "cellCount": 250_000,
        "reynoldsNumber": 45_000,
        "turbulenceModel": "k-epsilon",
        "inletVelocity": 2.5,
    },
)
print(f"Predicted: {prediction.value:.1f} Pa (conf: {prediction.confidence:.0%})")

# Batch predictions for parameter sweep
batch = client.inference.batch_predict(
    model="pressure_drop",
    feature_sets=[{"inletVelocity": v} for v in [1.0, 2.0, 3.0, 4.0, 5.0]],
)
for r in batch.results:
    print(f"  v={r.features['inletVelocity']}  →  {r.value:.1f} Pa")`;
      case "diagnostics":
        return `# ── AI Diagnostics ────────────────────────────────
diagnosis = client.diagnostics.diagnose(
    simulation_id=sim.id,
    include_recommendations=True,
)
for issue in diagnosis.issues:
    print(f"[{issue.severity}] {issue.title}: {issue.description}")

# Auto-apply recommended fix
if diagnosis.remediation_plan:
    client.diagnostics.execute_plan(diagnosis.remediation_plan.id)`;
      case "features":
        return `# ── Feature Store ─────────────────────────────────
features = client.features.list(
    geometry_cluster="server_rack",
    limit=100,
)
print(f"Found {len(features)} feature vectors")

# Ingest new features from simulation
client.features.ingest(
    simulation_id=sim.id,
    feature_version="v2",
)`;
      case "webhooks":
        return `# ── Webhooks ──────────────────────────────────────
webhook = client.webhooks.create(
    url="https://your-app.com/api/flowforge-webhook",
    events=["simulation.completed", "compliance.evaluated"],
    secret="whsec_...",
)
print(f"Webhook {webhook.id} active on {len(webhook.events)} events")`;
      default:
        return "";
    }
  }).join("\n\n");

  return `"""
FlowForge SDK — Python Client
Auto-generated for selected APIs. Install: pip install flowforge-sdk
"""

from flowforge import FlowForgeClient
from flowforge.apis import (
${imports}
)

# Initialize client
client = FlowForgeClient(api_key="ff_sk_...")

${usage}
`;
}

function genJavaScript(apis: string[]): string {
  const usage = apis.map((a) => {
    switch (a) {
      case "simulation":
        return `// ── Simulation Engine ──────────────────────────────
const sim = await client.simulations.create({
  name: 'Heat Exchanger Optimization',
  mesh: { baseSize: 0.005, refinementLevels: 3 },
  solver: { type: 'steady', turbulenceModel: 'k-epsilon' },
  boundaries: [
    { name: 'inlet', type: 'velocity_inlet', velocity: { x: 2.5 } },
    { name: 'outlet', type: 'pressure_outlet', pressure: 0 },
  ],
});
console.log(\`Simulation \${sim.id} — status: \${sim.status}\`);

// Poll until complete
const result = await client.simulations.wait(sim.id, { timeout: 3600 });
console.log(\`Pressure drop: \${result.pressureDrop} Pa\`);`;
      case "compliance":
        return `// ── Compliance Evaluation ──────────────────────────
const evaluation = await client.compliance.evaluate({
  simulationId: sim.id,
  standards: ['ISO_14644_3', 'ASHRAE_62_1'],
  domain: 'cleanroom',
});
console.log(\`Verdict: \${evaluation.verdict} (score: \${evaluation.score})\`);

// Generate PDF report
const report = await client.compliance.createReport({
  simulationId: sim.id,
  format: 'pdf',
  standards: ['ISO_14644_3'],
});
await report.download('compliance_report.pdf');`;
      case "inference":
        return `// ── ML Inference ──────────────────────────────────
const prediction = await client.inference.predict({
  model: 'pressure_drop',
  features: {
    cellCount: 250_000,
    reynoldsNumber: 45_000,
    turbulenceModel: 'k-epsilon',
    inletVelocity: 2.5,
  },
});
console.log(\`Predicted: \${prediction.value.toFixed(1)} Pa (conf: \${(prediction.confidence * 100).toFixed(0)}%)\`);

// Batch predictions
const batch = await client.inference.batchPredict({
  model: 'pressure_drop',
  featureSets: [1, 2, 3, 4, 5].map(v => ({ inletVelocity: v })),
});
batch.results.forEach(r =>
  console.log(\`  v=\${r.features.inletVelocity}  →  \${r.value.toFixed(1)} Pa\`)
);`;
      case "diagnostics":
        return `// ── AI Diagnostics ────────────────────────────────
const diagnosis = await client.diagnostics.diagnose({
  simulationId: sim.id,
  includeRecommendations: true,
});
diagnosis.issues.forEach(issue =>
  console.log(\`[\${issue.severity}] \${issue.title}: \${issue.description}\`)
);

// Auto-apply recommended fix
if (diagnosis.remediationPlan) {
  await client.diagnostics.executePlan(diagnosis.remediationPlan.id);
}`;
      case "features":
        return `// ── Feature Store ─────────────────────────────────
const features = await client.features.list({
  geometryCluster: 'server_rack',
  limit: 100,
});
console.log(\`Found \${features.length} feature vectors\`);

// Ingest new features from simulation
await client.features.ingest({
  simulationId: sim.id,
  featureVersion: 'v2',
});`;
      case "webhooks":
        return `// ── Webhooks ──────────────────────────────────────
const webhook = await client.webhooks.create({
  url: 'https://your-app.com/api/flowforge-webhook',
  events: ['simulation.completed', 'compliance.evaluated'],
  secret: 'whsec_...',
});
console.log(\`Webhook \${webhook.id} active on \${webhook.events.length} events\`);`;
      default:
        return "";
    }
  }).join("\n\n");

  return `/**
 * FlowForge SDK — JavaScript / TypeScript Client
 * Auto-generated for selected APIs. Install: npm install @flowforge/sdk
 */

import { FlowForgeClient } from '@flowforge/sdk';

// Initialize client
const client = new FlowForgeClient({ apiKey: 'ff_sk_...' });

${usage}
`;
}

function genGo(apis: string[]): string {
  const usage = apis.map((a) => {
    switch (a) {
      case "simulation":
        return `	// ── Simulation Engine ──────────────────────────────
	sim, err := client.Simulations.Create(ctx, &flowforge.CreateSimulationInput{
		Name: "Heat Exchanger Optimization",
		Mesh: flowforge.MeshConfig{BaseSize: 0.005, RefinementLevels: 3},
		Solver: flowforge.SolverConfig{Type: "steady", TurbulenceModel: "k-epsilon"},
		Boundaries: []flowforge.Boundary{
			{Name: "inlet", Type: "velocity_inlet", Velocity: flowforge.Vec3{X: 2.5}},
			{Name: "outlet", Type: "pressure_outlet", Pressure: 0},
		},
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Simulation %s — status: %s\\n", sim.ID, sim.Status)

	// Poll until complete
	result, err := client.Simulations.Wait(ctx, sim.ID, 3600*time.Second)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Pressure drop: %.1f Pa\\n", result.PressureDrop)`;
      case "compliance":
        return `	// ── Compliance Evaluation ──────────────────────────
	eval, err := client.Compliance.Evaluate(ctx, &flowforge.EvaluateInput{
		SimulationID: sim.ID,
		Standards:    []string{"ISO_14644_3", "ASHRAE_62_1"},
		Domain:       "cleanroom",
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Verdict: %s (score: %.1f)\\n", eval.Verdict, eval.Score)`;
      case "inference":
        return `	// ── ML Inference ──────────────────────────────────
	prediction, err := client.Inference.Predict(ctx, &flowforge.PredictInput{
		Model: "pressure_drop",
		Features: map[string]interface{}{
			"cellCount":       250000,
			"reynoldsNumber":  45000,
			"turbulenceModel": "k-epsilon",
			"inletVelocity":   2.5,
		},
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Predicted: %.1f Pa (conf: %.0f%%)\\n", prediction.Value, prediction.Confidence*100)`;
      case "diagnostics":
        return `	// ── AI Diagnostics ────────────────────────────────
	diagnosis, err := client.Diagnostics.Diagnose(ctx, &flowforge.DiagnoseInput{
		SimulationID:          sim.ID,
		IncludeRecommendations: true,
	})
	if err != nil {
		log.Fatal(err)
	}
	for _, issue := range diagnosis.Issues {
		fmt.Printf("[%s] %s: %s\\n", issue.Severity, issue.Title, issue.Description)
	}`;
      case "features":
        return `	// ── Feature Store ─────────────────────────────────
	features, err := client.Features.List(ctx, &flowforge.ListFeaturesInput{
		GeometryCluster: "server_rack",
		Limit:           100,
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Found %d feature vectors\\n", len(features))`;
      case "webhooks":
        return `	// ── Webhooks ──────────────────────────────────────
	webhook, err := client.Webhooks.Create(ctx, &flowforge.CreateWebhookInput{
		URL:    "https://your-app.com/api/flowforge-webhook",
		Events: []string{"simulation.completed", "compliance.evaluated"},
		Secret: "whsec_...",
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Webhook %s active on %d events\\n", webhook.ID, len(webhook.Events))`;
      default:
        return "";
    }
  }).join("\n\n");

  return `// FlowForge SDK — Go Client
// Auto-generated for selected APIs. Install: go get github.com/flowforge/flowforge-go

package main

import (
	"context"
	"fmt"
	"log"
	"time"

	flowforge "github.com/flowforge/flowforge-go"
)

func main() {
	ctx := context.Background()
	client := flowforge.NewClient("ff_sk_...")

${usage}
}
`;
}

const generators: Record<Lang, (apis: string[]) => string> = {
  python: genPython,
  javascript: genJavaScript,
  go: genGo,
};

/* ─── Components ─── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="icon" onClick={handleCopy} className="shrink-0">
      {copied ? <Check className="w-4 h-4 text-data-green" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
}

/* ─── Page ─── */

export default function SDKGenerator() {
  const [selectedAPIs, setSelectedAPIs] = useState<string[]>(["simulation", "inference"]);
  const [lang, setLang] = useState<Lang>("python");

  const toggleAPI = (id: string) => {
    setSelectedAPIs((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const code = generators[lang](selectedAPIs);
  const meta = LANG_META[lang];

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flowforge_client${meta.ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded flowforge_client${meta.ext}`);
  };

  return (
    <div className="flex h-screen bg-background dark">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs font-mono">SDK Generator</Badge>
            </div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Client Library Generator</h1>
            <p className="text-muted-foreground mt-1">
              Select your APIs and language to generate a ready-to-use client library with full type safety.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Left: Config */}
            <div className="col-span-4 space-y-6">
              {/* Language picker */}
              <Card className="border-surface-border bg-surface-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Language</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(Object.entries(LANG_META) as [Lang, typeof LANG_META[Lang]][]).map(([key, m]) => (
                    <button
                      key={key}
                      onClick={() => setLang(key)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-colors ${
                        lang === key
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-surface-border bg-surface-panel text-muted-foreground hover:bg-surface-overlay/50"
                      }`}
                    >
                      <span className="text-lg">{m.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{m.label}</div>
                        <code className="text-[11px] text-muted-foreground">{m.install}</code>
                      </div>
                      {lang === key && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* API selector */}
              <Card className="border-surface-border bg-surface-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">APIs to Include</CardTitle>
                  <CardDescription>Toggle the APIs you need in your client.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {APIS.map((api) => {
                    const Icon = api.icon;
                    const selected = selectedAPIs.includes(api.id);
                    return (
                      <div
                        key={api.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          selected
                            ? "border-primary/30 bg-primary/5"
                            : "border-surface-border"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground">{api.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {api.version} · {api.endpoints} endpoints
                          </div>
                        </div>
                        <Switch checked={selected} onCheckedChange={() => toggleAPI(api.id)} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Package info */}
              <Card className="border-surface-border bg-surface-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="w-4 h-4 text-data-cyan" /> Package Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Package</span>
                    <code className="text-foreground font-mono text-xs">{meta.pkg}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SDK Version</span>
                    <span className="text-foreground font-mono text-xs">3.2.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">APIs included</span>
                    <span className="text-foreground">{selectedAPIs.length} / {APIS.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Auth</span>
                    <span className="text-foreground">Bearer token</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Retries</span>
                    <span className="text-foreground">Exponential backoff</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Types</span>
                    <Badge variant="outline" className="text-[10px]">Full type safety</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Generated code */}
            <div className="col-span-8 space-y-4">
              {/* Install command */}
              <Card className="border-surface-border bg-surface-panel">
                <CardContent className="p-4 flex items-center gap-3">
                  <Terminal className="w-4 h-4 text-data-cyan shrink-0" />
                  <code className="flex-1 text-sm font-mono text-foreground">{meta.install}</code>
                  <CopyButton text={meta.install} />
                </CardContent>
              </Card>

              {/* Code output */}
              <Card className="border-surface-border bg-surface-panel">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="w-4 h-4 text-data-green" />
                    <CardTitle className="text-sm">
                      flowforge_client{meta.ext}
                    </CardTitle>
                    <Badge variant="secondary" className="text-[10px]">{selectedAPIs.length} APIs</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyButton text={code} />
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}>
                      <Download className="w-3.5 h-3.5" /> Download
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-background rounded-lg border border-surface-border p-4 overflow-x-auto text-[13px] font-mono leading-relaxed text-muted-foreground max-h-[600px] overflow-y-auto">
                      <code>{code}</code>
                    </pre>
                  </div>
                </CardContent>
              </Card>

              {/* Features grid */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Zap, title: "Auto-Retry", desc: "Exponential backoff with configurable max retries" },
                  { icon: Shield, title: "Type Safe", desc: "Full request/response types for IDE autocomplete" },
                  { icon: ArrowRight, title: "Streaming", desc: "Server-sent events for long-running operations" },
                ].map((f) => (
                  <Card key={f.title} className="border-surface-border bg-surface-panel">
                    <CardContent className="p-4">
                      <f.icon className="w-4 h-4 text-primary mb-2" />
                      <div className="text-sm font-medium text-foreground">{f.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{f.desc}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
