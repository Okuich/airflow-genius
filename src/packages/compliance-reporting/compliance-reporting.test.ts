import { describe, it, expect } from "vitest";
import { ReportFormatter } from "./report-formatter";
import { ReportHistoryService } from "./report-history";
import { ReportScheduler } from "./report-scheduler";
import { REPORT_TEMPLATES, getTemplate } from "./report-templates";
import { ComplianceOrchestrator } from "@/packages/compliance-engine";
import type { AuditDocument } from "@/packages/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildAuditDoc(): AuditDocument {
  const orch = new ComplianceOrchestrator();
  const result = orch.run({
    simulationId: "sim-rpt-001",
    organizationId: "org-rpt-001",
    domain: "exhaust",
    metrics: { captureVelocity: 0.2, peakConcentration: 80, twaConcentration: 30 },
  });
  return result.auditDocument;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("compliance-reporting", () => {
  describe("ReportTemplates", () => {
    it("has four predefined templates", () => {
      expect(REPORT_TEMPLATES).toHaveLength(4);
    });

    it("retrieves template by id", () => {
      const t = getTemplate("executive_summary");
      expect(t?.name).toBe("Executive Summary");
      expect(t?.sections.length).toBeGreaterThan(0);
    });

    it("returns undefined for unknown template", () => {
      expect(getTemplate("nonexistent")).toBeUndefined();
    });
  });

  describe("ReportFormatter", () => {
    const formatter = new ReportFormatter();
    const doc = buildAuditDoc();

    it("formats to Markdown with correct metadata", () => {
      const report = formatter.format(doc, "executive_summary", "markdown");
      expect(report.format).toBe("markdown");
      expect(report.mimeType).toBe("text/markdown");
      expect(report.filename).toMatch(/\.md$/);
      expect(report.content).toContain("# ");
      expect(report.content).toContain("Verdict Summary");
    });

    it("formats to HTML with document structure", () => {
      const report = formatter.format(doc, "detailed_technical", "html");
      expect(report.format).toBe("html");
      expect(report.content).toContain("<!DOCTYPE html>");
      expect(report.content).toContain("<h1>");
    });

    it("formats to CSV with findings rows", () => {
      const report = formatter.format(doc, "regulatory_submission", "csv");
      expect(report.format).toBe("csv");
      expect(report.content).toContain("ID,Authority,Standard");
      expect(report.content.split("\n").length).toBeGreaterThan(1);
    });

    it("formats to JSON with full audit document", () => {
      const report = formatter.format(doc, "remediation_plan", "json");
      expect(report.format).toBe("json");
      const parsed = JSON.parse(report.content);
      expect(parsed.simulationId).toBe("sim-rpt-001");
    });

    it("throws for unknown template", () => {
      expect(() => formatter.format(doc, "bad" as any, "markdown")).toThrow("Unknown template");
    });
  });

  describe("ReportHistoryService", () => {
    it("records and queries reports", () => {
      const history = new ReportHistoryService();
      const formatter = new ReportFormatter();
      const doc = buildAuditDoc();
      const report = formatter.format(doc, "executive_summary", "markdown");

      const entry = history.record(report, doc);
      expect(entry.id).toBeTruthy();
      expect(history.count).toBe(1);

      expect(history.getByOrganization("org-rpt-001")).toHaveLength(1);
      expect(history.getBySimulation("sim-rpt-001")).toHaveLength(1);
      expect(history.getById(entry.id)).toBeDefined();
    });

    it("filters by template and verdict", () => {
      const history = new ReportHistoryService();
      const formatter = new ReportFormatter();
      const doc = buildAuditDoc();

      history.record(formatter.format(doc, "executive_summary", "markdown"), doc);
      history.record(formatter.format(doc, "detailed_technical", "html"), doc);

      expect(history.query({ templateId: "executive_summary" })).toHaveLength(1);
      expect(history.query({ format: "html" })).toHaveLength(1);
      expect(history.query({ verdict: "non_compliant" })).toHaveLength(2);
    });
  });

  describe("ReportScheduler", () => {
    it("creates and executes a schedule", () => {
      const history = new ReportHistoryService();
      const scheduler = new ReportScheduler(new ComplianceOrchestrator(), history);

      const schedule = scheduler.createSchedule({
        organizationId: "org-001",
        templateId: "executive_summary",
        format: "markdown",
        frequency: "weekly",
        domain: "exhaust",
        metricKeys: ["captureVelocity", "peakConcentration"],
      });

      expect(schedule.enabled).toBe(true);
      expect(schedule.nextRunAt).toBeTruthy();

      const result = scheduler.executeSchedule(schedule.id, {
        captureVelocity: 0.3,
        peakConcentration: 60,
      });

      expect(result).toBeTruthy();
      expect(result!.report.format).toBe("markdown");
      expect(result!.pipelineResult.auditDocument).toBeDefined();
      expect(history.count).toBe(1);
    });

    it("returns null for disabled schedule", () => {
      const scheduler = new ReportScheduler();
      const schedule = scheduler.createSchedule({
        organizationId: "org-002",
        templateId: "detailed_technical",
        format: "json",
        frequency: "daily",
        domain: "hvac",
        metricKeys: ["outdoorAirRate"],
      });

      scheduler.setEnabled(schedule.id, false);
      expect(scheduler.executeSchedule(schedule.id, { outdoorAirRate: 5.0 })).toBeNull();
    });

    it("delivers via in_app channel", () => {
      const scheduler = new ReportScheduler();
      const result = scheduler.deliver(
        { content: "test", filename: "test.md" },
        { channel: "in_app" }
      );
      expect(result.success).toBe(true);
    });

    it("fails delivery without target", () => {
      const scheduler = new ReportScheduler();
      const result = scheduler.deliver(
        { content: "test", filename: "test.md" },
        { channel: "email" }
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("deletes a schedule", () => {
      const scheduler = new ReportScheduler();
      const s = scheduler.createSchedule({
        organizationId: "org-003",
        templateId: "remediation_plan",
        format: "csv",
        frequency: "monthly",
        domain: "cleanroom",
        metricKeys: ["airChangeRate"],
      });
      expect(scheduler.deleteSchedule(s.id)).toBe(true);
      expect(scheduler.getSchedules("org-003")).toHaveLength(0);
    });
  });
});
