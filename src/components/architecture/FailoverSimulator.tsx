import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Play, RotateCcw, CheckCircle2, Loader2 } from "lucide-react";

export interface FailoverStep {
  id: string;
  label: string;
  duration: number; // ms to hold before next
}

const FAILOVER_STEPS: FailoverStep[] = [
  { id: "outage", label: "Region outage detected", duration: 1800 },
  { id: "dns", label: "DNS rerouted", duration: 1400 },
  { id: "traffic", label: "Traffic to secondary region", duration: 1600 },
  { id: "promote", label: "Replica promoted to primary", duration: 2000 },
  { id: "gpu", label: "GPU pools activated", duration: 1500 },
  { id: "operational", label: "System operational", duration: 0 },
];

export function FailoverSimulator({
  onStepChange,
}: {
  onStepChange: (stepId: string | null, isRunning: boolean) => void;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [completed, setCompleted] = useState(false);

  const reset = useCallback(() => {
    setIsRunning(false);
    setCurrentStep(-1);
    setCompleted(false);
    onStepChange(null, false);
  }, [onStepChange]);

  const start = useCallback(() => {
    setIsRunning(true);
    setCurrentStep(0);
    setCompleted(false);
  }, []);

  useEffect(() => {
    if (!isRunning || currentStep < 0) return;

    const step = FAILOVER_STEPS[currentStep];
    onStepChange(step.id, true);

    if (currentStep >= FAILOVER_STEPS.length - 1) {
      setIsRunning(false);
      setCompleted(true);
      return;
    }

    const timer = setTimeout(() => {
      setCurrentStep((s) => s + 1);
    }, step.duration);

    return () => clearTimeout(timer);
  }, [isRunning, currentStep, onStepChange]);

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--data-amber))]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Failover Simulation
          </span>
        </div>
        <div className="flex items-center gap-2">
          {completed && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-md border border-surface-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
          {!isRunning && !completed && (
            <button
              onClick={start}
              className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-md bg-[hsl(var(--data-rose)/0.15)] border border-[hsl(var(--data-rose)/0.3)] text-[hsl(var(--data-rose))] hover:bg-[hsl(var(--data-rose)/0.25)] transition-colors"
            >
              <Play className="w-3 h-3" />
              Simulate Outage
            </button>
          )}
          {isRunning && (
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-[hsl(var(--data-amber))]">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running…
            </span>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="px-4 py-3 space-y-0">
        {FAILOVER_STEPS.map((step, i) => {
          const isActive = currentStep === i && isRunning;
          const isDone = i < currentStep || (completed && i <= currentStep);
          const isPending = i > currentStep || currentStep === -1;

          return (
            <div key={step.id} className="flex items-stretch gap-3">
              {/* Vertical line + dot */}
              <div className="flex flex-col items-center w-5">
                <div
                  className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 transition-all duration-300 ${
                    isDone
                      ? "bg-[hsl(var(--data-emerald))] border-[hsl(var(--data-emerald))]"
                      : isActive
                        ? "bg-[hsl(var(--data-amber))] border-[hsl(var(--data-amber))] shadow-[0_0_8px_hsl(var(--data-amber)/0.5)]"
                        : "bg-transparent border-surface-border"
                  }`}
                />
                {i < FAILOVER_STEPS.length - 1 && (
                  <div
                    className={`w-px flex-1 min-h-[20px] transition-colors duration-300 ${
                      isDone ? "bg-[hsl(var(--data-emerald)/0.4)]" : "bg-surface-border"
                    }`}
                  />
                )}
              </div>

              {/* Label */}
              <div className="pb-3">
                <span
                  className={`text-xs font-medium transition-colors duration-300 ${
                    isDone
                      ? "text-[hsl(var(--data-emerald))]"
                      : isActive
                        ? "text-[hsl(var(--data-amber))]"
                        : "text-muted-foreground/50"
                  }`}
                >
                  {step.label}
                </span>
                {isDone && step.id === "operational" && (
                  <CheckCircle2 className="inline-block w-3 h-3 ml-1.5 text-[hsl(var(--data-emerald))]" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
