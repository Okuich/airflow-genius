import { useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SEOHead } from "@/components/SEOHead";
import {
  Shield, FileText, Calendar, Clock, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, ExternalLink, Lightbulb, TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

// ── Data ────────────────────────────────────────────────────────────────

type FilingStatus = "draft" | "provisional_filed" | "full_filed" | "under_review" | "granted" | "abandoned";

interface PatentFiling {
  id: string;
  inventionNumber: string;
  title: string;
  shortTitle: string;
  status: FilingStatus;
  inventors: string[];
  filingDate: string | null;
  priorityDate: string | null;
  provisionalExpiry: string | null;
  estimatedCost: number;
  actualCost: number;
  patentCounsel: string;
  claimsCount: { independent: number; dependent: number };
  sourceFiles: string[];
  notes: string;
}

interface InnovationMilestone {
  date: string;
  title: string;
  description: string;
  type: "invention" | "filing" | "milestone" | "deadline";
}

const PATENTS: PatentFiling[] = [
  {
    id: "inv-001",
    inventionNumber: "INV-001",
    title: "Autonomous AI Diagnostics Agent for CFD Simulations with Stateful Multi-Phase Pipeline and Persistent Memory",
    shortTitle: "AI Diagnostics Agent",
    status: "draft",
    inventors: [],
    filingDate: null,
    priorityDate: null,
    provisionalExpiry: null,
    estimatedCost: 12000,
    actualCost: 0,
    patentCounsel: "TBD",
    claimsCount: { independent: 3, dependent: 4 },
    sourceFiles: [
      "src/modules/cfd/agent/cfd-ai-agent.ts",
      "src/modules/cfd/agent/memory-store.ts",
      "src/modules/cfd/diagnostics/convergence-engine.ts",
      "src/modules/cfd/diagnostics/residual-monitor.ts",
    ],
    notes: "5-phase pipeline: intent classification → diagnostics → resolution planning → execution → learning. Strongest patent candidate.",
  },
  {
    id: "inv-002",
    inventionNumber: "INV-002",
    title: "Automated Regulatory Compliance Pipeline for CFD Results with AI-Synchronized Knowledge Base and Cryptographic Audit Reports",
    shortTitle: "Compliance Pipeline",
    status: "draft",
    inventors: [],
    filingDate: null,
    priorityDate: null,
    provisionalExpiry: null,
    estimatedCost: 13000,
    actualCost: 0,
    patentCounsel: "TBD",
    claimsCount: { independent: 3, dependent: 5 },
    sourceFiles: [
      "src/packages/compliance-engine/compliance-orchestrator.ts",
      "src/packages/compliance-engine/compliance-engine.ts",
      "src/packages/compliance-risk/compliance-risk-engine.ts",
      "src/packages/compliance-reporting/compliance-report-generator.ts",
      "src/packages/compliance-knowledge/sync-service.ts",
    ],
    notes: "SHA-256 integrity hashing, AI-synced rule base, historical risk trend analysis. Strong regulatory moat.",
  },
  {
    id: "inv-003",
    inventionNumber: "INV-003",
    title: "Real-Time Cleanroom Anomaly Detection with ISO 14644 Classification and AI Root-Cause Analysis",
    shortTitle: "Cleanroom Anomaly Detection",
    status: "draft",
    inventors: [],
    filingDate: null,
    priorityDate: null,
    provisionalExpiry: null,
    estimatedCost: 10000,
    actualCost: 0,
    patentCounsel: "TBD",
    claimsCount: { independent: 2, dependent: 3 },
    sourceFiles: [
      "src/modules/cfd/cleanroom/iso-classifier.ts",
      "src/components/cleanroom/AnomalyAlertPanel.tsx",
    ],
    notes: "Candidate for provisional filing. Niche enough to defend.",
  },
];

const MILESTONES: InnovationMilestone[] = [
  { date: "2025-11-15", title: "AI Agent Core Architecture", description: "5-phase pipeline design completed and implemented", type: "invention" },
  { date: "2025-12-01", title: "Convergence Diagnostic Engine", description: "OLS log-slope analysis with multi-channel root-cause heuristics", type: "invention" },
  { date: "2025-12-20", title: "Compliance Orchestrator v1", description: "End-to-end pipeline: rules → standards → risk → audit doc", type: "invention" },
  { date: "2026-01-10", title: "Real-Time Residual Monitor", description: "Streaming analysis with consecutive-window divergence confirmation", type: "invention" },
  { date: "2026-01-25", title: "AI Knowledge Base Sync", description: "Gemini-powered delta analysis for regulatory standard updates", type: "invention" },
  { date: "2026-02-15", title: "SHA-256 Report Integrity", description: "Cryptographically-verifiable compliance reports with digital signatures", type: "invention" },
  { date: "2026-02-28", title: "Risk Engine v2 with Historical Trends", description: "Repeat-violation detection, escalation multipliers, category breakdown", type: "invention" },
  { date: "2026-03-07", title: "Patent Disclosure Documents Generated", description: "INV-001 and INV-002 disclosure docs completed", type: "filing" },
  { date: "2026-04-07", title: "Target: File Provisionals", description: "File provisional patents for INV-001 and INV-002", type: "deadline" },
  { date: "2027-04-07", title: "Provisional Expiry (if filed Apr 2026)", description: "Must convert to full utility patent applications", type: "deadline" },
];

// ── Helpers ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<FilingStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  provisional_filed: { label: "Provisional Filed", color: "bg-amber-500/20 text-amber-400", icon: Clock },
  full_filed: { label: "Full Application", color: "bg-blue-500/20 text-blue-400", icon: FileText },
  under_review: { label: "Under Review", color: "bg-purple-500/20 text-purple-400", icon: Clock },
  granted: { label: "Granted", color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle2 },
  abandoned: { label: "Abandoned", color: "bg-destructive/20 text-destructive", icon: AlertTriangle },
};

