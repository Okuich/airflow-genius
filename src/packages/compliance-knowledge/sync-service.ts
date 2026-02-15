// ─── Compliance Knowledge Sync Service ──────────────────────────────────────
// Client-side service that merges static STANDARD_CATALOG / RULE_LIBRARY
// with AI-synced updates from the database.
// ──────────────────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";
import { STANDARD_CATALOG } from "./standard-catalog";
import { RULE_LIBRARY, RULE_DOMAIN_MAP } from "./rule-library";
import type { StandardDefinition } from "./types";
import type { ComplianceRule, AirflowComplianceDomain } from "@/packages/types";

// ── Sync Result Types ────────────────────────────────────────────────────

export interface SyncedStandard {
  standard_id: string;
  title: string;
  edition_year: number;
  issuing_body: string;
  domains: string[];
  change_summary: string;
  is_new: boolean;
  clauses?: {
    clause_id: string;
    title: string;
    requirement: string;
    metrics: string[];
  }[];
}

export interface SyncedRule {
  rule_id: string;
  authority: string;
  standard_code: string;
  description: string;
  metric: string;
  threshold: number;
  operator: string;
  severity: string;
  domain: string;
  is_new: boolean;
  change_summary?: string;
}

export interface SyncLogEntry {
  id: string;
  started_at: string;
  completed_at: string | null;
  standards_synced: number;
  rules_synced: number;
  status: "running" | "completed" | "failed";
  error_message: string | null;
  ai_model: string | null;
}

export interface MergedKnowledgeBase {
  standards: StandardDefinition[];
  rules: ComplianceRule[];
  ruleDomainMap: Record<string, AirflowComplianceDomain>;
  syncedStandards: SyncedStandard[];
  syncedRules: SyncedRule[];
  lastSync: SyncLogEntry | null;
}

// ── Service ──────────────────────────────────────────────────────────────

export class ComplianceKnowledgeSyncService {
  /**
   * Fetch synced updates from DB and merge with static knowledge base.
   */
  async getMergedKnowledgeBase(): Promise<MergedKnowledgeBase> {
    const [syncedStandards, syncedRules, lastSync] = await Promise.all([
      this.fetchSyncedStandards(),
      this.fetchSyncedRules(),
      this.fetchLastSync(),
    ]);

    // Merge standards: update existing or add new
    const mergedStandards = [...STANDARD_CATALOG];
    for (const synced of syncedStandards) {
      const existingIdx = mergedStandards.findIndex(
        (s) => s.standard === synced.standard_id
      );
      if (existingIdx >= 0 && synced.edition_year > mergedStandards[existingIdx].editionYear) {
        // Update edition year and clauses if newer
        mergedStandards[existingIdx] = {
          ...mergedStandards[existingIdx],
          editionYear: synced.edition_year,
          clauses: synced.clauses?.map((c) => ({
            clauseId: c.clause_id,
            title: c.title,
            requirement: c.requirement,
            metrics: c.metrics,
          })) ?? mergedStandards[existingIdx].clauses,
        };
      } else if (existingIdx < 0 && synced.is_new) {
        // Add new standard
        mergedStandards.push({
          standard: synced.standard_id as any,
          authority: synced.issuing_body as any,
          title: synced.title,
          description: synced.change_summary,
          issuingBody: synced.issuing_body,
          editionYear: synced.edition_year,
          domains: synced.domains as AirflowComplianceDomain[],
          keywords: synced.domains,
          clauses: synced.clauses?.map((c) => ({
            clauseId: c.clause_id,
            title: c.title,
            requirement: c.requirement,
            metrics: c.metrics,
          })) ?? [],
        });
      }
    }

    // Merge rules
    const mergedRules = [...RULE_LIBRARY];
    const mergedDomainMap = { ...RULE_DOMAIN_MAP };
    for (const synced of syncedRules) {
      const existingIdx = mergedRules.findIndex((r) => r.id === synced.rule_id);
      const rule: ComplianceRule = {
        id: synced.rule_id,
        authority: synced.authority as any,
        standardCode: synced.standard_code,
        description: synced.description,
        metric: synced.metric,
        threshold: synced.threshold,
        operator: synced.operator as any,
        severity: synced.severity as any,
      };

      if (existingIdx >= 0) {
        mergedRules[existingIdx] = rule;
      } else {
        mergedRules.push(rule);
      }
      mergedDomainMap[synced.rule_id] = synced.domain as AirflowComplianceDomain;
    }

    return {
      standards: mergedStandards,
      rules: mergedRules,
      ruleDomainMap: mergedDomainMap,
      syncedStandards,
      syncedRules,
      lastSync,
    };
  }

  /**
   * Trigger a manual sync via the edge function.
   */
  async triggerSync(): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.functions.invoke("compliance-sync", {
      body: {},
    });

    if (error) return { success: false, error: error.message };
    return { success: true, ...data };
  }

  // ── Private Fetchers ──────────────────────────────────────────────────

  private async fetchSyncedStandards(): Promise<SyncedStandard[]> {
    const { data, error } = await supabase
      .from("compliance_knowledge_sync")
      .select("payload")
      .eq("sync_type", "standard")
      .eq("is_active", true);

    if (error || !data) return [];
    return data.map((row) => row.payload as unknown as SyncedStandard);
  }

  private async fetchSyncedRules(): Promise<SyncedRule[]> {
    const { data, error } = await supabase
      .from("compliance_knowledge_sync")
      .select("payload")
      .eq("sync_type", "rule")
      .eq("is_active", true);

    if (error || !data) return [];
    return data.map((row) => row.payload as unknown as SyncedRule);
  }

  private async fetchLastSync(): Promise<SyncLogEntry | null> {
    const { data, error } = await supabase
      .from("compliance_sync_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as unknown as SyncLogEntry;
  }
}
