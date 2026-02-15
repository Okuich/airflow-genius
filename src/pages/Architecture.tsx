import { useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import {
  Globe, Shield, Network, Brain, Cpu, Database, HardDrive,
  Server, Cloud, Workflow, BarChart3, Gauge, FileText, Lock,
  ChevronRight, Activity
} from "lucide-react";

// ── Tier Definitions ────────────────────────────────────────────────────────

interface ServiceNode {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  status: "healthy" | "degraded" | "offline";
  metrics?: { label: string; value: string }[];
}

interface Tier {
  id: string;
  label: string;
  color: string; // tailwind token
  nodes: ServiceNode[];
}

const TIERS: Tier[] = [
  {
    id: "edge",
    label: "Edge Layer",
    color: "data-cyan",
    nodes: [
      {
        id: "lb",
        label: "Regional Load Balancer",
        icon: Globe,
        description: "Distributes traffic across availability zones with health-check failover and geo-routing.",
        status: "healthy",
        metrics: [
          { label: "Req/s", value: "12.4k" },
          { label: "P99 Latency", value: "18ms" },
          { label: "Active Regions", value: "3" },
        ],
      },
    ],
  },
  {
    id: "gateway",
    label: "Gateway Layer",
    color: "data-emerald",
    nodes: [
      {
        id: "api-gw",
        label: "API Gateway",
        icon: Network,
        description: "Rate limiting, JWT validation, request routing, and OpenAPI schema enforcement.",
        status: "healthy",
        metrics: [
          { label: "Routes", value: "47" },
          { label: "Rate Limit", value: "1k/min" },
          { label: "Cache Hit", value: "82%" },
        ],
      },
      {
        id: "cdn",
        label: "Web Frontend (CDN edge)",
        icon: Cloud,
        description: "Static assets served from 42 global PoPs with Brotli compression and immutable caching.",
        status: "healthy",
        metrics: [
          { label: "PoPs", value: "42" },
          { label: "Cache Hit", value: "97.3%" },
          { label: "TTFB", value: "24ms" },
        ],
      },
    ],
  },
  {
    id: "services",
    label: "Application Services",
    color: "data-violet",
    nodes: [
      {
        id: "auth",
        label: "Auth Service",
        icon: Lock,
        description: "RBAC-enforced authentication with JWT, MFA, and organization-scoped sessions.",
        status: "healthy",
        metrics: [
          { label: "Active Sessions", value: "1,247" },
          { label: "MFA Enrolled", value: "68%" },
        ],
      },
      {
        id: "compliance",
        label: "Compliance Engine",
        icon: Shield,
        description: "Real-time ASHRAE/ISO/OSHA evaluation with risk scoring and audit trail.",
        status: "healthy",
        metrics: [
          { label: "Rules Active", value: "312" },
          { label: "Last Scan", value: "2m ago" },
          { label: "Compliance", value: "94.2%" },
        ],
      },
      {
        id: "ai-agent",
        label: "AI Agent Service",
        icon: Brain,
        description: "Autonomous CFD diagnostic agent with structured tool-calling and streaming responses.",
        status: "healthy",
        metrics: [
          { label: "Resolution Rate", value: "96.1%" },
          { label: "Avg Response", value: "1.8s" },
        ],
      },
      {
        id: "cfd-orch",
        label: "CFD Orchestration",
        icon: Workflow,
        description: "Pipeline management for simulation lifecycle: mesh → solve → post-process → report.",
        status: "healthy",
        metrics: [
          { label: "Active Pipelines", value: "8" },
          { label: "Queue Depth", value: "3" },
        ],
      },
      {
        id: "benchmark",
        label: "Benchmark Engine",
        icon: BarChart3,
        description: "Automated performance benchmarking against reference cases with regression detection.",
        status: "healthy",
        metrics: [
          { label: "Test Suite", value: "24 cases" },
          { label: "Last Run", value: "4h ago" },
        ],
      },
    ],
  },
  {
    id: "compute",
    label: "Compute Layer",
    color: "data-amber",
    nodes: [
      {
        id: "gpu-pool",
        label: "GPU Compute Pool",
        icon: Cpu,
        description: "Auto-scaling GPU cluster for CFD solver execution with spot instance optimization.",
        status: "healthy",
        metrics: [
          { label: "GPUs Online", value: "16" },
          { label: "Utilization", value: "73%" },
          { label: "Queue Wait", value: "< 30s" },
        ],
      },
      {
        id: "ml-nodes",
        label: "ML Training Node Pool",
        icon: Gauge,
        description: "Dedicated training nodes for surrogate model training with checkpointing.",
        status: "healthy",
        metrics: [
          { label: "Nodes", value: "4" },
          { label: "Active Jobs", value: "2" },
          { label: "Epoch/hr", value: "142" },
        ],
      },
    ],
  },
  {
    id: "data",
    label: "Data Layer",
    color: "data-rose",
    nodes: [
      {
        id: "db",
        label: "Regional Database",
        icon: Database,
        description: "PostgreSQL with RLS, row-level multi-tenancy, point-in-time recovery, and read replicas.",
        status: "healthy",
        metrics: [
          { label: "Tables", value: "14" },
          { label: "RLS Policies", value: "42" },
          { label: "Connections", value: "127" },
        ],
      },
      {
        id: "storage",
        label: "Object Storage",
        icon: HardDrive,
        description: "Simulation results, mesh files, and ML model artifacts with lifecycle policies.",
        status: "healthy",
        metrics: [
          { label: "Objects", value: "18.4k" },
          { label: "Total Size", value: "2.1 TB" },
        ],
      },
      {
        id: "audit",
        label: "Audit Log Storage",
        icon: FileText,
        description: "Immutable, append-only audit log with 7-year retention for regulatory compliance.",
        status: "healthy",
        metrics: [
          { label: "Events/day", value: "34k" },
          { label: "Retention", value: "7 years" },
        ],
      },
    ],
  },
];

// ── Status Indicator ────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ServiceNode["status"] }) {
  const colors: Record<ServiceNode["status"], string> = {
    healthy: "bg-[hsl(var(--data-emerald))]",
    degraded: "bg-[hsl(var(--data-amber))]",
    offline: "bg-[hsl(var(--data-rose))]",
  };
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === "healthy" && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${colors[status]}`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${colors[status]}`} />
    </span>
  );
}

