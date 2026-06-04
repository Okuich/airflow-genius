// Per-route SEO metadata. Centralized so every route gets unique title/description/canonical
// without having to edit every page component.
export interface RouteMeta {
  title: string;
  description: string;
  canonical: string;
}

export const ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "FlowForge — CFD Simulation & Compliance Platform",
    description: "Run HVAC, cleanroom, and data center CFD simulations with built-in regulatory compliance and AI diagnostics.",
    canonical: "/",
  },
  "/auth": {
    title: "Sign in — FlowForge",
    description: "Sign in to your FlowForge workspace to run simulations, review compliance, and manage GPU jobs.",
    canonical: "/auth",
  },
  "/trial": {
    title: "Start your 90-day trial — FlowForge",
    description: "Activate a 90-day trial of FlowForge with industry templates for HVAC, cleanroom, agriculture, and data center.",
    canonical: "/trial",
  },
  "/builder": {
    title: "Simulation Builder — FlowForge",
    description: "Configure mesh, fluid properties, boundary conditions, and solver settings for your next CFD run.",
    canonical: "/builder",
  },
  "/viewer": {
    title: "Results Viewer — FlowForge",
    description: "Visualize CFD results: velocity fields, pressure contours, streamlines, and residual convergence.",
    canonical: "/viewer",
  },
  "/compliance": {
    title: "Compliance Engine — FlowForge",
    description: "Evaluate simulations against ASHRAE, ISO 14644, OSHA, NFPA, and TIA 942 standards with AI risk scoring.",
    canonical: "/compliance",
  },
  "/ml-pipeline": {
    title: "ML Pipeline — FlowForge",
    description: "Train and deploy surrogate CFD models. Monitor training jobs, feature store, and model versions.",
    canonical: "/ml-pipeline",
  },
  "/explainability": {
    title: "Model Explainability — FlowForge",
    description: "Inspect surrogate model decisions: feature importance, confidence bands, and physics-residual diagnostics.",
    canonical: "/explainability",
  },
  "/solver-status": {
    title: "Solver Status — FlowForge",
    description: "Live convergence telemetry: residuals, iteration progress, and GPU utilization for active solver runs.",
    canonical: "/solver-status",
  },
  "/cleanroom": {
    title: "Cleanroom Metrics — FlowForge",
    description: "ISO 14644-1 classification, particle retention, air change rate, and laminar stability for cleanroom designs.",
    canonical: "/cleanroom",
  },
  "/datacenter": {
    title: "Data Center Heat Map — FlowForge",
    description: "Rack-inlet thermal map, PUE forecasting, and cooling topology optimization for data center workloads.",
    canonical: "/datacenter",
  },
  "/architecture": {
    title: "Platform Architecture — FlowForge",
    description: "Interactive map of FlowForge infrastructure: multi-region failover, GPU orchestration, and AI services.",
    canonical: "/architecture",
  },
  "/gpu-usage": {
    title: "GPU Usage & Telemetry — FlowForge",
    description: "Real-time GPU cluster telemetry: VRAM utilization, thermal envelopes, and job queue depth.",
    canonical: "/gpu-usage",
  },
  "/ip-tracking": {
    title: "IP Tracking — FlowForge",
    description: "Track invention disclosures, patent filings, and trade-secret status across the engineering organization.",
    canonical: "/ip-tracking",
  },
  "/billing": {
    title: "Billing & Subscription — FlowForge",
    description: "Manage your subscription tier, GPU/CPU hour allowances, overage rates, and invoices.",
    canonical: "/billing",
  },
  "/data-flywheel": {
    title: "Data Flywheel — FlowForge",
    description: "Surrogate model training progress: R² scores, cost savings, and accelerating accuracy from every new run.",
    canonical: "/data-flywheel",
  },
  "/api-marketplace": {
    title: "API Marketplace — FlowForge",
    description: "Discover and subscribe to CFD, compliance, and ML APIs published on the FlowForge platform.",
    canonical: "/api-marketplace",
  },
  "/developer-portal": {
    title: "Developer Portal — FlowForge",
    description: "Manage API keys, view usage, read reference docs, and download SDKs for FlowForge integrations.",
    canonical: "/developer-portal",
  },
  "/sdk-generator": {
    title: "SDK Generator — FlowForge",
    description: "Generate typed SDKs in TypeScript, Python, Go, and Java from the FlowForge OpenAPI spec.",
    canonical: "/sdk-generator",
  },
  "/api-playground": {
    title: "API Playground — FlowForge",
    description: "Send live requests to FlowForge endpoints, inspect responses, and prototype integrations interactively.",
    canonical: "/api-playground",
  },
  "/patent-portfolio": {
    title: "Patent Portfolio — FlowForge",
    description: "Centralized view of patent filings, status history, claim diagrams, and prosecution timelines.",
    canonical: "/patent-portfolio",
  },
  "/trade-secrets": {
    title: "Trade Secret Registry — FlowForge",
    description: "Owner-only registry of AES-256-GCM encrypted trade secrets with full access audit logging.",
    canonical: "/trade-secrets",
  },
};

export const NOT_FOUND_META: RouteMeta = {
  title: "Page not found — FlowForge",
  description: "The page you requested could not be found. Return to the FlowForge dashboard.",
  canonical: "/404",
};
