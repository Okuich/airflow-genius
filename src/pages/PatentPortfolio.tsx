import { useState, useMemo, useEffect, useCallback } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SEOHead } from "@/components/SEOHead";
import {
  Shield, FileText, Calendar, Clock, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Lightbulb, TrendingUp, Link2,
  BarChart3, Target, Layers, GitBranch, Filter, ArrowRight, History,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ───────────────────────────────────────────────────────────────

type FilingStatus = "draft" | "provisional_filed" | "full_filed" | "under_review" | "granted" | "abandoned";

interface Claim {
  id: string;
  type: "independent" | "dependent";
  summary: string;
  dependsOn?: string;
  noveltyScore: number; // 1-5
}

interface CrossReference {
  targetId: string;
  relationship: string;
}

interface PatentFiling {
  id: string;
  inventionNumber: string;
  disclosureId: string;
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
  claims: Claim[];
  sourceFiles: string[];
  notes: string;
  crossReferences: CrossReference[];
  subsystems: string[];
  primaryNovelty: string;
  defensiveValue: "high" | "medium" | "low";
  marketImpact: string;
}

interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  type: "invention" | "filing" | "milestone" | "deadline";
  relatedPatent?: string;
}

// ── Portfolio Data ──────────────────────────────────────────────────────

const PATENTS: PatentFiling[] = [
  {
    id: "ID-001",
    inventionNumber: "INV-001",
    disclosureId: "INVENTION-DISCLOSURE-001",
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
    claims: [
      { id: "1-1", type: "independent", summary: "5-phase autonomous diagnostic pipeline (intent → diagnostics → resolution → execution → learning)", noveltyScore: 5 },
      { id: "1-2", type: "independent", summary: "Persistent memory store for cross-session diagnostic learning", noveltyScore: 4 },
      { id: "1-3", type: "independent", summary: "Multi-channel residual root-cause heuristics with OLS log-slope analysis", noveltyScore: 4 },
      { id: "1-4", type: "dependent", summary: "Consecutive-window divergence confirmation for false-positive suppression", dependsOn: "1-3", noveltyScore: 3 },
      { id: "1-5", type: "dependent", summary: "Automatic remediation plan generation with solver parameter adjustments", dependsOn: "1-1", noveltyScore: 3 },
      { id: "1-6", type: "dependent", summary: "Mesh quality analysis integration for diagnostic context enrichment", dependsOn: "1-1", noveltyScore: 3 },
      { id: "1-7", type: "dependent", summary: "Event bus emission for downstream pipeline triggering", dependsOn: "1-1", noveltyScore: 2 },
    ],
    sourceFiles: [
      "src/modules/cfd/agent/cfd-ai-agent.ts",
      "src/modules/cfd/agent/memory-store.ts",
      "src/modules/cfd/diagnostics/convergence-engine.ts",
      "src/modules/cfd/diagnostics/residual-monitor.ts",
    ],
    notes: "Strongest patent candidate. Closed-loop autonomous agent that diagnoses AND executes fixes.",
    crossReferences: [
      { targetId: "ID-004", relationship: "Diagnostics agent may recommend priority elevation, triggering preemption via GPU scheduler" },
      { targetId: "ID-006", relationship: "Diagnostics agent triggers progressive mesh refinement when mesh-quality convergence failures detected" },
    ],
    subsystems: ["Intent Classifier", "Diagnostic Engine", "Resolution Planner", "Execution Engine", "Learning Store"],
    primaryNovelty: "Closed-loop autonomous agent that both diagnoses and executes CFD simulation fixes",
    defensiveValue: "high",
    marketImpact: "Eliminates manual debugging (typical 2-8 hours per failed simulation)",
  },
  {
    id: "ID-002",
    inventionNumber: "INV-002",
    disclosureId: "INVENTION-DISCLOSURE-002",
    title: "Automated Regulatory Compliance Pipeline for CFD Results with AI-Synchronized Knowledge Base",
    shortTitle: "Compliance Pipeline",
    status: "draft",
    inventors: [],
    filingDate: null,
    priorityDate: null,
    provisionalExpiry: null,
    estimatedCost: 13000,
    actualCost: 0,
    patentCounsel: "TBD",
    claims: [
      { id: "2-1", type: "independent", summary: "Inline compliance gating that blocks non-compliant results before production", noveltyScore: 5 },
      { id: "2-2", type: "independent", summary: "AI-synchronized regulatory knowledge base with delta analysis", noveltyScore: 4 },
      { id: "2-3", type: "independent", summary: "Cryptographic audit trail with SHA-256 integrity hashing", noveltyScore: 4 },
      { id: "2-4", type: "dependent", summary: "Historical risk trend analysis with repeat-violation detection", dependsOn: "2-1", noveltyScore: 3 },
      { id: "2-5", type: "dependent", summary: "Multi-standard mapping engine (ISO 14644, ASHRAE, FDA 21 CFR)", dependsOn: "2-1", noveltyScore: 3 },
      { id: "2-6", type: "dependent", summary: "Escalation multipliers for recurring violations", dependsOn: "2-4", noveltyScore: 3 },
      { id: "2-7", type: "dependent", summary: "Structured report generation with regulatory section templates", dependsOn: "2-3", noveltyScore: 2 },
      { id: "2-8", type: "dependent", summary: "Category-level risk breakdown with weighted scoring", dependsOn: "2-1", noveltyScore: 3 },
    ],
    sourceFiles: [
      "src/packages/compliance-engine/compliance-orchestrator.ts",
      "src/packages/compliance-engine/compliance-engine.ts",
      "src/packages/compliance-risk/compliance-risk-engine.ts",
      "src/packages/compliance-reporting/compliance-report-generator.ts",
      "src/packages/compliance-knowledge/sync-service.ts",
    ],
    notes: "Strong regulatory moat. SHA-256 integrity, AI-synced rule base, historical risk trends.",
    crossReferences: [
      { targetId: "ID-005", relationship: "ISO classification results from cleanroom anomaly detection feed directly into compliance evaluation" },
      { targetId: "ID-004", relationship: "Compliance-critical simulations submitted at Critical priority for timely evaluation" },
    ],
    subsystems: ["Rules Engine", "Standards Mapper", "Risk Scorer", "Knowledge Sync", "Audit Doc Generator", "Report Scheduler"],
    primaryNovelty: "Inline compliance gating integrated into CFD simulation workflow",
    defensiveValue: "high",
    marketImpact: "Automates compliance audits ($50K-$200K annual cost per enterprise client)",
  },
  {
    id: "ID-003",
    inventionNumber: "INV-003",
    disclosureId: "INVENTION-DISCLOSURE-003",
    title: "Progressive Surrogate Model Training Using Automated Feature Extraction and Geometry-Aware Clustering",
    shortTitle: "Surrogate Model Pipeline",
    status: "draft",
    inventors: [],
    filingDate: null,
    priorityDate: null,
    provisionalExpiry: null,
    estimatedCost: 11000,
    actualCost: 0,
    patentCounsel: "TBD",
    claims: [
      { id: "3-1", type: "independent", summary: "Automated 23-dimensional deterministic feature extraction from CFD results", noveltyScore: 4 },
      { id: "3-2", type: "independent", summary: "Geometry-aware clustering for specialized surrogate model training", noveltyScore: 5 },
      { id: "3-3", type: "independent", summary: "Progressive retraining triggered by production simulation volume", noveltyScore: 4 },
      { id: "3-4", type: "dependent", summary: "Data normalizer with per-feature statistics persistence", dependsOn: "3-1", noveltyScore: 3 },
      { id: "3-5", type: "dependent", summary: "Model registry with version tracking and active-model promotion", dependsOn: "3-3", noveltyScore: 3 },
      { id: "3-6", type: "dependent", summary: "Confidence scoring from training metrics (R², RMSE)", dependsOn: "3-2", noveltyScore: 3 },
    ],
    sourceFiles: [
      "src/modules/cfd/ml-models/feature-extractor.ts",
      "src/modules/cfd/ml-models/surrogate-model.ts",
      "src/modules/cfd/ml-models/surrogate-pipeline.ts",
      "src/modules/cfd/ml-models/model-registry.ts",
    ],
    notes: "Data flywheel: the more simulations run, the better the surrogate models become.",
    crossReferences: [
      { targetId: "ID-006", relationship: "Surrogate model confidence scores guide selective mesh refinement decisions" },
      { targetId: "ID-005", relationship: "Surrogate models provide instant particle dispersion predictions for real-time cleanroom analysis" },
    ],
    subsystems: ["Feature Extractor", "Data Normalizer", "OLS Trainer", "Model Registry", "Geometry Clusterer", "Retraining Trigger"],
    primaryNovelty: "Automated feature→cluster→train→deploy loop for CFD surrogate models",
    defensiveValue: "high",
    marketImpact: "10-100x inference speedup over full CFD solver for repeat geometries",
  },
  {
    id: "ID-004",
    inventionNumber: "INV-004",
    disclosureId: "INVENTION-DISCLOSURE-004",
    title: "Multi-Tenant GPU Job Scheduling with Priority-Weighted Fair-Share and CFD-Specific Resource Estimation",
    shortTitle: "GPU Job Scheduling",
    status: "draft",
    inventors: [],
    filingDate: null,
    priorityDate: null,
    provisionalExpiry: null,
    estimatedCost: 11500,
    actualCost: 0,
    patentCounsel: "TBD",
    claims: [
      { id: "4-1", type: "independent", summary: "Physics-aware CFD workload classification with automatic GPU/CPU/memory estimation", noveltyScore: 5 },
      { id: "4-2", type: "independent", summary: "Three-threshold tier-gated usage enforcement with graduated auto-actions", noveltyScore: 4 },
      { id: "4-3", type: "independent", summary: "Physics-aware resource estimation from cell count and simulation parameters", noveltyScore: 4 },
      { id: "4-4", type: "dependent", summary: "Non-destructive priority-gated preemption with automatic re-queuing", dependsOn: "4-1", noveltyScore: 4 },
      { id: "4-5", type: "dependent", summary: "Autoscaling hooks with deficit/surplus metrics for cloud provider integration", dependsOn: "4-1", noveltyScore: 3 },
      { id: "4-6", type: "dependent", summary: "Exceeded-level enforcement blocks new submissions while allowing running jobs to complete", dependsOn: "4-2", noveltyScore: 3 },
      { id: "4-7", type: "dependent", summary: "Transient flow CPU×2, memory×1.5, duration×2 complexity multipliers", dependsOn: "4-3", noveltyScore: 3 },
      { id: "4-8", type: "dependent", summary: "Stable priority sort with FIFO ordering for equal-priority jobs", dependsOn: "4-1", noveltyScore: 2 },
      { id: "4-9", type: "dependent", summary: "Per-job cost attribution metering CPU-hr, GPU-hr, memory-GB·hr at per-tier rates", dependsOn: "4-2", noveltyScore: 3 },
    ],
    sourceFiles: [
      "src/modules/cfd/compute/gpu-job-scheduler.ts",
      "src/modules/cfd/compute/compute-usage-service.ts",
      "src/pages/GpuUsage.tsx",
      "src/modules/pricing/pricing-engine.ts",
    ],
    notes: "Three-layer moat: CFD-specific classification + priority preemption + tier enforcement.",
    crossReferences: [
      { targetId: "ID-001", relationship: "Diagnostics agent may recommend priority elevation triggering preemption" },
      { targetId: "ID-002", relationship: "Compliance-critical simulations submitted at Critical priority" },
      { targetId: "ID-006", relationship: "Progressive mesh refinement jobs scheduled as multi-pass sequences" },
    ],
    subsystems: ["Workload Classifier", "Priority Queue", "Preemption Engine", "Usage Enforcer", "Autoscaler Hook", "Cost Meter"],
    primaryNovelty: "CFD physics-aware workload classification combined with multi-tenant priority scheduling",
    defensiveValue: "high",
    marketImpact: "30-40% reduction in over-provisioned GPU-hours through automatic estimation",
  },
  {
    id: "ID-005",
    inventionNumber: "INV-005",
    disclosureId: "INVENTION-DISCLOSURE-005",
    title: "Real-Time Cleanroom Anomaly Detection with ISO 14644 Classification and AI Root Cause Analysis",
    shortTitle: "Cleanroom Anomaly Detection",
    status: "draft",
    inventors: [],
    filingDate: null,
    priorityDate: null,
    provisionalExpiry: null,
    estimatedCost: 10000,
    actualCost: 0,
    patentCounsel: "TBD",
    claims: [
      { id: "5-1", type: "independent", summary: "Hybrid statistical–AI anomaly detection with z-score pre-filtering gate", noveltyScore: 5 },
      { id: "5-2", type: "independent", summary: "Multi-factor ISO 14644-1 classification with trend-adjusted penalty scoring", noveltyScore: 5 },
      { id: "5-3", type: "independent", summary: "CFD-informed contamination source localization via containment leak correlation", noveltyScore: 4 },
      { id: "5-4", type: "dependent", summary: "3-sample recency window for emerging anomaly detection", dependsOn: "5-1", noveltyScore: 3 },
      { id: "5-5", type: "dependent", summary: "Structured function calling with mandatory tool schema for AI output conformity", dependsOn: "5-1", noveltyScore: 3 },
      { id: "5-6", type: "dependent", summary: "Three-tier graceful degradation (rate limit → credit exhaustion → parse failure)", dependsOn: "5-1", noveltyScore: 3 },
      { id: "5-7", type: "dependent", summary: "Trend adjustment conditioned on both retention slope AND laminar stability", dependsOn: "5-2", noveltyScore: 3 },
      { id: "5-8", type: "dependent", summary: "168-sample sliding window with stale data eviction", dependsOn: "5-2", noveltyScore: 2 },
      { id: "5-9", type: "dependent", summary: "Bypass air fraction estimation from weighted containment integrity metrics", dependsOn: "5-3", noveltyScore: 3 },
      { id: "5-10", type: "dependent", summary: "Closed-loop monitoring-classification via AI ISO impact flags triggering reclassification", dependsOn: "5-1", noveltyScore: 4 },
    ],
    sourceFiles: [
      "src/modules/cfd/cleanroom/iso-classifier.ts",
      "src/modules/cfd/cleanroom/cleanroom-api-client.ts",
      "supabase/functions/cleanroom-anomaly/index.ts",
      "src/components/cleanroom/AnomalyAlertPanel.tsx",
      "src/modules/cfd/datacenter/containment-leak-detector.ts",
    ],
    notes: "Five-subsystem pipeline with layered defensive moat. Strong regulatory positioning (FDA 21 CFR Part 11).",
    crossReferences: [
      { targetId: "ID-001", relationship: "Diagnostics agent convergence analysis informs CFD particle dispersion model" },
      { targetId: "ID-002", relationship: "ISO classification results feed into compliance evaluation pipeline" },
      { targetId: "ID-003", relationship: "Surrogate models provide instant particle dispersion predictions" },
      { targetId: "ID-004", relationship: "Cleanroom CFD simulations scheduled via priority-weighted system" },
    ],
    subsystems: ["Telemetry Validator", "Statistical Pre-Filter", "AI Root Cause Analyzer", "ISO Classifier", "CFD Spatial Correlator"],
    primaryNovelty: "Closed-loop sensor→anomaly→AI→ISO→CFD pipeline for cleanroom monitoring",
    defensiveValue: "high",
    marketImpact: "Eliminates manual ISO classification audits (4-8 hours per zone per quarter)",
  },
  {
    id: "ID-006",
    inventionNumber: "INV-006",
    disclosureId: "INVENTION-DISCLOSURE-006",
    title: "ML-Guided Progressive Mesh Refinement with Surrogate Model Confidence-Based Adaptation",
    shortTitle: "ML Mesh Refinement",
    status: "draft",
    inventors: [],
    filingDate: null,
    priorityDate: null,
    provisionalExpiry: null,
    estimatedCost: 12500,
    actualCost: 0,
    patentCounsel: "TBD",
    claims: [
      { id: "6-1", type: "independent", summary: "Adaptive mesh refinement with triple termination (convergence + stalling + cell cap)", noveltyScore: 4 },
      { id: "6-2", type: "independent", summary: "Confidence-stratified ML-guided selective refinement (targeted/hybrid/gradient-only)", noveltyScore: 5 },
      { id: "6-3", type: "independent", summary: "Integrated Richardson extrapolation with asymptotic range checking in AMR loop", noveltyScore: 4 },
      { id: "6-4", type: "dependent", summary: "Solver residual channels as gradient proxy eliminating field export overhead", dependsOn: "6-1", noveltyScore: 4 },
      { id: "6-5", type: "dependent", summary: "Asymmetric minSize×0.8 reduction for boundary-layer preferential refinement", dependsOn: "6-1", noveltyScore: 3 },
      { id: "6-6", type: "dependent", summary: "0.25× coarse multiplier with N^(−1/3) physics-aware triple-parameter scaling", dependsOn: "6-1", noveltyScore: 3 },
      { id: "6-7", type: "dependent", summary: "23-dimensional feature vector from convergence/efficiency predictors for guidance", dependsOn: "6-2", noveltyScore: 3 },
      { id: "6-8", type: "dependent", summary: "Self-improving feedback loop: refinement generates surrogate training data", dependsOn: "6-2", noveltyScore: 5 },
      { id: "6-9", type: "dependent", summary: "Convergence order clamping [0.5, 5.0] with oscillatory fallback p=1", dependsOn: "6-3", noveltyScore: 2 },
      { id: "6-10", type: "dependent", summary: "√2 refinement ratio with F_s=1.25 per ASME V&V 20-2009", dependsOn: "6-3", noveltyScore: 2 },
      { id: "6-11", type: "dependent", summary: "Gradient-exclusion of surrogate-converged regions when confidence is high", dependsOn: "6-2", noveltyScore: 4 },
    ],
    sourceFiles: [
      "src/modules/cfd/solver/progressive-mesh-controller.ts",
      "src/modules/cfd/solver/mesh-refinement-study.ts",
      "src/modules/cfd/ml-models/surrogate-model.ts",
      "src/modules/cfd/diagnostics/mesh-quality-analyzer.ts",
      "src/modules/cfd/ml-models/feature-extractor.ts",
    ],
    notes: "Three-layer moat: ML-AMR integration + GCI-in-the-loop + self-improving feedback loop.",
    crossReferences: [
      { targetId: "ID-001", relationship: "Diagnostics agent triggers progressive refinement on mesh-quality failures" },
      { targetId: "ID-002", relationship: "Compliance-critical simulations flagged for re-study with tighter GCI thresholds" },
      { targetId: "ID-003", relationship: "Surrogate model confidence scores are the core ML component for guidance" },
      { targetId: "ID-004", relationship: "Multi-pass refinement jobs resource-estimated per refined cell count" },
      { targetId: "ID-005", relationship: "Cleanroom CFD simulations use progressive refinement for rapid grid independence" },
    ],
    subsystems: ["Coarse Initializer", "Solve-Refine Loop", "Gradient Identifier", "ML Confidence Router", "GCI Verifier"],
    primaryNovelty: "Surrogate model confidence scores guide WHERE and HOW MUCH to refine mesh",
    defensiveValue: "high",
    marketImpact: "40-70% compute cost reduction via targeted refinement and early termination",
  },
];

