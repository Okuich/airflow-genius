import type { LucideIcon } from "lucide-react";
import {
  Wind, Thermometer, Beaker, Factory, Car, Zap,
  Server, ShieldCheck, Brain, LineChart, AlertTriangle, Settings,
} from "lucide-react";

export interface IndustryOnboarding {
  id: string;
  label: string;
  dashboardSubtitle: string;
  aiAgentTips: string[];
  tourOverrides: {
    welcomeDescription: string;
    metricsDescription: string;
  };
  suggestedPages: { label: string; path: string; icon: LucideIcon }[];
}

const INDUSTRY_ONBOARDING: Record<string, IndustryOnboarding> = {
  hvac: {
    id: "hvac",
    label: "HVAC & Ventilation",
    dashboardSubtitle: "HVAC & Turbomachinery Platform",
    aiAgentTips: [
      'Say "Set up a duct simulation with a 90° bend" to auto-configure mesh and solver',
      'Ask "What\'s the pressure drop across this duct?" for instant results analysis',
      'Try "Optimize airflow distribution for this plenum" for AI-guided design',
    ],
    tourOverrides: {
      welcomeDescription:
        "FlowForge is configured for HVAC simulation. The AI Agent can set up duct geometries, configure turbulence models, and analyze pressure drops — all from natural language.",
      metricsDescription:
        "Track your HVAC simulation runs, average solve times, and compute usage. These update live as your CFD jobs progress.",
    },
    suggestedPages: [
      { label: "3D Viewer", path: "/viewer", icon: Wind },
      { label: "Compliance", path: "/compliance", icon: ShieldCheck },
      { label: "Solver Status", path: "/solver-status", icon: LineChart },
    ],
  },
  "data-center": {
    id: "data-center",
    label: "Data Center Cooling",
    dashboardSubtitle: "Data Center Thermal Management Platform",
    aiAgentTips: [
      'Say "Show me the thermal map for rack row A" to visualize hot spots',
      'Ask "Predict PUE for next week" for cooling efficiency forecasts',
      'Try "Detect containment leaks in Zone B" for automated diagnostics',
    ],
    tourOverrides: {
      welcomeDescription:
        "FlowForge is configured for data center thermal management. The AI Agent can map rack temperatures, forecast PUE trends, and detect containment leaks automatically.",
      metricsDescription:
        "Monitor data center simulation jobs, cooling efficiency metrics, and thermal analysis compute usage in real time.",
    },
    suggestedPages: [
      { label: "Data Center", path: "/datacenter", icon: Server },
      { label: "Solver Status", path: "/solver-status", icon: LineChart },
      { label: "Compliance", path: "/compliance", icon: ShieldCheck },
    ],
  },
  cleanroom: {
    id: "cleanroom",
    label: "Cleanroom & Pharma",
    dashboardSubtitle: "Cleanroom & Pharmaceutical Airflow Platform",
    aiAgentTips: [
      'Say "Classify all zones by ISO 14644" for instant cleanroom scoring',
      'Ask "Set up anomaly alerts for Zone A particle counts" for monitoring',
      'Try "What\'s the laminar stability in the fill zone?" for real-time analysis',
    ],
    tourOverrides: {
      welcomeDescription:
        "FlowForge is configured for cleanroom and pharmaceutical environments. The AI Agent monitors particle counts, classifies ISO zones, and alerts you to airflow deviations.",
      metricsDescription:
        "Track cleanroom simulation jobs, particle retention metrics, and ISO classification status across all monitored zones.",
    },
    suggestedPages: [
      { label: "Cleanroom", path: "/cleanroom", icon: Beaker },
      { label: "Compliance", path: "/compliance", icon: ShieldCheck },
      { label: "3D Viewer", path: "/viewer", icon: Wind },
    ],
  },
  industrial: {
    id: "industrial",
    label: "Industrial Process",
    dashboardSubtitle: "Industrial Process CFD Platform",
    aiAgentTips: [
      'Say "Simulate exhaust flow through the scrubber" to configure industrial geometries',
      'Ask "What\'s the backflow risk at the outlet?" for safety analysis',
      'Try "Optimize mixing chamber geometry" for AI-guided design',
    ],
    tourOverrides: {
      welcomeDescription:
        "FlowForge is configured for industrial process simulation. The AI Agent helps you model exhaust systems, mixing chambers, and ventilation networks.",
      metricsDescription:
        "Monitor industrial CFD simulation runs, process efficiency metrics, and compute resource usage.",
    },
    suggestedPages: [
      { label: "3D Viewer", path: "/viewer", icon: Wind },
      { label: "Solver Status", path: "/solver-status", icon: LineChart },
      { label: "Compliance", path: "/compliance", icon: ShieldCheck },
    ],
  },
  automotive: {
    id: "automotive",
    label: "Automotive & Aerospace",
    dashboardSubtitle: "Automotive & Aerospace CFD Platform",
    aiAgentTips: [
      'Say "Run an external aero simulation at 120 km/h" for vehicle aerodynamics',
      'Ask "Compare drag coefficients across design variants" for benchmarking',
      'Try "Set up a parameter sweep for inlet angles" for design exploration',
    ],
    tourOverrides: {
      welcomeDescription:
        "FlowForge is configured for automotive and aerospace simulation. The AI Agent can set up external aerodynamics, run parameter sweeps, and benchmark designs.",
      metricsDescription:
        "Track aerodynamic simulation jobs, design variant comparisons, and GPU compute usage for high-fidelity solves.",
    },
    suggestedPages: [
      { label: "3D Viewer", path: "/viewer", icon: Wind },
      { label: "ML Pipeline", path: "/ml-pipeline", icon: Brain },
      { label: "Solver Status", path: "/solver-status", icon: LineChart },
    ],
  },
  energy: {
    id: "energy",
    label: "Energy & Power",
    dashboardSubtitle: "Energy & Power Systems CFD Platform",
    aiAgentTips: [
      'Say "Simulate flow through the turbine stage" for turbomachinery analysis',
      'Ask "What\'s the thermal efficiency at off-design conditions?" for performance',
      'Try "Set up a rotating frame simulation" for impeller analysis',
    ],
    tourOverrides: {
      welcomeDescription:
        "FlowForge is configured for energy and power systems. The AI Agent handles turbomachinery, heat exchangers, and rotating frame simulations.",
      metricsDescription:
        "Monitor turbomachinery simulation runs, thermal efficiency metrics, and high-performance compute usage.",
    },
    suggestedPages: [
      { label: "3D Viewer", path: "/viewer", icon: Wind },
      { label: "Solver Status", path: "/solver-status", icon: LineChart },
      { label: "Explainability", path: "/explainability", icon: Brain },
    ],
  },
  other: {
    id: "other",
    label: "Other",
    dashboardSubtitle: "HVAC & Turbomachinery Platform",
    aiAgentTips: [
      'Say "Help me set up my first simulation" to get started with the AI Agent',
      'Ask "What can FlowForge do?" for a guided overview of all features',
      'Try "Recommend a solver configuration for my geometry"',
    ],
    tourOverrides: {
      welcomeDescription:
        "FlowForge includes a built-in AI Agent that guides you through every step — from simulation setup to results interpretation. It adapts to your role and experience level.",
      metricsDescription:
        "Monitor active simulations, solve times, and compute usage at a glance. These update live as your jobs progress.",
    },
    suggestedPages: [
      { label: "3D Viewer", path: "/viewer", icon: Wind },
      { label: "Compliance", path: "/compliance", icon: ShieldCheck },
      { label: "Solver Status", path: "/solver-status", icon: LineChart },
    ],
  },
};

const INDUSTRY_STORAGE_KEY = "ff_trial_industry";

export function setTrialIndustry(industry: string) {
  localStorage.setItem(INDUSTRY_STORAGE_KEY, industry);
}

export function getTrialIndustry(): string {
  return localStorage.getItem(INDUSTRY_STORAGE_KEY) || "other";
}

export function getIndustryOnboarding(industryId?: string): IndustryOnboarding {
  const id = industryId || getTrialIndustry();
  return INDUSTRY_ONBOARDING[id] || INDUSTRY_ONBOARDING.other;
}