// ── Node Card ───────────────────────────────────────────────────────────────

function NodeCard({
  node,
  tierColor,
  isSelected,
  onClick,
}: {
  node: ServiceNode;
  tierColor: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = node.icon;
  return (
    <button
      onClick={onClick}
      className={`group relative w-full text-left rounded-xl border transition-all duration-200 ${
        isSelected
          ? "bg-surface-overlay border-[hsl(var(--" + tierColor + "))] shadow-lg shadow-[hsl(var(--" + tierColor + ")/0.1)]"
          : "bg-surface-raised border-surface-border hover:border-[hsl(var(--" + tierColor + "))/50] hover:bg-surface-overlay/60"
      }`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `hsl(var(--${tierColor}) / 0.15)` }}
            >
              <Icon className="w-4 h-4" style={{ color: `hsl(var(--${tierColor}))` }} />
            </div>
            <span className="text-sm font-medium text-foreground">{node.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot status={node.status} />
            <ChevronRight
              className={`w-4 h-4 text-muted-foreground transition-transform ${
                isSelected ? "rotate-90" : "group-hover:translate-x-0.5"
              }`}
            />
          </div>
        </div>

        {isSelected && (
          <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-xs text-muted-foreground leading-relaxed">{node.description}</p>
            {node.metrics && (
              <div className="grid grid-cols-2 gap-2">
                {node.metrics.map((m) => (
                  <div key={m.label} className="rounded-lg bg-surface/60 border border-surface-border px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</div>
                    <div
                      className="text-sm font-semibold font-mono mt-0.5"
                      style={{ color: `hsl(var(--${tierColor}))` }}
                    >
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

// ── Connection Lines ────────────────────────────────────────────────────────

function ConnectionLine({ color }: { color: string }) {
  return (
    <div className="flex justify-center py-1">
      <div className="relative w-px h-6">
        <div className="absolute inset-0 w-px" style={{ backgroundColor: `hsl(var(--${color}) / 0.3)` }} />
        <div
          className="absolute w-1.5 h-1.5 rounded-full -bottom-0.5 -left-[2.5px] animate-pulse"
          style={{ backgroundColor: `hsl(var(--${color}))` }}
        />
      </div>
    </div>
  );
}

// ── Tier Section ────────────────────────────────────────────────────────────

function TierSection({
  tier,
  selectedNode,
  onSelectNode,
  isLast,
}: {
  tier: Tier;
  selectedNode: string | null;
  onSelectNode: (id: string) => void;
  isLast: boolean;
}) {
  return (
    <div>
      {/* Tier Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="h-px flex-1"
          style={{ backgroundImage: `linear-gradient(to right, transparent, hsl(var(--${tier.color}) / 0.3), transparent)` }}
        />
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.15em] font-mono px-3 py-1 rounded-full border"
          style={{
            color: `hsl(var(--${tier.color}))`,
            borderColor: `hsl(var(--${tier.color}) / 0.25)`,
            backgroundColor: `hsl(var(--${tier.color}) / 0.08)`,
          }}
        >
          {tier.label}
        </span>
        <div
          className="h-px flex-1"
          style={{ backgroundImage: `linear-gradient(to right, transparent, hsl(var(--${tier.color}) / 0.3), transparent)` }}
        />
      </div>

      {/* Nodes Grid */}
      <div className={`grid gap-3 ${tier.nodes.length === 1 ? "grid-cols-1 max-w-lg mx-auto" : tier.nodes.length <= 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {tier.nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            tierColor={tier.color}
            isSelected={selectedNode === node.id}
            onClick={() => onSelectNode(node.id)}
          />
        ))}
      </div>

      {/* Connection to next tier */}
      {!isLast && <ConnectionLine color={tier.color} />}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Architecture() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelectedNode((prev) => (prev === id ? null : id));
  };

  const allHealthy = TIERS.every((t) => t.nodes.every((n) => n.status === "healthy"));
  const totalServices = TIERS.reduce((acc, t) => acc + t.nodes.length, 0);

  return (
    <div className="flex h-screen bg-surface dark">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 backdrop-blur-xl bg-surface/80 border-b border-surface-border">
          <div className="px-8 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">
                System Architecture
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                FlowForge CFD infrastructure topology
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="w-3.5 h-3.5" />
                <span>{totalServices} services</span>
              </div>
              <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${
                allHealthy
                  ? "text-[hsl(var(--data-emerald))] border-[hsl(var(--data-emerald)/0.3)] bg-[hsl(var(--data-emerald)/0.08)]"
                  : "text-[hsl(var(--data-amber))] border-[hsl(var(--data-amber)/0.3)] bg-[hsl(var(--data-amber)/0.08)]"
              }`}>
                <StatusDot status={allHealthy ? "healthy" : "degraded"} />
                {allHealthy ? "All Systems Operational" : "Degraded"}
              </div>
            </div>
          </div>
        </header>

        {/* Architecture Diagram */}
        <div className="px-8 py-8 max-w-4xl mx-auto space-y-1">
          {TIERS.map((tier, i) => (
            <TierSection
              key={tier.id}
              tier={tier}
              selectedNode={selectedNode}
              onSelectNode={handleSelect}
              isLast={i === TIERS.length - 1}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