const TIMELINE: TimelineEvent[] = [
  { date: "2025-11-15", title: "AI Agent Core Architecture", description: "5-phase pipeline design completed", type: "invention", relatedPatent: "ID-001" },
  { date: "2025-12-01", title: "Convergence Diagnostic Engine", description: "OLS log-slope analysis with multi-channel heuristics", type: "invention", relatedPatent: "ID-001" },
  { date: "2025-12-20", title: "Compliance Orchestrator v1", description: "End-to-end rules → standards → risk → audit pipeline", type: "invention", relatedPatent: "ID-002" },
  { date: "2026-01-10", title: "Surrogate Pipeline v1", description: "Feature extraction + geometry clustering + retraining loop", type: "invention", relatedPatent: "ID-003" },
  { date: "2026-01-25", title: "AI Knowledge Base Sync", description: "Gemini-powered delta analysis for regulatory updates", type: "invention", relatedPatent: "ID-002" },
  { date: "2026-02-05", title: "GPU Job Scheduler", description: "Priority-weighted fair-share with preemption engine", type: "invention", relatedPatent: "ID-004" },
  { date: "2026-02-15", title: "ISO 14644-1 Classifier", description: "Trend-adjusted multi-factor classification engine", type: "invention", relatedPatent: "ID-005" },
  { date: "2026-02-28", title: "Progressive Mesh Controller", description: "Gradient-based AMR with triple termination", type: "invention", relatedPatent: "ID-006" },
  { date: "2026-03-07", title: "All 6 Disclosures Drafted", description: "Complete patent portfolio documentation", type: "filing" },
  { date: "2026-04-07", title: "Target: File Provisionals", description: "File provisional patents for ID-001 through ID-006", type: "deadline" },
  { date: "2026-06-01", title: "Target: Prior Art Search", description: "Complete prior art search for all 6 disclosures", type: "milestone" },
  { date: "2027-04-07", title: "Provisional Expiry", description: "Must convert to full utility applications", type: "deadline" },
];

