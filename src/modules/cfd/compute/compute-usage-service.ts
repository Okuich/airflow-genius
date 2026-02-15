// ─── Compute Usage Service ──────────────────────────────────────────────────

export type UserTier = "free" | "pro" | "enterprise";

export interface TierLimits {
  cpuHours: number;
  gpuHours: number;
  memoryGB: number;
  maxSimulationDurationHours: number;
  costPerCpuHour: number;
  costPerGpuHour: number;
  costPerGBHour: number;
}

export interface ComputeUsageSnapshot {
  cpuHours: number;
  gpuHours: number;
  memoryGBHours: number;
  simulationDurationHours: number;
}

export interface CostEstimate {
  cpuCost: number;
  gpuCost: number;
  memoryCost: number;
  totalCost: number;
  currency: "USD";
}

export type WarningLevel = "none" | "approaching" | "critical" | "exceeded";

export interface UsageWarning {
  resource: keyof ComputeUsageSnapshot;
  currentValue: number;
  limit: number;
  percentUsed: number;
  level: WarningLevel;
  message: string;
}

export interface UsageReport {
  tier: UserTier;
  usage: ComputeUsageSnapshot;
  limits: TierLimits;
  cost: CostEstimate;
  warnings: UsageWarning[];
  agentInterventionRequired: boolean;
  agentMessage: string | null;
}

export interface AgentNotification {
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  suggestedAction: string;
  autoAction: "notify_only" | "throttle" | "pause_queued" | "block_new";
}

// ─── Tier Configuration ─────────────────────────────────────────────────────

const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: {
    cpuHours: 50,
    gpuHours: 5,
    memoryGB: 16,
    maxSimulationDurationHours: 4,
    costPerCpuHour: 0,
    costPerGpuHour: 0,
    costPerGBHour: 0,
  },
  pro: {
    cpuHours: 500,
    gpuHours: 100,
    memoryGB: 64,
    maxSimulationDurationHours: 24,
    costPerCpuHour: 0.12,
    costPerGpuHour: 0.85,
    costPerGBHour: 0.015,
  },
  enterprise: {
    cpuHours: 5000,
    gpuHours: 1000,
    memoryGB: 256,
    maxSimulationDurationHours: 168,
    costPerCpuHour: 0.08,
    costPerGpuHour: 0.60,
    costPerGBHour: 0.01,
  },
};

const WARNING_THRESHOLD = 0.75;
const CRITICAL_THRESHOLD = 0.90;

// ─── Service ────────────────────────────────────────────────────────────────

export class ComputeUsageService {
  private usage: ComputeUsageSnapshot = {
    cpuHours: 0,
    gpuHours: 0,
    memoryGBHours: 0,
    simulationDurationHours: 0,
  };
  private readonly tier: UserTier;
  private readonly limits: TierLimits;
  private readonly listeners: ((notification: AgentNotification) => void)[] = [];

  constructor(tier: UserTier, initialUsage?: Partial<ComputeUsageSnapshot>) {
    this.tier = tier;
    this.limits = { ...TIER_LIMITS[tier] };
    if (initialUsage) {
      this.usage = { ...this.usage, ...initialUsage };
    }
  }

  // ── Registration ──────────────────────────────────────────────────────

