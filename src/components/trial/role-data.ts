import {
  Zap, Brain, ShieldCheck, BarChart3, Thermometer, Wind,
  Factory, Server, Beaker, Settings, LineChart, type LucideIcon,
} from "lucide-react";

export interface RoleProfile {
  id: string;
  label: string;
  headline: string;
  description: string;
  icon: LucideIcon;
  benefits: { icon: LucideIcon; title: string; desc: string }[];
}

export const ROLE_PROFILES: RoleProfile[] = [
  {
    id: "cfd-engineer",
    label: "CFD Engineer",
    headline: "Accelerate every simulation run",
    description: "GPU-accelerated solvers, automated mesh refinement, and AI-powered convergence diagnostics.",
    icon: Wind,
    benefits: [
      { icon: Zap, title: "GPU-Accelerated Solver", desc: "Run on NVIDIA A100 clusters with automatic scaling." },
      { icon: LineChart, title: "Convergence Diagnostics", desc: "Real-time residual tracking and automatic divergence alerts." },
      { icon: Brain, title: "AI Mesh Advisor", desc: "Get smart recommendations for mesh refinement regions." },
      { icon: Settings, title: "Solver Presets", desc: "SIMPLE, SIMPLEC, PISO — pre-tuned for HVAC geometries." },
    ],
  },
  {
    id: "engineering-manager",
    label: "Engineering Manager",
    headline: "Full visibility, zero bottlenecks",
    description: "Track team compute usage, simulation throughput, and compliance status from a single dashboard.",
    icon: BarChart3,
    benefits: [
      { icon: BarChart3, title: "Team Analytics", desc: "GPU hours, job queue depth, and cost tracking per engineer." },
      { icon: ShieldCheck, title: "Compliance Dashboard", desc: "ISO 14644 and ASHRAE 110 status across all projects." },
      { icon: Factory, title: "Multi-Project Overview", desc: "Compare simulation results across product lines." },
      { icon: Brain, title: "AI Risk Scoring", desc: "Automated compliance risk detection with remediation plans." },
    ],
  },
  {
    id: "facilities-manager",
    label: "Facilities Manager",
    headline: "Monitor every zone in real time",
    description: "Cleanroom particle counts, HVAC airflow patterns, and data center thermal maps — all in one place.",
    icon: Thermometer,
    benefits: [
      { icon: Thermometer, title: "Thermal Heat Maps", desc: "Live rack-level temperature visualization for data centers." },
      { icon: Brain, title: "Anomaly Detection", desc: "AI alerts for particle count spikes and airflow deviations." },
      { icon: ShieldCheck, title: "ISO Auto-Classification", desc: "Real-time cleanroom class scoring across all zones." },
      { icon: LineChart, title: "PUE Forecasting", desc: "Predict power usage effectiveness trends for cooling optimization." },
    ],
  },
  {
    id: "rd-director",
    label: "R&D Director",
    headline: "From prototype to production, faster",
    description: "ML-powered surrogate models, automated benchmarking, and enterprise compliance for regulated industries.",
    icon: Beaker,
    benefits: [
      { icon: Brain, title: "Surrogate Models", desc: "Train ML models on simulation data for instant design exploration." },
      { icon: Factory, title: "Benchmark Engine", desc: "Compare designs against industry baselines automatically." },
      { icon: ShieldCheck, title: "FedRAMP Ready", desc: "Enterprise security controls for regulated environments." },
      { icon: Server, title: "Multi-Region Compute", desc: "Deploy simulations across US, EU, and APAC regions." },
    ],
  },
  {
    id: "product-development",
    label: "Product Development",
    headline: "Design better products with simulation data",
    description: "Integrate CFD insights directly into your product development workflow.",
    icon: Factory,
    benefits: [
      { icon: Zap, title: "Rapid Iteration", desc: "Run parameter sweeps across hundreds of design variants." },
      { icon: LineChart, title: "Performance Tracking", desc: "Track pressure drop, flow uniformity, and thermal efficiency." },
      { icon: Brain, title: "AI Recommendations", desc: "Get geometry optimization suggestions from trained models." },
      { icon: ShieldCheck, title: "Export & Reports", desc: "Generate compliance-ready PDF reports for stakeholders." },
    ],
  },
  {
    id: "other",
    label: "Other",
    headline: "Enterprise CFD, tailored to you",
    description: "Whatever your workflow, FlowForge adapts with modular tools and open APIs.",
    icon: Settings,
    benefits: [
      { icon: Zap, title: "GPU-Accelerated CFD", desc: "Run simulations on NVIDIA A100 clusters — no hardware required." },
      { icon: Brain, title: "AI Anomaly Detection", desc: "Automated cleanroom & HVAC anomaly alerts with root cause analysis." },
      { icon: ShieldCheck, title: "ISO Compliance", desc: "Real-time compliance scoring across all monitored zones." },
      { icon: BarChart3, title: "Live Monitoring", desc: "Residual tracking, convergence diagnostics, and GPU utilization." },
    ],
  },
];
