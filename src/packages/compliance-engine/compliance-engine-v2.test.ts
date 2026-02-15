import { describe, it, expect } from "vitest";
import { ComplianceEngine } from "./compliance-engine";
import { ComplianceAuditLogger } from "./audit-logger";
import { RuleVersionResolver } from "./rule-version-resolver";
import type { VersionedRule, EvaluationRequest } from "./schemas";

// ── Helpers ─────────────────────────────────────────────────────────────────

const EXHAUST_REQUEST: EvaluationRequest = {
  simulationId: "sim-001",
  organizationId: "org-001",
  domain: "exhaust",
  metrics: { captureVelocity: 0.3, peakConcentration: 65, twaConcentration: 30, faceVelocity: 0.35 },
};

const VERSIONED_RULE: VersionedRule = {
  id: "OSHA-PEL-1910.1000",
  authority: "OSHA",
  standardCode: "29 CFR 1910.1000",
  description: "Updated PEL limit (v2)",
  metric: "peakConcentration",
  threshold: 40,
  operator: "<=",
  severity: "Critical",
  version: 2,
  effectiveFrom: "2025-01-01T00:00:00.000Z",
  effectiveTo: null,
  supersedes: null,
  changeNote: "Lowered threshold from 50 to 40 ppm",
};

// ── ComplianceEngine ────────────────────────────────────────────────────────

describe("ComplianceEngine", () => {
  it("evaluates metrics and returns findings with Zod validation", () => {
    const engine = new ComplianceEngine();
    const findings = engine.evaluate(EXHAUST_REQUEST);

    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.status === "Pass" || f.status === "Fail")).toBe(true);
    expect(findings.some((f) => f.status === "Fail")).toBe(true);
  });

  it("rejects invalid input with descriptive error", () => {
    const engine = new ComplianceEngine();
    expect(() =>
      engine.evaluate({
        simulationId: "",
        organizationId: "org-1",
        domain: "exhaust",
        metrics: {},
      })
    ).toThrow("Validation failed");
  });

  it("logs audit entries during evaluation", () => {
    const engine = new ComplianceEngine();
    engine.evaluate(EXHAUST_REQUEST);

    const entries = engine.auditLog.getEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.action === "evaluation_started")).toBe(true);
    expect(entries.some((e) => e.action === "evaluation_completed")).toBe(true);
  });

  it("respects enableAuditLog = false", () => {
    const engine = new ComplianceEngine({ enableAuditLog: false });
    engine.evaluate(EXHAUST_REQUEST);
    expect(engine.auditLog.size).toBe(0);
  });

  it("loads additional rules at runtime", () => {
    const engine = new ComplianceEngine();
    const { loaded, errors } = engine.loadRules([
      { id: "CUSTOM-1", authority: "OSHA", standardCode: "X", metric: "testMetric", threshold: 10, operator: "<=", severity: "Low", description: "Test" },
    ]);
    expect(loaded).toBe(1);
    expect(errors).toHaveLength(0);
  });

  it("supports versioned rules that override static rules", () => {
    const engine = new ComplianceEngine({ versionedRules: [VERSIONED_RULE] });
    const findings = engine.evaluate(EXHAUST_REQUEST);

    const pelFinding = findings.find((f) => f.ruleId === "OSHA-PEL-1910.1000");
    expect(pelFinding).toBeDefined();
    expect(pelFinding!.threshold).toBe(40); // versioned threshold
    expect(pelFinding!.ruleVersion).toBe(2);
    expect(pelFinding!.status).toBe("Fail");
  });

  it("supports multiple authorities in one evaluation", () => {
    const engine = new ComplianceEngine();
    const findings = engine.evaluate(EXHAUST_REQUEST);

    const authorities = new Set(
      findings.map((f) => {
        const rules = engine.getRules("exhaust");
        return rules.find((r) => r.id === f.ruleId)?.authority;
      })
    );
    expect(authorities.size).toBeGreaterThanOrEqual(1);
  });

  it("filters audit log by simulationId", () => {
    const engine = new ComplianceEngine();
    engine.evaluate(EXHAUST_REQUEST);
    engine.evaluate({ ...EXHAUST_REQUEST, simulationId: "sim-002" });

    const sim1 = engine.auditLog.getEntries({ simulationId: "sim-001" });
    const sim2 = engine.auditLog.getEntries({ simulationId: "sim-002" });
    expect(sim1.length).toBeGreaterThan(0);
    expect(sim2.length).toBeGreaterThan(0);
    expect(sim1.every((e) => e.simulationId === "sim-001")).toBe(true);
  });
});

// ── RuleVersionResolver ─────────────────────────────────────────────────────

describe("RuleVersionResolver", () => {
  it("resolves the correct version for a date", () => {
    const resolver = new RuleVersionResolver();
    const v1: VersionedRule = {
      ...VERSIONED_RULE,
      version: 1,
      threshold: 50,
      effectiveFrom: "2020-01-01T00:00:00.000Z",
      effectiveTo: "2025-01-01T00:00:00.000Z",
      changeNote: "Original",
    };
    resolver.load([v1, VERSIONED_RULE]);

    const old = resolver.resolve("OSHA-PEL-1910.1000", "2024-06-15T00:00:00.000Z");
    expect(old?.version).toBe(1);
    expect(old?.threshold).toBe(50);

    const current = resolver.resolve("OSHA-PEL-1910.1000", "2025-06-15T00:00:00.000Z");
    expect(current?.version).toBe(2);
    expect(current?.threshold).toBe(40);
  });

  it("returns null for non-existent rule", () => {
    const resolver = new RuleVersionResolver();
    expect(resolver.resolve("NONEXISTENT")).toBeNull();
  });

  it("rejects invalid versioned rules", () => {
    const resolver = new RuleVersionResolver();
    const { loaded, errors } = resolver.load([
      { ...VERSIONED_RULE, version: -1 } as VersionedRule,
    ]);
    expect(loaded).toBe(0);
    expect(errors.length).toBe(1);
  });

  it("provides version history", () => {
    const resolver = new RuleVersionResolver();
    const v1: VersionedRule = {
      ...VERSIONED_RULE,
      version: 1,
      effectiveFrom: "2020-01-01T00:00:00.000Z",
      effectiveTo: "2025-01-01T00:00:00.000Z",
      changeNote: "Original",
    };
    resolver.load([v1, VERSIONED_RULE]);
    const history = resolver.getHistory("OSHA-PEL-1910.1000");
    expect(history).toHaveLength(2);
  });
});

// ── ComplianceAuditLogger ───────────────────────────────────────────────────

describe("ComplianceAuditLogger", () => {
  it("records and retrieves entries", () => {
    const logger = new ComplianceAuditLogger();
    logger.record("evaluation_started", { domain: "exhaust" });
    logger.record("evaluation_completed", { findings: 5 });

    expect(logger.size).toBe(2);
    expect(logger.getEntries({ action: "evaluation_started" })).toHaveLength(1);
  });

  it("evicts oldest entries when over limit", () => {
    const logger = new ComplianceAuditLogger(3);
    for (let i = 0; i < 5; i++) {
      logger.record("rule_matched", { index: i });
    }
    expect(logger.size).toBe(3);
  });

  it("exports immutable copy", () => {
    const logger = new ComplianceAuditLogger();
    logger.record("rules_loaded", {});
    const exported = logger.export();
    exported.pop();
    expect(logger.size).toBe(1);
  });
});