// ── Helpers ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<FilingStatus, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  draft:              { label: "Draft",            bg: "bg-muted",                text: "text-muted-foreground", icon: FileText },
  provisional_filed:  { label: "Provisional",      bg: "bg-data-amber/15",       text: "text-data-amber",       icon: Clock },
  full_filed:         { label: "Full Application",  bg: "bg-data-cyan/15",        text: "text-data-cyan",        icon: FileText },
  under_review:       { label: "Under Review",      bg: "bg-data-violet/15",      text: "text-data-violet",      icon: Clock },
  granted:            { label: "Granted",            bg: "bg-data-emerald/15",     text: "text-data-emerald",     icon: CheckCircle2 },
  abandoned:          { label: "Abandoned",          bg: "bg-data-rose/15",        text: "text-data-rose",        icon: AlertTriangle },
};

const DEFENSE_COLORS = {
  high: "text-data-emerald",
  medium: "text-data-amber",
  low: "text-data-rose",
};

const MILESTONE_DOT: Record<TimelineEvent["type"], string> = {
  invention: "bg-primary",
  filing: "bg-data-amber",
  milestone: "bg-data-emerald",
  deadline: "bg-data-rose",
};

const MILESTONE_BORDER: Record<TimelineEvent["type"], string> = {
  invention: "border-primary/30 bg-primary/5",
  filing: "border-data-amber/30 bg-data-amber/5",
  milestone: "border-data-emerald/30 bg-data-emerald/5",
  deadline: "border-data-rose/30 bg-data-rose/5",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function noveltyStars(score: number) {
  return "●".repeat(score) + "○".repeat(5 - score);
}

// ── Filing Status Transitions ────────────────────────────────────────────

const STATUS_ORDER: FilingStatus[] = ["draft", "provisional_filed", "full_filed", "under_review", "granted"];

const ALLOWED_TRANSITIONS: Record<FilingStatus, FilingStatus[]> = {
  draft: ["provisional_filed", "abandoned"],
  provisional_filed: ["full_filed", "abandoned"],
  full_filed: ["under_review", "abandoned"],
  under_review: ["granted", "abandoned"],
  granted: [],
  abandoned: ["draft"],
};

interface StatusHistoryEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string;
  notes: string | null;
  changed_at: string;
}

