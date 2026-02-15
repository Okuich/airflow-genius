// ─── Compliance Engine Schemas ───────────────────────────────────────────────
// Zod validation schemas for all compliance engine inputs and outputs.
// ──────────────────────────────────────────────────────────────────────────

import { z } from "zod";

// ── Enums / Literals ────────────────────────────────────────────────────────

export const ComplianceAuthoritySchema = z.enum(["ASHRAE", "ISO", "OSHA", "EPA"]);

export const ComplianceSeveritySchema = z.enum(["Low", "Medium", "High", "Critical"]);

export const ComplianceOperatorSchema = z.enum([">", "<", ">=", "<="]);

export const AirflowComplianceDomainSchema = z.enum([
  "hvac", "cleanroom", "exhaust", "agriculture", "data-center", "general",
]);

export const FindingStatusSchema = z.enum(["Pass", "Fail"]);

// ── Rule ────────────────────────────────────────────────────────────────────

export const ComplianceRuleSchema = z.object({
  id: z.string().min(1).max(100),
  authority: ComplianceAuthoritySchema,
  standardCode: z.string().min(1).max(100),
  metric: z.string().min(1).max(100),
  threshold: z.number().finite(),
  operator: ComplianceOperatorSchema,
  severity: ComplianceSeveritySchema,
  description: z.string().min(1).max(500),
});

// ── Versioned Rule ──────────────────────────────────────────────────────────

export const VersionedRuleSchema = ComplianceRuleSchema.extend({
  version: z.number().int().positive(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable(),
  supersedes: z.string().nullable(),
  changeNote: z.string().max(500).nullable(),
});

export type VersionedRule = z.infer<typeof VersionedRuleSchema>;

// ── Evaluation Request ──────────────────────────────────────────────────────

export const EvaluationRequestSchema = z.object({
  simulationId: z.string().min(1).max(200),
  organizationId: z.string().min(1).max(200),
  domain: AirflowComplianceDomainSchema,
  metrics: z.record(z.string(), z.number().finite()),
  region: z.enum(["US", "EU", "Asia"]).optional(),
  industry: z.enum(["Cleanroom", "Exhaust", "DataCenter"]).optional(),
  effectiveDate: z.string().datetime().optional(),
  contextKeywords: z.array(z.string().max(100)).max(50).optional(),
});

export type EvaluationRequest = z.infer<typeof EvaluationRequestSchema>;

// ── Finding ─────────────────────────────────────────────────────────────────

export const ComplianceFindingSchema = z.object({
  ruleId: z.string(),
  ruleVersion: z.number().int().positive().optional(),
  status: FindingStatusSchema,
  measuredValue: z.number(),
  threshold: z.number(),
  riskLevel: ComplianceSeveritySchema,
  recommendation: z.string(),
});

export type ValidatedFinding = z.infer<typeof ComplianceFindingSchema>;

// ── Audit Log Entry ─────────────────────────────────────────────────────────

export const AuditLogActionSchema = z.enum([
  "rules_loaded",
  "evaluation_started",
  "evaluation_completed",
  "rule_matched",
  "rule_skipped",
  "validation_error",
  "rules_version_resolved",
]);

export const AuditLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  action: AuditLogActionSchema,
  simulationId: z.string().nullable(),
  organizationId: z.string().nullable(),
  details: z.record(z.string(), z.unknown()),
});

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;