  onAgentNotification(listener: (n: AgentNotification) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  // ── Usage Tracking ────────────────────────────────────────────────────

  recordUsage(delta: Partial<ComputeUsageSnapshot>): UsageReport {
    if (delta.cpuHours) this.usage.cpuHours += delta.cpuHours;
    if (delta.gpuHours) this.usage.gpuHours += delta.gpuHours;
    if (delta.memoryGBHours) this.usage.memoryGBHours += delta.memoryGBHours;
    if (delta.simulationDurationHours) this.usage.simulationDurationHours += delta.simulationDurationHours;

    const report = this.generateReport();

    // Auto-fire agent notifications for warnings
    for (const warning of report.warnings) {
      if (warning.level === "approaching" || warning.level === "critical" || warning.level === "exceeded") {
        this.emitNotification(warning);
      }
    }

    return report;
  }

  // ── Report Generation ─────────────────────────────────────────────────

  generateReport(): UsageReport {
    const cost = this.estimateCost();
    const warnings = this.checkWarnings();
    const agentInterventionRequired = warnings.some(
      (w) => w.level === "critical" || w.level === "exceeded"
    );

    return {
      tier: this.tier,
      usage: { ...this.usage },
      limits: { ...this.limits },
      cost,
      warnings,
      agentInterventionRequired,
      agentMessage: agentInterventionRequired
        ? this.buildAgentMessage(warnings)
        : null,
    };
  }

  // ── Cost Estimation ───────────────────────────────────────────────────

  estimateCost(): CostEstimate {
    const cpuCost = this.usage.cpuHours * this.limits.costPerCpuHour;
    const gpuCost = this.usage.gpuHours * this.limits.costPerGpuHour;
    const memoryCost = this.usage.memoryGBHours * this.limits.costPerGBHour;

    return {
      cpuCost: round2(cpuCost),
      gpuCost: round2(gpuCost),
      memoryCost: round2(memoryCost),
      totalCost: round2(cpuCost + gpuCost + memoryCost),
      currency: "USD",
    };
  }

  // ── Warning Checks ────────────────────────────────────────────────────

  checkWarnings(): UsageWarning[] {
    const warnings: UsageWarning[] = [];

    const resourceMap: { resource: keyof ComputeUsageSnapshot; limit: number }[] = [
      { resource: "cpuHours", limit: this.limits.cpuHours },
      { resource: "gpuHours", limit: this.limits.gpuHours },
      { resource: "memoryGBHours", limit: this.limits.memoryGB },
      { resource: "simulationDurationHours", limit: this.limits.maxSimulationDurationHours },
    ];

    for (const { resource, limit } of resourceMap) {
      const current = this.usage[resource];
      const percent = limit > 0 ? current / limit : 0;
      const level = this.classifyLevel(percent);

      if (level !== "none") {
        warnings.push({
          resource,
          currentValue: round2(current),
          limit,
          percentUsed: round2(percent * 100),
          level,
          message: this.formatWarningMessage(resource, percent, limit),
        });
      }
    }

    return warnings;
  }

  // ── Getters ───────────────────────────────────────────────────────────

  getUsage(): ComputeUsageSnapshot {
    return { ...this.usage };
  }

  getTier(): UserTier {
    return this.tier;
  }

  getLimits(): TierLimits {
    return { ...this.limits };
  }

  // ── Private ───────────────────────────────────────────────────────────

  private classifyLevel(percent: number): WarningLevel {
    if (percent >= 1) return "exceeded";
    if (percent >= CRITICAL_THRESHOLD) return "critical";
    if (percent >= WARNING_THRESHOLD) return "approaching";
    return "none";
  }

  private formatWarningMessage(resource: keyof ComputeUsageSnapshot, percent: number, limit: number): string {
    const labels: Record<keyof ComputeUsageSnapshot, string> = {
      cpuHours: "CPU hours",
      gpuHours: "GPU hours",
      memoryGBHours: "memory (GB·h)",
      simulationDurationHours: "simulation duration",
    };
    const pct = (percent * 100).toFixed(0);

    if (percent >= 1) {
      return `${labels[resource]} exceeded the ${this.tier} tier limit of ${limit}. Usage is at ${pct}%.`;
    }
    if (percent >= CRITICAL_THRESHOLD) {
      return `${labels[resource]} at ${pct}% of ${this.tier} tier limit (${limit}). Approaching maximum — consider upgrading or optimising.`;
    }
    return `${labels[resource]} at ${pct}% of ${this.tier} tier limit (${limit}).`;
  }

  private buildAgentMessage(warnings: UsageWarning[]): string {
    const critical = warnings.filter((w) => w.level === "critical" || w.level === "exceeded");
    const lines = critical.map((w) => `• ${w.message}`);

    if (critical.some((w) => w.level === "exceeded")) {
      lines.push("\n⚠️ Immediate action required. New simulations may be blocked until usage is resolved.");
    } else {
      lines.push("\n⚡ Consider pausing non-critical simulations or upgrading your tier to avoid interruption.");
    }

    return lines.join("\n");
  }

  private emitNotification(warning: UsageWarning): void {
    const notification = this.warningToNotification(warning);
    for (const listener of this.listeners) {
      try {
        listener(notification);
      } catch {
        // swallow listener errors
      }
    }
  }

  private warningToNotification(warning: UsageWarning): AgentNotification {
    if (warning.level === "exceeded") {
      return {
        severity: "critical",
        title: "Compute Limit Exceeded",
        message: warning.message,
        suggestedAction: `Upgrade from ${this.tier} tier or wait for the billing cycle to reset.`,
        autoAction: "block_new",
      };
    }
    if (warning.level === "critical") {
      return {
        severity: "warning",
        title: "Nearing Compute Limit",
        message: warning.message,
        suggestedAction: "Consider pausing queued simulations to stay within limits.",
        autoAction: "pause_queued",
      };
    }
    return {
      severity: "info",
      title: "Compute Usage Update",
      message: warning.message,
      suggestedAction: "No immediate action needed, but monitor usage.",
      autoAction: "notify_only",
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
