import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Lightbulb, CheckCircle2, AlertTriangle, BarChart3, FileText, Zap } from "lucide-react";

interface TourStep {
  target: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  position: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='regulation-selector']",
    title: "Choose Your Regulatory Domain",
    description:
      "Start by selecting the domain that applies to your facility — HVAC, Cleanroom, Exhaust, Agriculture, or Data Center. Each domain loads specific regulatory standards and thresholds.",
    icon: <Lightbulb className="w-5 h-5" />,
    position: "bottom",
  },
  {
    target: "[data-tour='compliance-overview']",
    title: "Read the Compliance Overview",
    description:
      "This panel shows your overall verdict (Compliant / Non-Compliant / Conditional) and key findings. Green = pass, Red = violation requiring action, Amber = borderline.",
    icon: <CheckCircle2 className="w-5 h-5" />,
    position: "bottom",
  },
  {
    target: "[data-tour='risk-heatmap']",
    title: "Interpret the Risk Heatmap",
    description:
      "Each cell maps a metric to its risk level. Darker reds mean higher severity. Click any cell to see the exact measured vs. required value and the applicable standard.",
    icon: <AlertTriangle className="w-5 h-5" />,
    position: "bottom",
  },
  {
    target: "[data-tour='risk-trend']",
    title: "Track Risk Over Time",
    description:
      "The trend panel shows how your risk score has changed. A rising trend signals deteriorating compliance — take corrective action before the next audit window.",
    icon: <BarChart3 className="w-5 h-5" />,
    position: "bottom",
  },
  {
    target: "[data-tour='violation-explorer']",
    title: "Drill Into Violations",
    description:
      "Each row is a specific finding with severity, measured value, required threshold, and a recommended remediation. Prioritize Critical and High items first.",
    icon: <AlertTriangle className="w-5 h-5" />,
    position: "top",
  },
  {
    target: "[data-tour='export-panel']",
    title: "Export & Share Reports",
    description:
      "Generate PDF or CSV reports filtered by date and standard. Share these with auditors, attach to regulatory submissions, or archive for internal records.",
    icon: <FileText className="w-5 h-5" />,
    position: "top",
  },
  {
    target: "[data-tour='ai-advisor']",
    title: "Get AI-Powered Next Steps",
    description:
      "The AI Advisor analyzes your findings and suggests prioritized remediation steps, cost estimates, and timelines. Use this to build your compliance action plan.",
    icon: <Zap className="w-5 h-5" />,
    position: "top",
  },
];

const TOUR_STORAGE_KEY = "compliance-tour-completed";

export function ComplianceGuidedTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) setShowBanner(true);
  }, []);

  const positionTooltip = useCallback((stepIndex: number) => {
    const step = TOUR_STEPS[stepIndex];
    const el = document.querySelector(step.target);
    if (!el) {
      setTooltipStyle({ top: "50%", left: "50%", transform: "translate(-50%, -50%)", position: "fixed" });
      return;
    }

    const rect = el.getBoundingClientRect();
    const pad = 16;
    const style: React.CSSProperties = { position: "fixed", zIndex: 9999 };

    switch (step.position) {
      case "bottom":
        style.top = rect.bottom + pad;
        style.left = rect.left + rect.width / 2;
        style.transform = "translateX(-50%)";
        break;
      case "top":
        style.bottom = window.innerHeight - rect.top + pad;
        style.left = rect.left + rect.width / 2;
        style.transform = "translateX(-50%)";
        break;
      case "right":
        style.top = rect.top + rect.height / 2;
        style.left = rect.right + pad;
        style.transform = "translateY(-50%)";
        break;
      case "left":
        style.top = rect.top + rect.height / 2;
        style.right = window.innerWidth - rect.left + pad;
        style.transform = "translateY(-50%)";
        break;
    }

    // Clamp within viewport
    if (typeof style.top === "number") style.top = Math.max(16, Math.min(style.top, window.innerHeight - 300));
    if (typeof style.left === "number") style.left = Math.max(16, Math.min(style.left, window.innerWidth - 400));

    setTooltipStyle(style);

    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const startTour = useCallback(() => {
    setShowBanner(false);
    setIsActive(true);
    setCurrentStep(0);
    setTimeout(() => positionTooltip(0), 300);
  }, [positionTooltip]);

  const goTo = useCallback(
    (step: number) => {
      if (step < 0 || step >= TOUR_STEPS.length) return;
      setCurrentStep(step);
      setTimeout(() => positionTooltip(step), 200);
    },
    [positionTooltip]
  );

  const endTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
  }, []);

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;

  if (!isActive && showBanner) {
    return (
      <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-fade-in">
        <div className="surface-panel rounded-xl border border-primary/20 shadow-lg p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">New to Compliance?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Take a quick guided tour to learn how to interpret findings and plan next steps.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={startTour}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              >
                Start Tour
              </button>
              <button
                onClick={() => {
                  setShowBanner(false);
                  localStorage.setItem(TOUR_STORAGE_KEY, "true");
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
          <button onClick={() => setShowBanner(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!isActive) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm" onClick={endTour} />

      {/* Highlight ring on target */}
      <HighlightRing target={step.target} />

      {/* Tooltip */}
      <div style={tooltipStyle} className="z-[9999] w-[360px] animate-fade-in">
        <div className="surface-panel rounded-xl border border-surface-border shadow-2xl p-5">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
                {step.icon}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Step {currentStep + 1} of {TOUR_STEPS.length}
              </span>
            </div>
            <button onClick={endTour} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <h3 className="text-sm font-semibold text-foreground mb-1.5">{step.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mt-4 mb-3 justify-center">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentStep ? "bg-primary w-4" : i < currentStep ? "bg-primary/40" : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => goTo(currentStep - 1)}
              disabled={currentStep === 0}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </button>
            {isLast ? (
              <button
                onClick={endTour}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Finish Tour
              </button>
            ) : (
              <button
                onClick={() => goTo(currentStep + 1)}
                className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** Renders a pulsing ring around the target element. */
function HighlightRing({ target }: { target: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = document.querySelector(target);
    if (el) setRect(el.getBoundingClientRect());
  }, [target]);

  if (!rect) return null;

  return (
    <div
      className="fixed z-[9999] pointer-events-none rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse"
      style={{
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
      }}
    />
  );
}

/** Button to re-launch the tour from the header. */
export function TourLaunchButton() {
  const resetAndLaunch = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("start-compliance-tour"));
  };

  return (
    <button
      onClick={resetAndLaunch}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      title="Start guided tour"
    >
      <Lightbulb className="w-3.5 h-3.5" />
      Guided Tour
    </button>
  );
}
