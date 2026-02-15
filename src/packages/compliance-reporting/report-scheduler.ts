// ─── Report Scheduler ───────────────────────────────────────────────────────
// Manages scheduled compliance report generation.
// ──────────────────────────────────────────────────────────────────────────

import type {
  ReportSchedule,
  ScheduleFrequency,
  ScheduledRunResult,
  ReportTemplateId,
  ReportFormat,
  DeliveryConfig,
  DeliveryResult,
} from "./types";
import type { AirflowComplianceDomain } from "@/packages/types";
import { ComplianceOrchestrator } from "@/packages/compliance-engine";
import { ReportFormatter } from "./report-formatter";
import { ReportHistoryService } from "./report-history";

const FREQUENCY_MS: Record<ScheduleFrequency, number> = {
  on_demand: 0,
  daily: 86_400_000,
  weekly: 604_800_000,
  monthly: 2_592_000_000,
};

export class ReportScheduler {
  private schedules: ReportSchedule[] = [];
  private readonly orchestrator: ComplianceOrchestrator;
  private readonly formatter = new ReportFormatter();
  private readonly history: ReportHistoryService;

  constructor(orchestrator?: ComplianceOrchestrator, history?: ReportHistoryService) {
    this.orchestrator = orchestrator ?? new ComplianceOrchestrator();
    this.history = history ?? new ReportHistoryService();
  }

  /**
   * Create a new report schedule.
   */
  createSchedule(params: {
    organizationId: string;
    templateId: ReportTemplateId;
    format: ReportFormat;
    frequency: ScheduleFrequency;
    domain: AirflowComplianceDomain;
    metricKeys: string[];
  }): ReportSchedule {
    const now = new Date().toISOString();
    const schedule: ReportSchedule = {
      id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      organizationId: params.organizationId,
      templateId: params.templateId,
      format: params.format,
      frequency: params.frequency,
      domain: params.domain,
      metricKeys: params.metricKeys,
      enabled: true,
      lastRunAt: null,
      nextRunAt: this.computeNextRun(now, params.frequency),
      createdAt: now,
    };
    this.schedules.push(schedule);
    return schedule;
  }

  /** Get all schedules for an organization. */
  getSchedules(organizationId: string): ReportSchedule[] {
    return this.schedules.filter((s) => s.organizationId === organizationId);
  }

  /** Enable or disable a schedule. */
  setEnabled(scheduleId: string, enabled: boolean): void {
    const schedule = this.schedules.find((s) => s.id === scheduleId);
    if (schedule) schedule.enabled = enabled;
  }

  /** Delete a schedule. */
  deleteSchedule(scheduleId: string): boolean {
    const idx = this.schedules.findIndex((s) => s.id === scheduleId);
    if (idx === -1) return false;
    this.schedules.splice(idx, 1);
    return true;
  }

  /**
   * Execute a scheduled run with given metrics.
   */
  executeSchedule(
    scheduleId: string,
    metrics: Record<string, number>
  ): ScheduledRunResult | null {
    const schedule = this.schedules.find((s) => s.id === scheduleId);
    if (!schedule || !schedule.enabled) return null;

    const pipelineResult = this.orchestrator.run({
      simulationId: `scheduled-${schedule.id}-${Date.now()}`,
      organizationId: schedule.organizationId,
      domain: schedule.domain,
      metrics,
    });

    const report = this.formatter.format(
      pipelineResult.auditDocument,
      schedule.templateId,
      schedule.format
    );

    this.history.record(report, pipelineResult.auditDocument);

    const now = new Date().toISOString();
    schedule.lastRunAt = now;
    schedule.nextRunAt = this.computeNextRun(now, schedule.frequency);

    return {
      scheduleId: schedule.id,
      pipelineResult,
      report,
      executedAt: now,
    };
  }

  /**
   * Get all schedules that are due for execution.
   */
  getDueSchedules(): ReportSchedule[] {
    const now = new Date().toISOString();
    return this.schedules.filter(
      (s) => s.enabled && s.nextRunAt !== null && s.nextRunAt <= now
    );
  }

  /**
   * Deliver a formatted report via a channel.
   */
  deliver(report: { content: string; filename: string }, config: DeliveryConfig): DeliveryResult {
    // In-app delivery is always successful (content is already available).
    // Email and webhook delivery would integrate with external services.
    const now = new Date().toISOString();

    if (config.channel === "in_app") {
      return { channel: "in_app", success: true, deliveredAt: now };
    }

    if (config.channel === "webhook" && config.target) {
      // Webhook delivery would POST to target URL — placeholder for integration.
      return { channel: "webhook", success: true, deliveredAt: now };
    }

    if (config.channel === "email" && config.target) {
      // Email delivery would use an email service — placeholder for integration.
      return { channel: "email", success: true, deliveredAt: now };
    }

    return {
      channel: config.channel,
      success: false,
      deliveredAt: now,
      error: `Missing target for ${config.channel} delivery.`,
    };
  }

  private computeNextRun(from: string, frequency: ScheduleFrequency): string | null {
    if (frequency === "on_demand") return null;
    const ms = FREQUENCY_MS[frequency];
    return new Date(new Date(from).getTime() + ms).toISOString();
  }
}