const MILESTONE_COLORS: Record<InnovationMilestone["type"], string> = {
  invention: "border-primary bg-primary/10",
  filing: "border-amber-500 bg-amber-500/10",
  milestone: "border-emerald-500 bg-emerald-500/10",
  deadline: "border-destructive bg-destructive/10",
};

const MILESTONE_DOT: Record<InnovationMilestone["type"], string> = {
  invention: "bg-primary",
  filing: "bg-amber-500",
  milestone: "bg-emerald-500",
  deadline: "bg-destructive",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(d: string) {
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── Components ──────────────────────────────────────────────────────────

function PatentCard({ patent }: { patent: PatentFiling }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[patent.status];
  const StatusIcon = cfg.icon;
  const costProgress = patent.estimatedCost > 0 ? (patent.actualCost / patent.estimatedCost) * 100 : 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">{patent.inventionNumber}</span>
              <Badge className={`text-[10px] px-2 py-0 ${cfg.color} border-0`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {cfg.label}
              </Badge>
            </div>
            <CardTitle className="text-sm font-medium text-foreground leading-snug">
              {patent.shortTitle}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{patent.title}</p>
          </div>
          <button className="text-muted-foreground hover:text-foreground mt-1">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          <Separator />

          {/* Claims */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Claims</p>
              <p className="text-sm text-foreground">
                {patent.claimsCount.independent} independent · {patent.claimsCount.dependent} dependent
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Patent Counsel</p>
              <p className="text-sm text-foreground">{patent.patentCounsel}</p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Priority Date</p>
              <p className="text-sm text-foreground">{formatDate(patent.priorityDate)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Filing Date</p>
              <p className="text-sm text-foreground">{formatDate(patent.filingDate)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Provisional Expiry</p>
              <p className="text-sm text-foreground">{formatDate(patent.provisionalExpiry)}</p>
            </div>
          </div>

          {/* Cost */}
          <div>
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              <span>Cost</span>
              <span>${patent.actualCost.toLocaleString()} / ${patent.estimatedCost.toLocaleString()}</span>
            </div>
            <Progress value={costProgress} className="h-1.5" />
          </div>

          {/* Source files */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Key Source Files</p>
            <div className="space-y-1">
              {patent.sourceFiles.map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="truncate">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {patent.notes && (
            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <p className="text-xs text-muted-foreground">{patent.notes}</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function IPTracking() {
  const totalEstimated = PATENTS.reduce((s, p) => s + p.estimatedCost, 0);
  const totalSpent = PATENTS.reduce((s, p) => s + p.actualCost, 0);
  const totalClaims = PATENTS.reduce((s, p) => s + p.claimsCount.independent + p.claimsCount.dependent, 0);

  const nextDeadline = MILESTONES.filter((m) => m.type === "deadline" && daysUntil(m.date) > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  return (
    <div className="flex h-screen bg-background dark">
      <SEOHead
        title="IP & Patents — FlowForge CFD"
        description="Track patent filings, innovation milestones, and intellectual property for FlowForge CFD."
      />
      <AppSidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="border-b border-border px-8 py-6">
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Intellectual Property</h1>
          </div>
          <p className="text-sm text-muted-foreground">Track patent filings, innovation milestones, and IP portfolio value.</p>
        </header>

        <div className="px-8 py-6 space-y-8 max-w-6xl">

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4 px-5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Inventions</p>
                <p className="text-2xl font-semibold text-foreground">{PATENTS.length}</p>
                <p className="text-xs text-muted-foreground mt-1">{PATENTS.filter((p) => p.status === "draft").length} in draft</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4 px-5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total Claims</p>
                <p className="text-2xl font-semibold text-foreground">{totalClaims}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {PATENTS.reduce((s, p) => s + p.claimsCount.independent, 0)} independent
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4 px-5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Budget</p>
                <p className="text-2xl font-semibold text-foreground">${totalEstimated.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">${totalSpent.toLocaleString()} spent</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-5 pb-4 px-5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Next Deadline</p>
                {nextDeadline ? (
                  <>
                    <p className="text-2xl font-semibold text-foreground">{daysUntil(nextDeadline.date)}d</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{nextDeadline.title}</p>
                  </>
                ) : (
                  <p className="text-2xl font-semibold text-muted-foreground">—</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Two-column: Patents + Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

            {/* Patents (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Patent Portfolio</h2>
              </div>
              {PATENTS.map((p) => (
                <PatentCard key={p.id} patent={p} />
              ))}
            </div>

            {/* Timeline (2 cols) */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Innovation Timeline</h2>
              </div>

              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

                <div className="space-y-4">
                  {MILESTONES.map((m, i) => {
                    const isPast = new Date(m.date) <= new Date();
                    return (
                      <div key={i} className="relative flex gap-4 pl-6">
                        {/* Dot */}
                        <div
                          className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-background ${MILESTONE_DOT[m.type]} ${
                            !isPast ? "opacity-50" : ""
                          }`}
                        />

                        <div
                          className={`flex-1 rounded-lg border p-3 ${MILESTONE_COLORS[m.type]} ${
                            !isPast ? "opacity-60" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {formatDate(m.date)}
                            </span>
                            {m.type === "deadline" && isPast && daysUntil(m.date) < 0 && (
                              <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Overdue</Badge>
                            )}
                            {m.type === "deadline" && !isPast && (
                              <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/20 text-amber-400 border-0">
                                {daysUntil(m.date)}d
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs font-medium text-foreground">{m.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{m.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Valuation impact */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Estimated Valuation Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="rounded-lg bg-muted/20 border border-border p-4 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">No Patents</p>
                  <p className="text-lg font-semibold text-muted-foreground">5–8× ARR</p>
                  <p className="text-xs text-muted-foreground mt-1">$10–16M at $2M ARR</p>
                </div>
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-primary mb-1">Provisionals Filed</p>
                  <p className="text-lg font-semibold text-foreground">5.5–9× ARR</p>
                  <p className="text-xs text-muted-foreground mt-1">$11–18M at $2M ARR</p>
                </div>
                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">Utility Patents Granted</p>
                  <p className="text-lg font-semibold text-foreground">6–10× ARR</p>
                  <p className="text-xs text-muted-foreground mt-1">$12–20M at $2M ARR</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
