import { useState, useCallback } from "react";
import {
  Grid3X3, ArrowRightLeft, Settings2, BarChart3, Sparkles, Play,
  CheckCircle2, Circle, Loader2, ChevronRight, ChevronDown, X,
  AlertTriangle, Zap,
} from "lucide-react";
import type { SimulationContext } from "./ai-chat-types";
import {
  WORKFLOW_TEMPLATES,
  type WorkflowTemplate,
  type WorkflowRun,
  type WorkflowStep,
  createWorkflowRun,
  resolvePrompt,
} from "./workflows";
import ReactMarkdown from "react-markdown";
import { streamAgentMessage } from "./ai-chat-service";

// ── Icon Map ────────────────────────────────────────────────────────────────

const WORKFLOW_ICONS: Record<string, typeof Grid3X3> = {
  mesh: Grid3X3,
  boundary: ArrowRightLeft,
  solver: Settings2,
  postprocess: BarChart3,
  optimize: Sparkles,
  validate: CheckCircle2,
};

const CATEGORY_COLORS: Record<string, string> = {
  "pre-processing": "text-data-cyan",
  solving: "text-data-amber",
  "post-processing": "text-data-emerald",
  validation: "text-data-violet",
};

// ── Props ───────────────────────────────────────────────────────────────────

