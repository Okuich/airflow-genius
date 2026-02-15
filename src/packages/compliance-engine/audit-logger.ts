// ─── Compliance Audit Logger ────────────────────────────────────────────────
// Immutable, append-only audit log for compliance engine operations.
// ──────────────────────────────────────────────────────────────────────────

import type { AuditLogEntry } from "./schemas";
import { AuditLogActionSchema } from "./schemas";

type AuditAction = AuditLogEntry["action"];

export class ComplianceAuditLogger {
  private readonly log: AuditLogEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries;
  }

  /** Append an audit entry. */
  record(
    action: AuditAction,
    details: Record<string, unknown>,
    context?: { simulationId?: string; organizationId?: string }
  ): AuditLogEntry {
    AuditLogActionSchema.parse(action);

    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      action,
      simulationId: context?.simulationId ?? null,
      organizationId: context?.organizationId ?? null,
      details,
    };

    this.log.push(entry);

    // Evict oldest entries if over limit
    if (this.log.length > this.maxEntries) {
      this.log.splice(0, this.log.length - this.maxEntries);
    }

    return entry;
  }

  /** Get all entries, optionally filtered. */
  getEntries(filter?: {
    action?: AuditAction;
    simulationId?: string;
    organizationId?: string;
    since?: string;
  }): AuditLogEntry[] {
    let results = [...this.log];

    if (filter?.action) results = results.filter((e) => e.action === filter.action);
    if (filter?.simulationId) results = results.filter((e) => e.simulationId === filter.simulationId);
    if (filter?.organizationId) results = results.filter((e) => e.organizationId === filter.organizationId);
    if (filter?.since) results = results.filter((e) => e.timestamp >= filter.since!);

    return results;
  }

  /** Total entry count. */
  get size(): number {
    return this.log.length;
  }

  /** Export all entries (immutable copy). */
  export(): AuditLogEntry[] {
    return [...this.log];
  }

  /** Clear all entries (for testing). */
  clear(): void {
    this.log.length = 0;
  }
}
