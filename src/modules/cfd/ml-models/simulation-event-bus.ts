// ─── Step 1: Simulation Completed Event ────────────────────────────────────
// Pub/sub bus for simulation lifecycle events. When a simulation completes,
// it fires the event that kicks off the full ML pipeline.
// ──────────────────────────────────────────────────────────────────────────

import type { SimulationCompletedEvent } from "@/packages/types";

type EventHandler = (event: SimulationCompletedEvent) => void | Promise<void>;

export class SimulationEventBus {
  private handlers: EventHandler[] = [];

  /** Register a handler for simulation-completed events. Returns unsubscribe fn. */
  onSimulationCompleted(handler: EventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx >= 0) this.handlers.splice(idx, 1);
    };
  }

  /** Emit a simulation-completed event to all registered handlers. */
  async emit(event: SimulationCompletedEvent): Promise<void> {
    const settled = await Promise.allSettled(
      this.handlers.map((h) => Promise.resolve(h(event)))
    );
    for (const result of settled) {
      if (result.status === "rejected") {
        console.error("[SimulationEventBus] Handler error:", result.reason);
      }
    }
  }

  /** Number of registered handlers. */
  get listenerCount(): number {
    return this.handlers.length;
  }
}
