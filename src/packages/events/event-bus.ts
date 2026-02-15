// ─── Strongly-Typed Platform Event Bus ─────────────────────────────────────
// Generic, type-safe event emitter with pluggable transport abstraction.
// Default: in-memory. Extensible to Kafka, Redis Streams, etc.
// ──────────────────────────────────────────────────────────────────────────

import type {
  PlatformEventMap,
  PlatformEventName,
  Event,
  EventTransport,
} from "@/packages/types";

// ── ID Generator ────────────────────────────────────────────────────────

let counter = 0;
function generateEventId(): string {
  return `evt_${Date.now()}_${++counter}`;
}

// ── In-Memory Transport (default) ───────────────────────────────────────

type Handler<T extends PlatformEventName> = (event: Event<T>) => void | Promise<void>;

export class InMemoryTransport implements EventTransport {
  private listeners = new Map<string, Set<Handler<any>>>();

  publish<T extends PlatformEventName>(event: Event<T>): Promise<void> {
    const handlers = this.listeners.get(event.name);
    if (!handlers || handlers.size === 0) return Promise.resolve();

    const results = [...handlers].map((h) =>
      Promise.resolve().then(() => h(event))
    );

    return Promise.allSettled(results).then((settled) => {
      for (const result of settled) {
        if (result.status === "rejected") {
          console.error(`[EventBus] Handler error on "${event.name}":`, result.reason);
        }
      }
    });
  }

  subscribe<T extends PlatformEventName>(
    name: T,
    handler: Handler<T>
  ): () => void {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, new Set());
    }
    const set = this.listeners.get(name)!;
    set.add(handler as Handler<any>);

    return () => {
      set.delete(handler as Handler<any>);
      if (set.size === 0) this.listeners.delete(name);
    };
  }

  /** Number of handlers registered for a given event. */
  listenerCount(name: PlatformEventName): number {
    return this.listeners.get(name)?.size ?? 0;
  }

  /** Total handlers across all events. */
  get totalListeners(): number {
    let total = 0;
    for (const set of this.listeners.values()) total += set.size;
    return total;
  }

  /** Remove all handlers. */
  clear(): void {
    this.listeners.clear();
  }
}

// ── Typed Event Bus ─────────────────────────────────────────────────────

export class PlatformEventBus {
  private readonly transport: EventTransport;
  private readonly source: string;

  constructor(opts?: { transport?: EventTransport; source?: string }) {
    this.transport = opts?.transport ?? new InMemoryTransport();
    this.source = opts?.source ?? "platform";
  }

  /** Emit a typed event. */
  async emit<T extends PlatformEventName>(
    name: T,
    payload: PlatformEventMap[T]
  ): Promise<Event<T>> {
    const event: Event<T> = {
      id: generateEventId(),
      name,
      payload,
      timestamp: new Date().toISOString(),
      source: this.source,
    };

    await this.transport.publish(event);
    return event;
  }

  /** Subscribe to a specific event type with full type inference. */
  on<T extends PlatformEventName>(
    name: T,
    handler: (event: Event<T>) => void | Promise<void>
  ): () => void {
    return this.transport.subscribe(name, handler);
  }

  /** Subscribe to an event, auto-unsubscribe after first emission. */
  once<T extends PlatformEventName>(
    name: T,
    handler: (event: Event<T>) => void | Promise<void>
  ): () => void {
    const unsubscribe = this.on(name, async (event) => {
      unsubscribe();
      await handler(event);
    });
    return unsubscribe;
  }

  /** Wait for the next emission of an event (Promise-based). */
  waitFor<T extends PlatformEventName>(
    name: T,
    timeoutMs = 30_000
  ): Promise<Event<T>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error(`Timeout waiting for event "${name}" after ${timeoutMs}ms`));
      }, timeoutMs);

      const unsub = this.once(name, (event) => {
        clearTimeout(timer);
        resolve(event);
      });
    });
  }

  /** Get the underlying transport (useful for transport-specific APIs). */
  getTransport(): EventTransport {
    return this.transport;
  }
}

// ── Singleton for app-wide use ──────────────────────────────────────────

let _defaultBus: PlatformEventBus | null = null;

export function getEventBus(): PlatformEventBus {
  if (!_defaultBus) {
    _defaultBus = new PlatformEventBus({ source: "flowforge" });
  }
  return _defaultBus;
}

/** Replace the default bus (useful for testing). */
export function setEventBus(bus: PlatformEventBus): void {
  _defaultBus = bus;
}
