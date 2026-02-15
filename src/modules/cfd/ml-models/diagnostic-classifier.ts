// ─── Step 3: Diagnostic Classification ─────────────────────────────────────
// Converts simulation results into numeric labels for supervised learning.
// ──────────────────────────────────────────────────────────────────────────

import type {
  SimulationCompletedEvent,
  SimulationLabels,
  EfficiencyRating,
} from "@/packages/types";

const EFFICIENCY_MAP: Record<EfficiencyRating, number> = {
  Poor: 0,
  Average: 1,
  Good: 2,
  Excellent: 3,
};

export class DiagnosticClassifier {
  /** Extract numeric labels from a simulation-completed event. */
  label(event: SimulationCompletedEvent): SimulationLabels {
    const r = event.results;
    return {
      pressureDrop: r.pressureDrop,
      converged: r.converged ? 1 : 0,
      iterationsToConverge: r.converged ? r.totalIterations : null,
      efficiencyRating: EFFICIENCY_MAP[r.efficiencyRating] ?? null,
      totalPressureLoss: r.pressureDrop,
      solveTimeSeconds: r.solveTimeSeconds,
    };
  }

  /** Validate that a label set has enough data for a given model target. */
  isValidFor(labels: SimulationLabels, target: "pressure_drop" | "convergence" | "efficiency"): boolean {
    switch (target) {
      case "pressure_drop":
        return labels.pressureDrop !== null;
      case "convergence":
        return labels.converged !== null;
      case "efficiency":
        return labels.efficiencyRating !== null;
    }
  }

  /** Get the target value for a given model type. */
  getTarget(labels: SimulationLabels, target: "pressure_drop" | "convergence" | "efficiency"): number | null {
    switch (target) {
      case "pressure_drop":
        return labels.pressureDrop;
      case "convergence":
        return labels.converged;
      case "efficiency":
        return labels.efficiencyRating;
    }
  }
}
