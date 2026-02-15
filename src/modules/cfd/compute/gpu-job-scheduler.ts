// ─── GPU Job Scheduler ──────────────────────────────────────────────────────
// Classifies simulation workloads, assigns GPU/CPU resources, tracks
// real-time GPU utilisation, and exposes scaling hooks for autoscalers.
// ─────────────────────────────────────────────────────────────────────────────

import type { SimulationConfig } from "@/packages/types";
import { getEventBus, type PlatformEventBus } from "@/packages/events";

// ── Enums ───────────────────────────────────────────────────────────────────

export enum JobPriority {
  Low = "low",
  Normal = "normal",
  High = "high",
  Critical = "critical",
}

export enum SimulationSize {
  Small = "small",       // < 500K cells
  Medium = "medium",     // 500K – 2M cells
  Large = "large",       // 2M – 10M cells
  Massive = "massive",   // > 10M cells
}

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ResourceAllocation {
  jobId: string;
  simulationId: string;
  size: SimulationSize;
  priority: JobPriority;
  gpuCount: number;
  cpuCores: number;
  memoryGB: number;
  estimatedDurationMinutes: number;
  assignedAt: string;
}

export interface GPUMetrics {
  totalGPUs: number;
  allocatedGPUs: number;
  availableGPUs: number;
  utilizationPercent: number;
  queueDepth: number;
  activeJobs: number;
  avgWaitTimeMs: number;
}

export interface SchedulerConfig {
  /** Total GPU capacity in the cluster. Default 8. */
  totalGPUs: number;
  /** Total CPU cores available. Default 128. */
  totalCPUCores: number;
  /** Total memory in GB. Default 512. */
  totalMemoryGB: number;
  /** Max jobs that can queue before rejecting. Default 50. */
  maxQueueDepth: number;
  /** Enable priority preemption for Critical jobs. Default true. */
  enablePreemption: boolean;
}

export interface ScalingHook {
  /** Called when utilisation exceeds this threshold (0–1). */
  triggerThreshold: number;
  /** Called when utilisation drops below this threshold (0–1). */
  cooldownThreshold: number;
  onScaleUp: (metrics: GPUMetrics, deficit: number) => void | Promise<void>;
  onScaleDown: (metrics: GPUMetrics, surplus: number) => void | Promise<void>;
}

interface QueuedJob {
  allocation: ResourceAllocation;
  enqueuedAt: number;
}

// ── Defaults ────────────────────────────────────────────────────────────────

const SCHEDULER_DEFAULTS: SchedulerConfig = {
  totalGPUs: 8,
  totalCPUCores: 128,
  totalMemoryGB: 512,
  maxQueueDepth: 50,
  enablePreemption: true,
};

// Size → base resource table
const SIZE_RESOURCE_MAP: Record<SimulationSize, { gpus: number; cpus: number; memGB: number; estMinutes: number }> = {
  [SimulationSize.Small]:   { gpus: 0, cpus: 4,  memGB: 8,   estMinutes: 15 },
  [SimulationSize.Medium]:  { gpus: 1, cpus: 8,  memGB: 16,  estMinutes: 60 },
  [SimulationSize.Large]:   { gpus: 2, cpus: 16, memGB: 64,  estMinutes: 180 },
  [SimulationSize.Massive]: { gpus: 4, cpus: 32, memGB: 128, estMinutes: 480 },
};

// Priority multiplier for estimated duration (higher priority → tighter SLA)
const PRIORITY_WEIGHT: Record<JobPriority, number> = {
  [JobPriority.Low]: 1.5,
  [JobPriority.Normal]: 1.0,
  [JobPriority.High]: 0.8,
  [JobPriority.Critical]: 0.5,
};

// ── Scheduler ───────────────────────────────────────────────────────────────

export class GPUJobScheduler {
  private readonly config: SchedulerConfig;
  private readonly bus: PlatformEventBus;
  private readonly activeJobs = new Map<string, ResourceAllocation>();
  private readonly queue: QueuedJob[] = [];
  private readonly scalingHooks: ScalingHook[] = [];
  private allocatedGPUs = 0;
  private allocatedCPUs = 0;
  private allocatedMemoryGB = 0;
  private jobCounter = 0;

