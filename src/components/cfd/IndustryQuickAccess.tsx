import { Link } from "react-router-dom";
import { ChevronRight, Snowflake, Server, Thermometer, Shield, Eye, Brain, Gauge, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface QuickAccessCard {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  accent: string; // tailwind token like "data-cyan"
}

const INDUSTRY_CARDS: Record<string, QuickAccessCard[]> = {
  cleanroom: [
    {
      icon: Snowflake,
      title: "Cleanroom ISO Dashboard",
      description: "Real-time ISO 14644-1 classification across all monitored zones with particle count trends.",
      href: "/cleanroom",
      accent: "data-emerald",
    },
    {
      icon: Shield,
      title: "Compliance Engine",
      description: "Automated compliance scoring against ASHRAE 110 and ISO 14644 standards.",
      href: "/compliance",
      accent: "data-violet",
    },
  ],
  "data-center": [
    {
      icon: Server,
      title: "Data Center Thermal Map",
      description: "Rack-level temperature visualization with hot spot detection and containment leak alerts.",
      href: "/datacenter",
      accent: "data-amber",
    },
    {
      icon: Thermometer,
      title: "PUE Forecasting",
      description: "Predict power usage effectiveness trends and optimize cooling system efficiency.",
      href: "/datacenter",
      accent: "data-cyan",
    },
  ],
  hvac: [
    {
      icon: Eye,
      title: "3D Flow Viewer",
      description: "Visualize velocity vectors, pressure contours, and streamlines in your duct geometries.",
      href: "/viewer",
      accent: "data-cyan",
    },
    {
      icon: Gauge,
      title: "Solver Monitor",
      description: "Track convergence, iteration progress, and GPU utilization across active simulations.",
      href: "/solver-status",
      accent: "data-emerald",
    },
  ],
  automotive: [
    {
      icon: Eye,
      title: "Aerodynamic Viewer",
      description: "Visualize external flow fields, pressure distributions, and drag force breakdowns.",
      href: "/viewer",
      accent: "data-cyan",
    },
    {
      icon: Brain,
      title: "ML Surrogate Pipeline",
      description: "Train surrogate models on simulation data for instant design space exploration.",
      href: "/ml-pipeline",
      accent: "data-violet",
    },
  ],
  energy: [
    {
      icon: Eye,
      title: "Turbomachinery Viewer",
      description: "Visualize rotating frame results, blade loading, and meridional flow patterns.",
      href: "/viewer",
      accent: "data-cyan",
    },
    {
      icon: Gauge,
      title: "Solver Performance",
      description: "Monitor rotating machinery solve progress, convergence, and GPU utilization.",
      href: "/solver-status",
      accent: "data-emerald",
    },
  ],
};

// Fallback for "industrial", "other", or "full"
const DEFAULT_CARDS: QuickAccessCard[] = [
  {
    icon: Eye,
    title: "3D Flow Viewer",
    description: "Visualize velocity vectors, pressure contours, and streamlines across your geometries.",
    href: "/viewer",
    accent: "data-cyan",
  },
  {
    icon: Shield,
    title: "Compliance Engine",
    description: "Automated compliance scoring and audit report generation.",
    href: "/compliance",
    accent: "data-emerald",
  },
];

export function IndustryQuickAccess({ tierId }: { tierId: string }) {
  const cards = INDUSTRY_CARDS[tierId] || DEFAULT_CARDS;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">Recommended for You</h2>
        <span className="text-[10px] uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">
          {tierId === "full" ? "All Access" : tierId.replace("-", " ")} trial
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cards.map((card) => (
          <Link
            key={card.title}
            to={card.href}
            className="group surface-panel rounded-lg p-5 hover:border-primary/30 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0`}
                style={{ background: `hsl(var(--${card.accent}) / 0.12)` }}
              >
                <card.icon className="w-5 h-5" style={{ color: `hsl(var(--${card.accent}))` }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
