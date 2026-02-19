import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Rocket, Wind, BarChart3, Brain, ShieldCheck, Cpu, Sparkles, MessageSquare } from "lucide-react";
import { createPortal } from "react-dom";

// ── Tour Step Definitions ───────────────────────────────────────────────────

export interface TourStep {
  target: string;          // CSS selector — use "" for centerscreen (no spotlight)
  title: string;
  description: string;
  icon: React.ElementType;
  position: "top" | "bottom" | "left" | "right" | "center";
  highlight?: boolean;     // Extra visual emphasis
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "",
    title: "Meet Your AI Engineering Agent",
    description: "FlowForge includes a built-in AI Agent that guides you through every step — from simulation setup to results interpretation. It adapts to your role and experience level. Look for the Agent panel on your dashboard to get started.",
    icon: Brain,
    position: "center",
    highlight: true,
  },
  {
    target: '[data-tour="metrics-row"]',
    title: "Real-Time Metrics",
    description: "Monitor active simulations, solve times, and compute usage at a glance. These update live as your jobs progress.",
    icon: BarChart3,
    position: "bottom",
  },
  {
    target: '[data-tour="residuals"]',
    title: "Residual Convergence",
    description: "Track solver convergence in real time. The chart shows continuity, momentum, and energy residuals dropping toward your target thresholds.",
    icon: Wind,
    position: "bottom",
  },
  {
    target: '[data-tour="new-sim"]',
    title: "Create Simulations",
    description: "Launch the simulation builder to configure mesh, boundary conditions, solver settings, and turbulence models for your HVAC or cleanroom geometries.",
    icon: Cpu,
    position: "bottom",
  },
  {
    target: '[data-tour="ai-agent"]',
    title: "AI Agent — Always Here to Help",
    description: "Ask it anything: \"Set up a duct simulation\", \"Why is my solve diverging?\", or \"Generate a compliance report\". The Agent handles setup, diagnostics, and results — so you can focus on engineering.",
    icon: MessageSquare,
    position: "bottom",
    highlight: true,
  },
  {
    target: '[data-tour="sidebar-nav"]',
    title: "Platform Modules",
    description: "Access the full suite: 3D viewer, compliance engine, cleanroom ISO classification, data center thermal maps, ML pipeline, and GPU solver monitoring.",
    icon: ShieldCheck,
    position: "right",
  },
];

// ── Storage Key ─────────────────────────────────────────────────────────────

const TOUR_COMPLETED_KEY = "ff_onboarding_tour_completed";

export function useOnboardingTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Auto-start for new users (never completed the tour)
  useEffect(() => {
    const completed = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (!completed) {
      // Small delay to let the dashboard render targets
      const timer = setTimeout(() => setIsActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem(TOUR_COMPLETED_KEY, "true");
  }, []);

  const next = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      endTour();
    }
  }, [currentStep, endTour]);

  const prev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  return { isActive, currentStep, startTour, endTour, next, prev, totalSteps: TOUR_STEPS.length };
}

// ── Spotlight + Tooltip Overlay ─────────────────────────────────────────────

interface OnboardingOverlayProps {
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  totalSteps: number;
}

export function OnboardingOverlay({ currentStep, onNext, onPrev, onSkip, totalSteps }: OnboardingOverlayProps) {
  const step = TOUR_STEPS[currentStep];
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({});
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Center mode — no target element
    if (!step.target) {
      const tooltipWidth = 380;
      setSpotlightStyle({ top: 0, left: 0, width: 0, height: 0 });
      setTooltipStyle({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: tooltipWidth,
      } as any);
      setVisible(true);
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) {
      setVisible(false);
      return;
    }

    const rect = el.getBoundingClientRect();
    const pad = 8;

    setSpotlightStyle({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });

    // Position tooltip
    const tooltipWidth = 340;
    const tooltipGap = 16;
    let top = 0;
    let left = 0;

    switch (step.position) {
      case "bottom":
        top = rect.bottom + tooltipGap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "top":
        top = rect.top - tooltipGap - 200;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "right":
        top = rect.top + rect.height / 2 - 80;
        left = rect.right + tooltipGap;
        break;
      case "left":
        top = rect.top + rect.height / 2 - 80;
        left = rect.left - tooltipGap - tooltipWidth;
        break;
    }

    // Clamp to viewport
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, top);

    setTooltipStyle({ top, left, width: tooltipWidth });
    setVisible(true);
  }, [currentStep, step]);

  const StepIcon = step.icon;
  const isLast = currentStep === totalSteps - 1;

  const isCenterMode = !step.target;

  return createPortal(
    <div className="fixed inset-0 z-[9999]" onClick={onSkip}>
      {/* Dimmed backdrop */}
      {isCenterMode ? (
        <div className="absolute inset-0 bg-black/70 pointer-events-none" />
      ) : (
        <>
          <div
            className="absolute rounded-xl transition-all duration-300 ease-out"
            style={{
              ...spotlightStyle,
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
              pointerEvents: "none",
            }}
          />
          <div
            className={`absolute rounded-xl border-2 transition-all duration-300 ease-out pointer-events-none ${
              step.highlight ? "border-primary/70 shadow-[0_0_20px_rgba(var(--primary),0.3)]" : "border-data-cyan/50"
            }`}
            style={spotlightStyle}
          />
        </>
      )}

      {/* Tooltip */}
      {visible && (
        <div
          className={`absolute surface-panel rounded-xl border p-5 shadow-2xl transition-all duration-300 ease-out ${
            step.highlight ? "border-primary/30 ring-1 ring-primary/20" : "border-surface-border"
          }`}
          style={tooltipStyle}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                step.highlight ? "bg-primary/15" : "bg-data-cyan/10"
              }`}>
                <StepIcon className={`w-4 h-4 ${step.highlight ? "text-primary" : "text-data-cyan"}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-mono">
                  Step {currentStep + 1} of {totalSteps}
                </p>
                <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
              </div>
            </div>
            <button
              onClick={onSkip}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Skip tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">{step.description}</p>

          {/* Progress bar */}
          <div className="flex gap-1 mb-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= currentStep ? "bg-data-cyan" : "bg-surface-overlay"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={onPrev}
              disabled={currentStep === 0}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              onClick={onNext}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              {isLast ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" /> Get Started
                </>
              ) : (
                <>
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

// ── Restart Tour Button (for header) ────────────────────────────────────────

export function RestartTourButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Restart onboarding tour"
    >
      <Rocket className="w-3.5 h-3.5" />
      Tour
    </button>
  );
}