function usePatentStatuses() {
  const [statuses, setStatuses] = useState<Record<string, FilingStatus>>({});
  const [histories, setHistories] = useState<Record<string, StatusHistoryEntry[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchStatuses = useCallback(async () => {
    const { data: filings } = await supabase
      .from("patent_filings")
      .select("invention_id, current_status, id");

    if (filings) {
      const map: Record<string, FilingStatus> = {};
      filings.forEach((f: any) => { map[f.invention_id] = f.current_status as FilingStatus; });
      setStatuses(map);

      // Fetch history for all filings
      const filingIds = filings.map((f: any) => f.id);
      if (filingIds.length > 0) {
        const { data: history } = await supabase
          .from("patent_status_history")
          .select("*")
          .in("filing_id", filingIds)
          .order("changed_at", { ascending: false });

        if (history) {
          const histMap: Record<string, StatusHistoryEntry[]> = {};
          for (const f of filings) {
            histMap[(f as any).invention_id] = (history as any[]).filter(
              (h: any) => h.filing_id === (f as any).id
            );
          }
          setHistories(histMap);
        }
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  const changeStatus = async (
    inventionId: string,
    inventionNumber: string,
    fromStatus: FilingStatus,
    toStatus: FilingStatus,
    notes: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be signed in to change filing status");
      return false;
    }

    // Upsert filing record
    const { data: filing, error: filingErr } = await supabase
      .from("patent_filings")
      .upsert(
        {
          invention_id: inventionId,
          invention_number: inventionNumber,
          current_status: toStatus,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "invention_id" }
      )
      .select("id")
      .single();

    if (filingErr || !filing) {
      toast.error("Failed to update status: " + (filingErr?.message ?? "Unknown error"));
      return false;
    }

    // Insert history
    const { error: histErr } = await supabase
      .from("patent_status_history")
      .insert({
        filing_id: filing.id,
        from_status: fromStatus,
        to_status: toStatus,
        changed_by: user.id,
        notes: notes || null,
      });

    if (histErr) {
      toast.error("Status updated but failed to log history: " + histErr.message);
    }

    toast.success(`Status changed to ${STATUS_CONFIG[toStatus].label}`);
    await fetchStatuses();
    return true;
  };

  return { statuses, histories, loading, changeStatus };
}

// ── Status Change Dialog ────────────────────────────────────────────────

function StatusChangeDialog({
  open,
  onOpenChange,
  patent,
  currentStatus,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patent: PatentFiling;
  currentStatus: FilingStatus;
  onConfirm: (toStatus: FilingStatus, notes: string) => Promise<boolean>;
}) {
  const [toStatus, setToStatus] = useState<FilingStatus | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const allowed = ALLOWED_TRANSITIONS[currentStatus];

  const handleSubmit = async () => {
    if (!toStatus) return;
    setSubmitting(true);
    const ok = await onConfirm(toStatus as FilingStatus, notes);
    setSubmitting(false);
    if (ok) {
      setToStatus("");
      setNotes("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Change Filing Status — {patent.shortTitle}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Current Status</p>
            <Badge className={`text-xs px-3 py-1 ${STATUS_CONFIG[currentStatus].bg} ${STATUS_CONFIG[currentStatus].text} border-0`}>
              {STATUS_CONFIG[currentStatus].label}
            </Badge>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">New Status</p>
            {allowed.length === 0 ? (
              <p className="text-xs text-muted-foreground">No transitions available from this status.</p>
            ) : (
              <Select value={toStatus} onValueChange={(v) => setToStatus(v as FilingStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select new status…" />
                </SelectTrigger>
                <SelectContent>
                  {allowed.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_CONFIG[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Notes (optional)</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for status change, filing details, counsel notes…"
              className="h-20 text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!toStatus || submitting}
          >
            {submitting ? "Updating…" : "Confirm Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Status History Panel ────────────────────────────────────────────────

function StatusHistoryPanel({ history }: { history: StatusHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No status changes recorded yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((h) => (
        <div key={h.id} className="flex items-start gap-3 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {h.from_status && (
                <>
                  <Badge className={`text-[9px] px-1.5 py-0 ${STATUS_CONFIG[h.from_status as FilingStatus]?.bg ?? "bg-muted"} ${STATUS_CONFIG[h.from_status as FilingStatus]?.text ?? "text-muted-foreground"} border-0`}>
                    {STATUS_CONFIG[h.from_status as FilingStatus]?.label ?? h.from_status}
                  </Badge>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                </>
              )}
              <Badge className={`text-[9px] px-1.5 py-0 ${STATUS_CONFIG[h.to_status as FilingStatus]?.bg ?? "bg-muted"} ${STATUS_CONFIG[h.to_status as FilingStatus]?.text ?? "text-muted-foreground"} border-0`}>
                {STATUS_CONFIG[h.to_status as FilingStatus]?.label ?? h.to_status}
              </Badge>
              <span className="text-[10px] font-mono text-muted-foreground">
                {new Date(h.changed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            {h.notes && <p className="text-muted-foreground mt-0.5">{h.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}



function SummaryCards() {
  const totalClaims = PATENTS.reduce((s, p) => s + p.claims.length, 0);
  const independentClaims = PATENTS.reduce((s, p) => s + p.claims.filter(c => c.type === "independent").length, 0);
  const totalBudget = PATENTS.reduce((s, p) => s + p.estimatedCost, 0);
  const totalSpent = PATENTS.reduce((s, p) => s + p.actualCost, 0);
  const totalSubsystems = PATENTS.reduce((s, p) => s + p.subsystems.length, 0);
  const totalCrossRefs = PATENTS.reduce((s, p) => s + p.crossReferences.length, 0);

  const nextDeadline = TIMELINE
    .filter(m => m.type === "deadline" && daysUntil(m.date) > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const cards = [
    { label: "Disclosures", value: PATENTS.length.toString(), sub: `${PATENTS.filter(p => p.status === "draft").length} in draft`, icon: Lightbulb },
    { label: "Total Claims", value: totalClaims.toString(), sub: `${independentClaims} independent`, icon: Target },
    { label: "Subsystems", value: totalSubsystems.toString(), sub: `${totalCrossRefs} cross-references`, icon: Layers },
    { label: "Est. Budget", value: `$${(totalBudget / 1000).toFixed(0)}K`, sub: `$${totalSpent.toLocaleString()} spent`, icon: BarChart3 },
    { label: "All High Defense", value: PATENTS.filter(p => p.defensiveValue === "high").length.toString(), sub: `of ${PATENTS.length} filings`, icon: Shield },
    { label: "Next Deadline", value: nextDeadline ? `${daysUntil(nextDeadline.date)}d` : "—", sub: nextDeadline?.title ?? "None", icon: Calendar },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => (
        <Card key={c.label} className="surface-raised border-surface-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
            </div>
            <p className="text-xl font-semibold text-foreground">{c.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Patent Detail Card ──────────────────────────────────────────────────

function PatentDetailCard({
  patent,
  currentStatus,
  history,
  onChangeStatus,
}: {
  patent: PatentFiling;
  currentStatus: FilingStatus;
  history: StatusHistoryEntry[];
  onChangeStatus: (patent: PatentFiling, currentStatus: FilingStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const cfg = STATUS_CONFIG[currentStatus];
  const StatusIcon = cfg.icon;
  const indClaims = patent.claims.filter(c => c.type === "independent").length;
  const depClaims = patent.claims.filter(c => c.type === "dependent").length;
  const hasTransitions = ALLOWED_TRANSITIONS[currentStatus].length > 0;

  return (
    <div className="surface-raised border border-surface-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-surface-overlay/30 transition-colors"
      >
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-xs font-bold text-primary">{patent.id.replace("ID-", "")}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono text-muted-foreground">{patent.inventionNumber}</span>
            <Badge className={`text-[10px] px-2 py-0 ${cfg.bg} ${cfg.text} border-0`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {cfg.label}
            </Badge>
            <Badge className={`text-[10px] px-2 py-0 border-0 ${DEFENSE_COLORS[patent.defensiveValue]} bg-current/10`}>
              {patent.defensiveValue} defense
            </Badge>
          </div>
          <h3 className="text-sm font-semibold text-foreground">{patent.shortTitle}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{patent.primaryNovelty}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0 mt-1">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-muted-foreground">{indClaims}+{depClaims} claims</p>
            <p className="text-[10px] text-muted-foreground">{patent.subsystems.length} subsystems</p>
          </div>
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-surface-border pt-4">
          {/* Status actions bar */}
          <div className="flex items-center gap-3 flex-wrap">
            {hasTransitions && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5 h-7"
                onClick={(e) => { e.stopPropagation(); onChangeStatus(patent, currentStatus); }}
              >
                <ArrowRight className="w-3 h-3" />
                Change Status
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-xs gap-1.5 h-7 text-muted-foreground"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="w-3 h-3" />
              Status History ({history.length})
            </Button>
          </div>

          {/* Status history (collapsible) */}
          {showHistory && (
            <div className="rounded-lg bg-surface-overlay/30 border border-surface-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Status History</p>
              <StatusHistoryPanel history={history} />
            </div>
          )}

          {/* Full title */}
          <p className="text-xs text-muted-foreground italic">{patent.title}</p>

          {/* Key metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Priority Date</p>
              <p className="text-sm text-foreground font-mono">{formatDate(patent.priorityDate)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Filing Date</p>
              <p className="text-sm text-foreground font-mono">{formatDate(patent.filingDate)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Est. Cost</p>
              <p className="text-sm text-foreground">${patent.estimatedCost.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Market Impact</p>
              <p className="text-xs text-foreground">{patent.marketImpact}</p>
            </div>
          </div>

          {/* Subsystems */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Subsystems</p>
            <div className="flex flex-wrap gap-1.5">
              {patent.subsystems.map(s => (
                <span key={s} className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-overlay text-muted-foreground border border-surface-border">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Claims */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Claims ({indClaims} independent · {depClaims} dependent)
            </p>
            <div className="space-y-1.5">
              {patent.claims.map(claim => (
                <div key={claim.id} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
                  claim.type === "independent" ? "bg-primary/5 border border-primary/10" : "bg-surface-overlay/50 border border-surface-border"
                }`}>
                  <span className="font-mono text-muted-foreground shrink-0 w-8">{claim.id}</span>
                  <span className="flex-1 text-foreground">{claim.summary}</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="text-[10px] font-mono text-data-amber shrink-0">{noveltyStars(claim.noveltyScore)}</span>
                    </TooltipTrigger>
                    <TooltipContent>Novelty: {claim.noveltyScore}/5</TooltipContent>
                  </Tooltip>
                  {claim.dependsOn && (
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">→{claim.dependsOn}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Cross-references */}
          {patent.crossReferences.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                <Link2 className="w-3 h-3 inline mr-1" />
                Cross-References
              </p>
              <div className="space-y-1.5">
                {patent.crossReferences.map((ref, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs bg-data-violet/5 border border-data-violet/10 rounded-lg px-3 py-2">
                    <span className="font-mono text-data-violet shrink-0">{ref.targetId}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{ref.relationship}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source files */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Key Source Files</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {patent.sourceFiles.map(f => (
                <span key={f} className="text-[10px] font-mono text-muted-foreground truncate flex items-center gap-1.5">
                  <FileText className="w-3 h-3 shrink-0" />{f}
                </span>
              ))}
            </div>
          </div>

          {/* Notes */}
          {patent.notes && (
            <div className="rounded-lg bg-data-cyan/5 border border-data-cyan/10 px-3 py-2">
              <p className="text-xs text-muted-foreground"><strong className="text-foreground">Note:</strong> {patent.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Cross-Reference Matrix ──────────────────────────────────────────────

function CrossReferenceMatrix() {
  const ids = PATENTS.map(p => p.id);

  return (
    <div className="surface-raised border border-surface-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-data-violet" />
        Cross-Reference Matrix
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left py-2 px-2 text-muted-foreground font-mono text-[10px]">From \ To</th>
              {ids.map(id => (
                <th key={id} className="text-center py-2 px-2 text-muted-foreground font-mono text-[10px]">{id.replace("ID-", "")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PATENTS.map(patent => (
              <tr key={patent.id} className="border-t border-surface-border">
                <td className="py-2 px-2 font-mono text-foreground text-[10px] font-semibold">{patent.id.replace("ID-", "")}</td>
                {ids.map(targetId => {
                  const isSelf = patent.id === targetId;
                  const hasRef = patent.crossReferences.some(r => r.targetId === targetId);
                  return (
                    <td key={targetId} className="text-center py-2 px-2">
                      {isSelf ? (
                        <span className="text-muted-foreground/30">—</span>
                      ) : hasRef ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="inline-block w-4 h-4 rounded bg-data-violet/20 text-data-violet text-[10px] leading-4">✓</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            {patent.crossReferences.find(r => r.targetId === targetId)?.relationship}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground/20">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground mt-3">
        {PATENTS.reduce((s, p) => s + p.crossReferences.length, 0)} total cross-references across {PATENTS.length} disclosures. Hover cells for relationship details.
      </p>
    </div>
  );
}

// ── Claim Coverage Chart ────────────────────────────────────────────────

function ClaimCoverageChart() {
  const maxClaims = Math.max(...PATENTS.map(p => p.claims.length));

  return (
    <div className="surface-raised border border-surface-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Target className="w-4 h-4 text-data-cyan" />
        Claim Coverage by Disclosure
      </h3>
      <div className="space-y-3">
        {PATENTS.map(patent => {
          const ind = patent.claims.filter(c => c.type === "independent").length;
          const dep = patent.claims.filter(c => c.type === "dependent").length;
          const avgNovelty = patent.claims.reduce((s, c) => s + c.noveltyScore, 0) / patent.claims.length;

          return (
            <div key={patent.id} className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-muted-foreground w-12 shrink-0">{patent.id}</span>
              <div className="flex-1 flex items-center gap-1">
                {/* Independent claims bars */}
                <div
                  className="h-5 rounded-l bg-primary/40 flex items-center justify-center"
                  style={{ width: `${(ind / maxClaims) * 100}%`, minWidth: ind > 0 ? 24 : 0 }}
                >
                  <span className="text-[9px] font-mono text-foreground">{ind}</span>
                </div>
                {/* Dependent claims bars */}
                <div
                  className="h-5 rounded-r bg-data-violet/30 flex items-center justify-center"
                  style={{ width: `${(dep / maxClaims) * 100}%`, minWidth: dep > 0 ? 24 : 0 }}
                >
                  <span className="text-[9px] font-mono text-foreground">{dep}</span>
                </div>
              </div>
              <span className="text-[10px] text-data-amber font-mono w-14 text-right shrink-0">
                {avgNovelty.toFixed(1)}★ avg
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary/40" /> Independent</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-data-violet/30" /> Dependent</span>
        <span className="flex items-center gap-1.5"><span className="text-data-amber">★</span> Avg Novelty (1-5)</span>
      </div>
    </div>
  );
}

// ── Timeline ────────────────────────────────────────────────────────────

function PortfolioTimeline({ filter }: { filter: string }) {
  const events = filter === "all"
    ? TIMELINE
    : TIMELINE.filter(e => e.type === filter);

  return (
    <div className="relative">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-surface-border" />
      <div className="space-y-3">
        {events.map((e, i) => {
          const isPast = new Date(e.date) <= new Date();
          return (
            <div key={i} className="relative flex gap-3 pl-6">
              <div className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-background ${MILESTONE_DOT[e.type]} ${!isPast ? "opacity-40" : ""}`} />
              <div className={`flex-1 rounded-lg border p-3 ${MILESTONE_BORDER[e.type]} ${!isPast ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-muted-foreground">{formatDate(e.date)}</span>
                  {e.relatedPatent && (
                    <Badge className="text-[9px] px-1.5 py-0 bg-surface-overlay text-muted-foreground border-surface-border">
                      {e.relatedPatent}
                    </Badge>
                  )}
                  {e.type === "deadline" && !isPast && (
                    <Badge className="text-[9px] px-1.5 py-0 bg-data-rose/15 text-data-rose border-0">
                      {daysUntil(e.date)}d
                    </Badge>
                  )}
                </div>
                <p className="text-xs font-semibold text-foreground">{e.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{e.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────

export default function PatentPortfolio() {
  const [timelineFilter, setTimelineFilter] = useState("all");
  const { statuses, histories, loading, changeStatus } = usePatentStatuses();
  const [statusDialog, setStatusDialog] = useState<{ patent: PatentFiling; currentStatus: FilingStatus } | null>(null);

  const getEffectiveStatus = (patent: PatentFiling): FilingStatus =>
    statuses[patent.id] ?? patent.status;

  const handleOpenStatusChange = (patent: PatentFiling, currentStatus: FilingStatus) => {
    setStatusDialog({ patent, currentStatus });
  };

  const handleConfirmStatusChange = async (toStatus: FilingStatus, notes: string) => {
    if (!statusDialog) return false;
    return changeStatus(
      statusDialog.patent.id,
      statusDialog.patent.inventionNumber,
      statusDialog.currentStatus,
      toStatus,
      notes
    );
  };

  return (
    <div className="flex h-screen bg-background dark">
      <SEOHead
        title="Patent Portfolio — FlowForge CFD"
        description="Track filing status, priority dates, claims coverage, and cross-references across all FlowForge invention disclosures."
      />
      <AppSidebar />

      <main className="flex-1 overflow-y-auto">
        <header className="border-b border-surface-border px-8 py-6">
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Patent Portfolio</h1>
            <Badge className="text-[10px] px-2 py-0 bg-data-emerald/15 text-data-emerald border-0">
              {PATENTS.length} Disclosures
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Filing status, claim coverage, cross-references, and innovation timeline across all invention disclosures.
          </p>
        </header>

        <div className="px-8 py-6 space-y-6 max-w-7xl">
          <SummaryCards />

          <Tabs defaultValue="portfolio" className="w-full">
            <TabsList className="surface-raised border border-surface-border">
              <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
              <TabsTrigger value="claims">Claims & Coverage</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            {/* ── Portfolio Tab ─────────────────────────────────────── */}
            <TabsContent value="portfolio" className="space-y-4 mt-4">
              {PATENTS.map(p => (
                <PatentDetailCard key={p.id} patent={p} />
              ))}
            </TabsContent>

            {/* ── Claims Tab ───────────────────────────────────────── */}
            <TabsContent value="claims" className="space-y-6 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ClaimCoverageChart />
                <CrossReferenceMatrix />
              </div>

              {/* Novelty heatmap */}
              <div className="surface-raised border border-surface-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-data-amber" />
                  High-Novelty Claims (Score ≥ 4)
                </h3>
                <div className="space-y-1.5">
                  {PATENTS.flatMap(p =>
                    p.claims
                      .filter(c => c.noveltyScore >= 4)
                      .map(c => ({ ...c, patentId: p.id, patentTitle: p.shortTitle }))
                  )
                    .sort((a, b) => b.noveltyScore - a.noveltyScore)
                    .map(claim => (
                      <div key={`${claim.patentId}-${claim.id}`} className="flex items-start gap-2 text-xs bg-data-amber/5 border border-data-amber/10 rounded-lg px-3 py-2">
                        <span className="font-mono text-data-amber shrink-0 w-12">{claim.patentId}</span>
                        <span className="font-mono text-muted-foreground shrink-0 w-8">{claim.id}</span>
                        <span className="flex-1 text-foreground">{claim.summary}</span>
                        <span className="text-[10px] font-mono text-data-amber shrink-0">{noveltyStars(claim.noveltyScore)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </TabsContent>

            {/* ── Timeline Tab ─────────────────────────────────────── */}
            <TabsContent value="timeline" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Innovation Timeline</h3>
                  </div>
                  <PortfolioTimeline filter={timelineFilter} />
                </div>

                <div className="space-y-4">
                  <div className="surface-raised border border-surface-border rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Filter className="w-3 h-3" /> Filter
                    </p>
                    <div className="space-y-1.5">
                      {[
                        { value: "all", label: "All Events", count: TIMELINE.length },
                        { value: "invention", label: "Inventions", count: TIMELINE.filter(e => e.type === "invention").length },
                        { value: "filing", label: "Filings", count: TIMELINE.filter(e => e.type === "filing").length },
                        { value: "milestone", label: "Milestones", count: TIMELINE.filter(e => e.type === "milestone").length },
                        { value: "deadline", label: "Deadlines", count: TIMELINE.filter(e => e.type === "deadline").length },
                      ].map(f => (
                        <button
                          key={f.value}
                          onClick={() => setTimelineFilter(f.value)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                            timelineFilter === f.value
                              ? "bg-primary/10 text-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-surface-overlay/50"
                          }`}
                        >
                          <span>{f.label}</span>
                          <span className="font-mono text-[10px]">{f.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Upcoming deadlines */}
                  <div className="surface-raised border border-surface-border rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-data-rose" /> Upcoming Deadlines
                    </p>
                    <div className="space-y-2">
                      {TIMELINE
                        .filter(e => e.type === "deadline" && daysUntil(e.date) > 0)
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((e, i) => (
                          <div key={i} className="text-xs">
                            <div className="flex justify-between">
                              <span className="text-foreground font-medium">{e.title}</span>
                              <span className="font-mono text-data-rose">{daysUntil(e.date)}d</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{formatDate(e.date)}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
