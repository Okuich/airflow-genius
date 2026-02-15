// ─── Simulation Event Bus (Legacy Adapter) ─────────────────────────────────
// Wraps the generic PlatformEventBus for backward compat.
// New code should use PlatformEventBus directly.
// ──────────────────────────────────────────────────────────────────────────

import type { SimulationCompletedEvent, Event } from "@/packages/types";
import { PlatformEventBus, getEventBus } from "@/packages/events";

type LegacyHandler = (event: SimulationCompletedEvent) => void | Promise<void>;

export class SimulationEventBus {
  private readonly bus: PlatformEventBus;

  constructor(bus?: PlatformEventBus) {
    this.bus = bus ?? getEventBus();
  }

  /** Register a handler for simulation-completed events. Returns unsubscribe fn. */
  onSimulationCompleted(handler: LegacyHandler): () => void {
    return this.bus.on("simulation.completed", (event: Event<"simulation.completed">) => {
      return handler(event.payload);
    });
  }

  /** Emit a simulation-completed event. */
  async emit(payload: SimulationCompletedEvent): Promise<void> {
    await this.bus.emit("simulation.completed", payload);
  }

  /** Access the underlying typed bus. */
  get platformBus(): PlatformEventBus {
    return this.bus;
  }
}