  constructor(
    config?: Partial<SchedulerConfig>,
    deps?: { bus?: PlatformEventBus }
  ) {
    this.config = { ...SCHEDULER_DEFAULTS, ...config };
    this.bus = deps?.bus ?? getEventBus();
  }

  // ── Classification ────────────────────────────────────────────────────

  classifySize(config: SimulationConfig): SimulationSize {
    const cells = config.meshSettings.targetCellCount;
    if (cells > 10_000_000) return SimulationSize.Massive;
    if (cells > 2_000_000) return SimulationSize.Large;
    if (cells > 500_000) return SimulationSize.Medium;
    return SimulationSize.Small;
  }

  // ── Resource Assignment ───────────────────────────────────────────────

  allocate(
    simulationId: string,
    config: SimulationConfig,
    priority: JobPriority = JobPriority.Normal
  ): ResourceAllocation | null {
    const size = this.classifySize(config);
    const base = SIZE_RESOURCE_MAP[size];
    const isTransient = config.flowType === "transient";
    const hasRotating = !!config.rotatingFrame?.enabled;

    // Adjust resources for complexity
    let gpuCount = base.gpus;
    let cpuCores = base.cpus;
    let memoryGB = base.memGB;
    let estMinutes = base.estMinutes;

    if (isTransient) {
      cpuCores = Math.min(this.config.totalCPUCores, cpuCores * 2);
      memoryGB = Math.round(memoryGB * 1.5);
      estMinutes *= 2;
    }
    if (hasRotating && gpuCount > 0) {
      gpuCount = Math.min(this.config.totalGPUs, gpuCount + 1);
    }

    estMinutes = Math.round(estMinutes * PRIORITY_WEIGHT[priority]);

    const allocation: ResourceAllocation = {
      jobId: `gpu-job-${++this.jobCounter}`,
      simulationId,
      size,
      priority,
      gpuCount,
      cpuCores,
      memoryGB,
      estimatedDurationMinutes: estMinutes,
      assignedAt: new Date().toISOString(),
    };

    // Check capacity
    if (!this.hasCapacity(allocation)) {
      // Try preemption for critical jobs
      if (this.config.enablePreemption && priority === JobPriority.Critical) {
        this.preemptForJob(allocation);
        if (!this.hasCapacity(allocation)) {
          return this.enqueueOrReject(allocation);
        }
      } else {
        return this.enqueueOrReject(allocation);
      }
    }

    this.commitAllocation(allocation);
    this.checkScalingHooks();
    return allocation;
  }

  // ── Release ───────────────────────────────────────────────────────────

  release(jobId: string): boolean {
    const alloc = this.activeJobs.get(jobId);
    if (!alloc) return false;

    this.allocatedGPUs -= alloc.gpuCount;
    this.allocatedCPUs -= alloc.cpuCores;
    this.allocatedMemoryGB -= alloc.memoryGB;
    this.activeJobs.delete(jobId);

    // Drain queue
    this.drainQueue();
    this.checkScalingHooks();
    return true;
  }

  // ── Metrics ───────────────────────────────────────────────────────────

  getMetrics(): GPUMetrics {
    const now = Date.now();
    const avgWaitTimeMs =
      this.queue.length > 0
        ? this.queue.reduce((sum, q) => sum + (now - q.enqueuedAt), 0) / this.queue.length
        : 0;

    return {
      totalGPUs: this.config.totalGPUs,
      allocatedGPUs: this.allocatedGPUs,
      availableGPUs: this.config.totalGPUs - this.allocatedGPUs,
      utilizationPercent: this.config.totalGPUs > 0
        ? Math.round((this.allocatedGPUs / this.config.totalGPUs) * 10000) / 100
        : 0,
      queueDepth: this.queue.length,
      activeJobs: this.activeJobs.size,
      avgWaitTimeMs: Math.round(avgWaitTimeMs),
    };
  }

  // ── Scaling Hooks ─────────────────────────────────────────────────────

  registerScalingHook(hook: ScalingHook): () => void {
    this.scalingHooks.push(hook);
    return () => {
      const idx = this.scalingHooks.indexOf(hook);
      if (idx >= 0) this.scalingHooks.splice(idx, 1);
    };
  }

