import type { MemoryStore, MemoryEntry, InteractionRecord, AgentIntent, CacheOptions } from "./types";

/**
 * In-memory implementation of MemoryStore with Redis-style TTL, tagging, and
 * similarity lookup.  Drop-in replaceable with a real Redis/Valkey adapter.
 */
export class InMemoryStore implements MemoryStore {
  private store = new Map<string, MemoryEntry>();
  private interactions: InteractionRecord[] = [];

  // ─── Core KV ────────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.ttlSeconds !== null) {
      const age = (Date.now() - new Date(entry.createdAt).getTime()) / 1000;
      if (age > entry.ttlSeconds) {
        this.store.delete(key);
        return null;
      }
    }

    entry.accessedAt = new Date().toISOString();
    entry.accessCount += 1;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const now = new Date().toISOString();
    this.store.set(key, {
      key,
      value,
      ttlSeconds: ttlSeconds ?? null,
      createdAt: now,
      accessedAt: now,
      accessCount: 0,
      tags: [],
    });
  }

  async setWithOptions<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    const now = new Date().toISOString();
    const prefixedKey = `${options.namespace}:${key}`;
    this.store.set(prefixedKey, {
      key: prefixedKey,
      value,
      ttlSeconds: options.ttlSeconds,
      createdAt: now,
      accessedAt: now,
      accessCount: 0,
      tags: options.tags,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== null;
  }

  async getByTag(tag: string): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = [];
    for (const entry of this.store.values()) {
      if (entry.tags.includes(tag)) results.push(entry);
    }
    return results;
  }

  // ─── Interaction History ────────────────────────────────────────────────

  async recordInteraction(record: InteractionRecord): Promise<void> {
    this.interactions.push(record);
  }

  async getInteractionHistory(userId: string, limit: number): Promise<InteractionRecord[]> {
    return this.interactions
      .filter((r) => r.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getSimilarIssues(intent: AgentIntent, limit: number): Promise<InteractionRecord[]> {
    return this.interactions
      .filter((r) => r.intent.category === intent.category && r.resolvedWithoutEscalation)
      .sort((a, b) => b.intent.confidence - a.intent.confidence)
      .slice(0, limit);
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.interactions = [];
  }
}
