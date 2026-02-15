export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  actions?: ExtractedAction[];
}

export interface ExtractedAction {
  description: string;
  type: string;
  parameters?: Record<string, unknown>;
}

export interface SimulationContext {
  simulationId: string;
  name: string;
  status: string;
  turbulenceModel: string;
  cellCount: number;
  currentIteration: number;
  maxIterations: number;
  relaxationFactors?: {
    pressure?: number;
    velocity?: number;
    turbulence?: number;
  };
}

export interface QuickAction {
  label: string;
  prompt: string;
  icon: "convergence" | "mesh" | "boundary" | "performance";
}

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Diagnose convergence", prompt: "My simulation residuals are not converging. Can you diagnose the issue?", icon: "convergence" },
  { label: "Check mesh quality", prompt: "Analyse the mesh quality and suggest improvements for this simulation.", icon: "mesh" },
  { label: "Review boundaries", prompt: "Review my boundary conditions for potential misconfigurations.", icon: "boundary" },
  { label: "Interpret results", prompt: "Interpret the simulation results and rate the performance.", icon: "performance" },
];

export function extractActions(content: string): ExtractedAction[] {
  const actionRegex = /\[ACTION:\s*(.+?)\]/g;
  const actions: ExtractedAction[] = [];
  let match;
  while ((match = actionRegex.exec(content)) !== null) {
    actions.push({
      description: match[1].trim(),
      type: "suggested_fix",
    });
  }
  return actions;
}

export function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