  /** Simulate adding GPUs (e.g. from autoscaler callback). */
  addCapacity(gpus: number, cpuCores: number, memoryGB: number): void {
    this.config.totalGPUs += gpus;
    this.config.totalCPUCores += cpuCores;
    this.config.totalMemoryGB += memoryGB;
    this.drainQueue();
  }

  /** Simulate removing GPUs (scale-down). Only reduces capacity, doesn't evict. */
  removeCapacity(gpus: number, cpuCores: number, memoryGB: number): void {
    this.config.totalGPUs = Math.max(this.allocatedGPUs, this.config.totalGPUs - gpus);
    this.config.totalCPUCores = Math.max(this.allocatedCPUs, this.config.totalCPUCores - cpuCores);
    this.config.totalMemoryGB = Math.max(this.allocatedMemoryGB, this.config.totalMemoryGB - memoryGB);
  }

  // ── Queue / Active Accessors ──────────────────────────────────────────

  getActiveJobs(): ResourceAllocation[] {
    return [...this.activeJobs.values()];
  }

  getQueuedJobs(): ResourceAllocation[] {
    return this.queue.map((q) => q.allocation);
  }

  // ── Private ───────────────────────────────────────────────────────────

  private hasCapacity(alloc: ResourceAllocation): boolean {
    return (
      this.allocatedGPUs + alloc.gpuCount <= this.config.totalGPUs &&
      this.allocatedCPUs + alloc.cpuCores <= this.config.totalCPUCores &&
      this.allocatedMemoryGB + alloc.memoryGB <= this.config.totalMemoryGB
    );
  }

  private commitAllocation(alloc: ResourceAllocation): void {
    this.allocatedGPUs += alloc.gpuCount;
    this.allocatedCPUs += alloc.cpuCores;
    this.allocatedMemoryGB += alloc.memoryGB;
    this.activeJobs.set(alloc.jobId, alloc);
  }

  private enqueueOrReject(alloc: ResourceAllocation): ResourceAllocation | null {
    if (this.queue.length >= this.config.maxQueueDepth) {
      return null; // Queue full — reject
    }
    this.queue.push({ allocation: alloc, enqueuedAt: Date.now() });
    // Sort queue by priority (Critical first)
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    this.queue.sort((a, b) =>
      priorityOrder[a.allocation.priority] - priorityOrder[b.allocation.priority]
    );
    return alloc; // Returns allocation but it's queued, not active
  }

  private drainQueue(): void {
    let i = 0;
    while (i < this.queue.length) {
      const queued = this.queue[i];
      if (this.hasCapacity(queued.allocation)) {
        this.queue.splice(i, 1);
        this.commitAllocation(queued.allocation);
      } else {
        i++;
      }
    }
  }

  private preemptForJob(incoming: ResourceAllocation): void {
    // Evict lowest-priority active jobs until capacity is available
    const active = [...this.activeJobs.values()];
    const priorityOrder = { low: 0, normal: 1, high: 2, critical: 3 };
    active.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    for (const job of active) {
      if (this.hasCapacity(incoming)) break;
      if (priorityOrder[job.priority] < priorityOrder[incoming.priority]) {
        this.release(job.jobId);
        // Re-queue the preempted job
        this.queue.push({ allocation: job, enqueuedAt: Date.now() });
      }
    }
  }

  private checkScalingHooks(): void {
    const metrics = this.getMetrics();
    const utilization = metrics.utilizationPercent / 100;

    for (const hook of this.scalingHooks) {
      if (utilization >= hook.triggerThreshold) {
        const deficit = this.queue.reduce((sum, q) => sum + q.allocation.gpuCount, 0);
        if (deficit > 0) {
          Promise.resolve(hook.onScaleUp(metrics, deficit)).catch(() => {});
        }
      } else if (utilization <= hook.cooldownThreshold) {
        const surplus = metrics.availableGPUs;
        if (surplus > 0) {
          Promise.resolve(hook.onScaleDown(metrics, surplus)).catch(() => {});
        }
      }
    }
  }
}
