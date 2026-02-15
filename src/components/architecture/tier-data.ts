import {
  Globe, Shield, Network, Brain, Cpu, Database, HardDrive,
  Cloud, Workflow, BarChart3, Gauge, FileText, Lock,
  ServerCog, MonitorCog, KeyRound, GitBranch, Box, ShieldCheck,
} from "lucide-react";
import type { Tier, RegionConfig } from "./types";

export const REGIONS: RegionConfig[] = [
  { id: "primary", label: "Primary", location: "us-east-1", status: "active" },
  { id: "secondary", label: "Secondary", location: "eu-west-1", status: "syncing" },
  { id: "govcloud", label: "GovCloud", location: "us-gov-west-1", status: "active", isolated: true },
];

const PRIMARY_TIERS: Tier[] = [
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
  {
    id: "iac",
    label: "Infrastructure as Code",
    color: "data-cyan",
    nodes: [
      {
        id: "tf-networking",
        label: "networking",
        icon: Network,
        description: "Terraform module managing VPC, subnets, security groups, and cross-region peering.",
        status: "healthy",
        metrics: [
          { label: "Resources", value: "34" },
          { label: "Drift", value: "None" },
        ],
      },
      {
        id: "tf-compute",
        label: "compute",
        icon: ServerCog,
        description: "Auto-scaling compute instances with launch templates, target groups, and health checks.",
        status: "healthy",
        metrics: [
          { label: "Instances", value: "12" },
          { label: "AMI Age", value: "3d" },
        ],
      },
      {
        id: "tf-database",
        label: "database",
        icon: Database,
        description: "RDS/Aurora provisioning with automated backups, parameter groups, and read replicas.",
        status: "healthy",
        metrics: [
          { label: "Clusters", value: "2" },
          { label: "Backup RPO", value: "5 min" },
        ],
      },
      {
        id: "tf-gpu-pool",
        label: "gpu-pool",
        icon: Cpu,
        description: "GPU instance fleet with spot/on-demand mix, placement groups, and EFA networking.",
        status: "healthy",
        metrics: [
          { label: "Spot Ratio", value: "60%" },
          { label: "Cost/hr", value: "$4.12" },
        ],
      },
      {
        id: "tf-monitoring",
        label: "monitoring",
        icon: MonitorCog,
        description: "CloudWatch dashboards, alarms, log groups, and metric filters for all infrastructure tiers.",
        status: "healthy",
        metrics: [
          { label: "Alarms", value: "48" },
          { label: "Dashboards", value: "6" },
        ],
      },
    ],
  },
];

const SECONDARY_TIERS: Tier[] = PRIMARY_TIERS.map((tier) => ({
  ...tier,
  nodes: tier.nodes.map((node) => {
    const overrides: Record<string, Partial<typeof node>> = {
      lb: { metrics: [{ label: "Req/s", value: "1.2k" }, { label: "P99 Latency", value: "22ms" }, { label: "Mode", value: "Standby" }] },
      "gpu-pool": { status: "degraded" as const, metrics: [{ label: "GPUs Online", value: "4" }, { label: "Utilization", value: "12%" }, { label: "Mode", value: "Warm standby" }] },
      "ml-nodes": { status: "offline" as const, metrics: [{ label: "Nodes", value: "0" }, { label: "Mode", value: "Cold standby" }] },
      db: { metrics: [{ label: "Tables", value: "14" }, { label: "Replication Lag", value: "240ms" }, { label: "Mode", value: "Read replica" }] },
    };
    return { ...node, ...overrides[node.id] };
  }),
}));