interface WorkflowPanelProps {
  simulationContext?: SimulationContext;
  onClose: () => void;
  onSendMessage: (message: string) => void;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function WorkflowPanel({ simulationContext, onClose, onSendMessage }: WorkflowPanelProps) {
  const [activeRun, setActiveRun] = useState<WorkflowRun | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<WorkflowTemplate | null>(null);
  const [stepInputs, setStepInputs] = useState<Record<string, unknown>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [stepOutputs, setStepOutputs] = useState<Record<number, string>>({});
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  // ── Start workflow ──────────────────────────────────────────────────────

  const startWorkflow = useCallback((template: WorkflowTemplate) => {
    const run = createWorkflowRun(template);
    setActiveRun(run);
    setActiveTemplate(template);
    setStepInputs({});
    setStepOutputs({});
    setExpandedStep(0);
  }, []);

  // ── Execute current step ────────────────────────────────────────────────

  const executeStep = useCallback(async (stepIndex: number) => {
    if (!activeRun || !activeTemplate || isExecuting) return;

    const step = activeTemplate.steps[stepIndex];
    if (!step) return;

    setIsExecuting(true);

    // Update run status
    setActiveRun((prev) => {
      if (!prev) return prev;
      const statuses = [...prev.stepStatuses];
      statuses[stepIndex] = "active";
      return { ...prev, currentStepIndex: stepIndex, stepStatuses: statuses };
    });

    // Build context from simulation + previous outputs
    const context: Record<string, unknown> = {
      simulationName: simulationContext?.name ?? "",
      turbulenceModel: simulationContext?.turbulenceModel ?? "",
      cellCount: simulationContext?.cellCount ?? 0,
      currentIteration: simulationContext?.currentIteration ?? 0,
      maxIterations: simulationContext?.maxIterations ?? 1000,
      ...simulationContext?.relaxationFactors,
    };

    // Merge user inputs for this step
    const currentInputs = { ...stepInputs };

    // Resolve prompt
    const prompt = resolvePrompt(step.promptTemplate, currentInputs, context);

    // Build messages with previous step outputs as context
    const previousContext = Object.entries(stepOutputs)
      .filter(([idx]) => Number(idx) < stepIndex)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([idx, output]) => `### Step ${Number(idx) + 1}: ${activeTemplate.steps[Number(idx)].title}\n${output}`)
      .join("\n\n");

    const messages = [
      {
        role: "system",
        content: `You are a CFD workflow assistant executing step ${stepIndex + 1} of the "${activeTemplate.name}" workflow. 
Be specific, technical, and actionable. Use tables and bullet points for clarity.
${previousContext ? `\n\nPrevious workflow steps completed:\n${previousContext}` : ""}`,
      },
      { role: "user", content: prompt },
    ];

    let fullContent = "";
    const controller = new AbortController();

    try {
      await streamAgentMessage({
        messages,
        simulationId: simulationContext?.simulationId,
        simulationContext,
        onDelta: (chunk) => {
          fullContent += chunk;
          setStepOutputs((prev) => ({ ...prev, [stepIndex]: fullContent }));
        },
        onDone: (content) => {
          setStepOutputs((prev) => ({ ...prev, [stepIndex]: content }));

          // Mark step complete, advance
          setActiveRun((prev) => {
            if (!prev) return prev;
            const statuses = [...prev.stepStatuses];
            statuses[stepIndex] = "completed";
            const nextIndex = stepIndex + 1;
            const isLast = nextIndex >= activeTemplate.steps.length;
            return {
              ...prev,
              stepStatuses: statuses,
              currentStepIndex: isLast ? stepIndex : nextIndex,
              status: isLast ? "completed" : "running",
            };
          });

          setExpandedStep(stepIndex + 1 < activeTemplate.steps.length ? stepIndex + 1 : stepIndex);
          setIsExecuting(false);

          // Auto-execute next step if applicable
          const nextStep = activeTemplate.steps[stepIndex + 1];
          if (nextStep?.autoExecute && !nextStep.inputs?.some((i) => i.required)) {
            setTimeout(() => executeStep(stepIndex + 1), 500);
          }
        },
        onError: (error) => {
          setStepOutputs((prev) => ({ ...prev, [stepIndex]: `⚠️ Error: ${error}` }));
          setActiveRun((prev) => {
            if (!prev) return prev;
            const statuses = [...prev.stepStatuses];
            statuses[stepIndex] = "failed";
            return { ...prev, stepStatuses: statuses, status: "failed" };
          });
          setIsExecuting(false);
        },
        signal: controller.signal,
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setIsExecuting(false);
      }
    }
  }, [activeRun, activeTemplate, isExecuting, stepInputs, stepOutputs, simulationContext]);

  // ── Reset ──────────────────────────────────────────────────────────────

  const resetWorkflow = useCallback(() => {
    setActiveRun(null);
    setActiveTemplate(null);
    setStepInputs({});
    setStepOutputs({});
    setExpandedStep(null);
  }, []);

  // ── Render: Workflow Selector ──────────────────────────────────────────

  if (!activeRun) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1 mb-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Workflows</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {WORKFLOW_TEMPLATES.map((wf) => {
          const Icon = WORKFLOW_ICONS[wf.icon] ?? Sparkles;
          const catColor = CATEGORY_COLORS[wf.category] ?? "text-muted-foreground";
          return (
            <button
              key={wf.id}
              onClick={() => startWorkflow(wf)}
              className="w-full text-left surface-raised rounded-lg p-3.5 hover:ring-1 hover:ring-primary/30 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-overlay flex items-center justify-center shrink-0">
                  <Icon className={`w-4 h-4 ${catColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{wf.name}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{wf.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded bg-surface-overlay ${catColor} font-medium capitalize`}>{wf.category}</span>
                    <span className="text-muted-foreground">{wf.steps.length} steps</span>
                    <span className="text-muted-foreground">~{wf.estimatedMinutes} min</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // ── Render: Active Workflow ────────────────────────────────────────────

  const completedSteps = activeRun.stepStatuses.filter((s) => s === "completed").length;
  const progress = Math.round((completedSteps / activeTemplate!.steps.length) * 100);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{activeTemplate!.name}</h3>
          <p className="text-[10px] text-muted-foreground">
            Step {activeRun.currentStepIndex + 1} of {activeTemplate!.steps.length} · {progress}% complete
          </p>
        </div>
        <button onClick={resetWorkflow} className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-surface-overlay transition-colors">
          ← Back
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-surface-overlay overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {activeTemplate!.steps.map((step, idx) => {
          const status = activeRun.stepStatuses[idx];
          const isExpanded = expandedStep === idx;
          const output = stepOutputs[idx];
          const canExecute = idx === activeRun.currentStepIndex && status !== "completed" && status !== "active";

          return (
            <div key={step.id} className={`rounded-lg border transition-all ${
              status === "active" ? "border-primary/40 bg-primary/5" :
              status === "completed" ? "border-data-emerald/30 bg-data-emerald/5" :
              status === "failed" ? "border-data-rose/30 bg-data-rose/5" :
              "border-surface-border bg-surface-raised/50"
            }`}>
              {/* Step header */}
              <button
                onClick={() => setExpandedStep(isExpanded ? null : idx)}
                className="w-full flex items-center gap-2.5 p-3 text-left"
              >
                <StepStatusIcon status={status} />
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-semibold ${status === "completed" ? "text-data-emerald" : "text-foreground"}`}>
                    {step.title}
                  </span>
                  <p className="text-[10px] text-muted-foreground truncate">{step.description}</p>
                </div>
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3">
                  {/* Inputs */}
                  {step.inputs && canExecute && (
                    <div className="space-y-2">
                      {step.inputs.map((input) => (
                        <StepInputField
                          key={input.key}
                          input={input}
                          value={stepInputs[input.key]}
                          onChange={(val) => setStepInputs((prev) => ({ ...prev, [input.key]: val }))}
                        />
                      ))}
                    </div>
                  )}

                  {/* Execute button */}
                  {canExecute && (
                    <button
                      onClick={() => executeStep(idx)}
                      disabled={isExecuting || (step.inputs?.some((i) => i.required && !stepInputs[i.key]))}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity text-[11px] font-medium"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Execute Step
                    </button>
                  )}

                  {/* Output */}
                  {output && (
                    <div className="rounded-md bg-surface-overlay/50 p-3 max-h-[300px] overflow-y-auto">
                      <div className="prose prose-sm prose-invert max-w-none text-[11px] leading-relaxed">
                        <ReactMarkdown>{output}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Confirmation for next step */}
                  {status === "completed" && step.requiresConfirmation && idx < activeTemplate!.steps.length - 1 && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-data-amber" />
                      <span className="text-muted-foreground">Review output before proceeding to next step</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completion state */}
      {activeRun.status === "completed" && (
        <div className="rounded-lg border border-data-emerald/30 bg-data-emerald/5 p-4 text-center space-y-2">
          <CheckCircle2 className="w-6 h-6 text-data-emerald mx-auto" />
          <p className="text-sm font-semibold text-foreground">Workflow Complete</p>
          <p className="text-[11px] text-muted-foreground">All {activeTemplate!.steps.length} steps executed successfully.</p>
          <div className="flex gap-2 justify-center pt-1">
            <button
              onClick={resetWorkflow}
              className="px-3 py-1.5 rounded-md text-[11px] font-medium surface-raised text-foreground hover:bg-surface-overlay transition-colors"
            >
              New Workflow
            </button>
            <button
              onClick={() => {
                const summary = Object.entries(stepOutputs)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([idx, out]) => `## ${activeTemplate!.steps[Number(idx)].title}\n${out}`)
                  .join("\n\n---\n\n");
                onSendMessage(`Summarize the key findings from this ${activeTemplate!.name} workflow:\n\n${summary.slice(0, 2000)}`);
                resetWorkflow();
              }}
              className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Zap className="w-3 h-3 inline mr-1" />
              AI Summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-data-emerald shrink-0" />;
    case "active":
      return <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />;
    case "failed":
      return <AlertTriangle className="w-4 h-4 text-data-rose shrink-0" />;
    default:
      return <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />;
  }
}

function StepInputField({
  input,
  value,
  onChange,
}: {
  input: { key: string; label: string; type: string; options?: { label: string; value: string }[]; defaultValue?: string | number | boolean; placeholder?: string; required?: boolean; hint?: string };
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const currentVal = value ?? input.defaultValue ?? "";

  return (
    <div>
      <label className="block text-[10px] font-medium text-foreground mb-1">
        {input.label}
        {input.required && <span className="text-data-rose ml-0.5">*</span>}
      </label>
      {input.type === "select" ? (
        <select
          value={String(currentVal)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1.5 rounded-md bg-surface-overlay border border-surface-border text-foreground text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Select…</option>
          {input.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : input.type === "number" ? (
        <input
          type="number"
          step="any"
          value={String(currentVal)}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={input.placeholder}
          className="w-full px-2 py-1.5 rounded-md bg-surface-overlay border border-surface-border text-foreground text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-primary"
        />
      ) : (
        <input
          type="text"
          value={String(currentVal)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={input.placeholder}
          className="w-full px-2 py-1.5 rounded-md bg-surface-overlay border border-surface-border text-foreground text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
        />
      )}
      {input.hint && <p className="text-[9px] text-muted-foreground mt-0.5">{input.hint}</p>}
    </div>
  );
}
