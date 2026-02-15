import { describe, it, expect, vi } from "vitest";
import { ComputeUsageService } from "./compute-usage-service";
import type { AgentNotification } from "./compute-usage-service";

describe("ComputeUsageService", () => {
  // ── Tier Defaults ─────────────────────────────────────────────────────
  it("initialises with zero usage", () => {
    const svc = new ComputeUsageService("free");
    const u = svc.getUsage();
    expect(u.cpuHours).toBe(0);
    expect(u.gpuHours).toBe(0);
  });

  it("accepts initial usage", () => {
    const svc = new ComputeUsageService("pro", { cpuHours: 100 });
    expect(svc.getUsage().cpuHours).toBe(100);
  });

  // ── Recording ─────────────────────────────────────────────────────────
  it("accumulates usage deltas", () => {
    const svc = new ComputeUsageService("pro");
    svc.recordUsage({ cpuHours: 10 });
    svc.recordUsage({ cpuHours: 5, gpuHours: 2 });
    expect(svc.getUsage().cpuHours).toBe(15);
    expect(svc.getUsage().gpuHours).toBe(2);
  });

  // ── Cost Estimation ───────────────────────────────────────────────────
  it("computes cost for pro tier", () => {
    const svc = new ComputeUsageService("pro", { cpuHours: 100, gpuHours: 10 });
    const cost = svc.estimateCost();
    expect(cost.cpuCost).toBe(12); // 100 * 0.12
    expect(cost.gpuCost).toBe(8.5); // 10 * 0.85
    expect(cost.totalCost).toBe(cost.cpuCost + cost.gpuCost + cost.memoryCost);
    expect(cost.currency).toBe("USD");
  });

  it("computes zero cost for free tier", () => {
    const svc = new ComputeUsageService("free", { cpuHours: 40 });
    const cost = svc.estimateCost();
    expect(cost.totalCost).toBe(0);
  });

  // ── Warning: 75% ─────────────────────────────────────────────────────
  it("triggers approaching warning at 75%", () => {
    const svc = new ComputeUsageService("free", { cpuHours: 38 }); // 38/50 = 76%
    const warnings = svc.checkWarnings();
    const cpuWarn = warnings.find((w) => w.resource === "cpuHours");
    expect(cpuWarn).toBeDefined();
    expect(cpuWarn!.level).toBe("approaching");
    expect(cpuWarn!.percentUsed).toBeGreaterThanOrEqual(75);
  });

  // ── Warning: 90% ─────────────────────────────────────────────────────
  it("triggers critical warning at 90%", () => {
    const svc = new ComputeUsageService("free", { cpuHours: 46 }); // 46/50 = 92%
    const warnings = svc.checkWarnings();
    const cpuWarn = warnings.find((w) => w.resource === "cpuHours");
    expect(cpuWarn).toBeDefined();
    expect(cpuWarn!.level).toBe("critical");
  });

  // ── Warning: exceeded ─────────────────────────────────────────────────
  it("triggers exceeded warning above 100%", () => {
    const svc = new ComputeUsageService("free", { cpuHours: 55 });
    const warnings = svc.checkWarnings();
    const cpuWarn = warnings.find((w) => w.resource === "cpuHours");
    expect(cpuWarn!.level).toBe("exceeded");
  });

  // ── No warnings under 75% ────────────────────────────────────────────
  it("returns no warnings below 75%", () => {
    const svc = new ComputeUsageService("pro", { cpuHours: 100 }); // 100/500 = 20%
    const warnings = svc.checkWarnings();
    expect(warnings).toHaveLength(0);
  });

  // ── Agent Intervention ────────────────────────────────────────────────
  it("flags agentInterventionRequired when critical", () => {
    const svc = new ComputeUsageService("free", { cpuHours: 48 });
    const report = svc.generateReport();
    expect(report.agentInterventionRequired).toBe(true);
    expect(report.agentMessage).toBeTruthy();
  });

  it("does not flag agent intervention when healthy", () => {
    const svc = new ComputeUsageService("enterprise", { cpuHours: 100 });
    const report = svc.generateReport();
    expect(report.agentInterventionRequired).toBe(false);
    expect(report.agentMessage).toBeNull();
  });

  // ── Agent Notification Listener ───────────────────────────────────────
  it("emits agent notification on recordUsage warning", () => {
    const svc = new ComputeUsageService("free");
    const received: AgentNotification[] = [];
    svc.onAgentNotification((n) => received.push(n));

    svc.recordUsage({ cpuHours: 46 }); // 92% → critical

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0].severity).toBe("warning");
    expect(received[0].autoAction).toBe("pause_queued");
  });

  it("emits critical notification when exceeded", () => {
    const svc = new ComputeUsageService("free");
    const received: AgentNotification[] = [];
    svc.onAgentNotification((n) => received.push(n));

    svc.recordUsage({ cpuHours: 55 });

    const critical = received.find((n) => n.severity === "critical");
    expect(critical).toBeDefined();
    expect(critical!.autoAction).toBe("block_new");
  });

  it("unsubscribes listener", () => {
    const svc = new ComputeUsageService("free");
    const received: AgentNotification[] = [];
    const unsub = svc.onAgentNotification((n) => received.push(n));
    unsub();

    svc.recordUsage({ cpuHours: 46 });
    expect(received).toHaveLength(0);
  });

  // ── Multiple Resources ────────────────────────────────────────────────
  it("tracks multiple resource warnings simultaneously", () => {
    const svc = new ComputeUsageService("free", {
      cpuHours: 46,
      gpuHours: 4.6,
      simulationDurationHours: 3.8,
    });
    const warnings = svc.checkWarnings();
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  // ── Enterprise Tier ───────────────────────────────────────────────────
  it("has higher limits for enterprise tier", () => {
    const svc = new ComputeUsageService("enterprise");
    expect(svc.getLimits().cpuHours).toBe(5000);
    expect(svc.getLimits().gpuHours).toBe(1000);
  });
});