const GOVCLOUD_TIERS: Tier[] = [
  {
    id: "gov-isolation",
    label: "Isolation Boundary (FedRAMP High)",
    color: "data-rose",
    nodes: [
      {
        id: "gov-boundary",
        label: "GovCloud Isolation Boundary",
        icon: ShieldCheck,
        description: "Air-gapped environment with no shared SaaS components. FedRAMP High + IL5 compliant perimeter.",
        status: "healthy",
        metrics: [
          { label: "Classification", value: "IL5" },
          { label: "FedRAMP", value: "High" },
          { label: "Shared Components", value: "0" },
        ],
      },
    ],
  },
  {
    id: "gov-cicd",
    label: "Dedicated CI/CD",
    color: "data-violet",
    nodes: [
      {
        id: "gov-pipeline",
        label: "Dedicated CI/CD Pipeline",
        icon: GitBranch,
        description: "Isolated build and deploy pipeline with STIG-hardened runners, air-gapped artifact registry, and SBOM generation.",
        status: "healthy",
        metrics: [
          { label: "Runners", value: "4" },
          { label: "Last Deploy", value: "1h ago" },
          { label: "SBOM", value: "Verified" },
        ],
      },
    ],
  },
  {
    id: "gov-security",
    label: "Dedicated Security",
    color: "data-amber",
    nodes: [
      {
        id: "gov-kms",
        label: "Dedicated KMS",
        icon: KeyRound,
        description: "FIPS 140-2 Level 3 HSM-backed key management. Customer-managed keys with automated rotation and audit.",
        status: "healthy",
        metrics: [
          { label: "FIPS Level", value: "L3" },
          { label: "Key Rotation", value: "90d" },
          { label: "Active Keys", value: "24" },
        ],
      },
      {
        id: "gov-monitoring",
        label: "Dedicated Monitoring",
        icon: MonitorCog,
        description: "Isolated SIEM and observability stack. No telemetry leaves the GovCloud boundary.",
        status: "healthy",
        metrics: [
          { label: "Log Retention", value: "7yr" },
          { label: "Alerts", value: "62" },
          { label: "Egress", value: "None" },
        ],
      },
    ],
  },
  {
    id: "gov-compute",
    label: "Dedicated Compute",
    color: "data-cyan",
    nodes: [
      {
        id: "gov-gpu",
        label: "Dedicated GPU Pool",
        icon: Cpu,
        description: "Isolated GPU fleet on dedicated hosts. No multi-tenant hardware. ITAR-compliant workload scheduling.",
        status: "healthy",
        metrics: [
          { label: "GPUs", value: "8" },
          { label: "Dedicated Hosts", value: "Yes" },
          { label: "Tenancy", value: "Single" },
        ],
      },
      {
        id: "gov-model-registry",
        label: "Dedicated Model Registry",
        icon: Box,
        description: "Air-gapped ML model storage with provenance tracking, vulnerability scanning, and export controls.",
        status: "healthy",
        metrics: [
          { label: "Models", value: "12" },
          { label: "Scanned", value: "100%" },
          { label: "Export Control", value: "ITAR" },
        ],
      },
    ],
  },
  {
    id: "gov-data",
    label: "Dedicated Data Layer",
    color: "data-emerald",
    nodes: [
      {
        id: "gov-db",
        label: "Dedicated Database",
        icon: Database,
        description: "Isolated PostgreSQL with encryption at rest (AES-256-GCM), dedicated VPC, and no cross-region replication.",
        status: "healthy",
        metrics: [
          { label: "Encryption", value: "AES-256" },
          { label: "Cross-Region", value: "Disabled" },
          { label: "Backup", value: "Hourly" },
        ],
      },
      {
        id: "gov-storage",
        label: "Dedicated Object Storage",
        icon: HardDrive,
        description: "FIPS-encrypted object storage with bucket-level access policies and data residency enforcement.",
        status: "healthy",
        metrics: [
          { label: "Residency", value: "US-only" },
          { label: "Encryption", value: "FIPS" },
          { label: "Size", value: "480 GB" },
        ],
      },
    ],
  },
];

export function getTiersForRegion(region: "primary" | "secondary" | "govcloud"): Tier[] {
  if (region === "govcloud") return GOVCLOUD_TIERS;
  return region === "primary" ? PRIMARY_TIERS : SECONDARY_TIERS;
}
