// ─── AI Workflow Types ──────────────────────────────────────────────────────
// Modular multi-step workflow definitions for common CFD tasks.
// ──────────────────────────────────────────────────────────────────────────

export type WorkflowStepStatus = "pending" | "active" | "completed" | "failed" | "skipped";

export interface WorkflowStepInput {
  key: string;
  label: string;
  type: "number" | "text" | "select" | "boolean";
  options?: { label: string; value: string }[];
  defaultValue?: string | number | boolean;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  /** AI prompt template — {{var}} placeholders filled from inputs + context */
  promptTemplate: string;
  /** Optional user-editable inputs surfaced before executing the step */
  inputs?: WorkflowStepInput[];
  /** Whether the step requires user confirmation before proceeding */
  requiresConfirmation?: boolean;
  /** Whether this step can be auto-executed without user input */
  autoExecute?: boolean;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: "mesh" | "boundary" | "solver" | "postprocess" | "optimize" | "validate";
  category: "pre-processing" | "solving" | "post-processing" | "validation";
  estimatedMinutes: number;
  steps: WorkflowStep[];
}

export interface WorkflowRun {
  id: string;
  templateId: string;
  templateName: string;
  startedAt: string;
  currentStepIndex: number;
  stepStatuses: WorkflowStepStatus[];
  stepOutputs: (string | null)[];
  userInputs: Record<string, Record<string, unknown>>;
  status: "running" | "paused" | "completed" | "failed";
}

export function createWorkflowRun(template: WorkflowTemplate): WorkflowRun {
  return {
    id: `wf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    templateId: template.id,
    templateName: template.name,
    startedAt: new Date().toISOString(),
    currentStepIndex: 0,
    stepStatuses: template.steps.map(() => "pending"),
    stepOutputs: template.steps.map(() => null),
    userInputs: {},
    status: "running",
  };
}

export function resolvePrompt(
  template: string,
  inputs: Record<string, unknown>,
  context?: Record<string, unknown>
): string {
  let result = template;
  const vars = { ...context, ...inputs };
  for (const [key, value] of Object.entries(vars)) {
    result = result.split(`{{${key}}}`).join(String(value ?? ""));
  }
  // Remove any unresolved placeholders
  result = result.replace(/\{\{[^}]+\}\}/g, "[not provided]");
  return result;
}
