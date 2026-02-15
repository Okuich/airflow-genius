// ─── Multi-Region Configuration Service ────────────────────────────────────
//
// Manages region selection, data residency enforcement, cross-region
// replication policies, and disaster-recovery configuration.  Integrates
// with the database layer, object storage layer, and GPU scheduler.
// ────────────────────────────────────────────────────────────────────────────

export type RegionId = "us-east-1" | "eu-west-1" | "us-gov-west-1" | "ap-southeast-1";

export type ResidencyZone = "US" | "EU" | "APAC" | "GovCloud";

export type ReplicationMode = "sync" | "async" | "none";

export type DrStrategy = "active-passive" | "active-active" | "pilot-light";

// ── Core Contracts ──────────────────────────────────────────────────────────

export interface DataResidencyPolicy {
  zone: ResidencyZone;
  allowedRegions: RegionId[];
  crossRegionReplication: boolean;
  backupRegion?: RegionId;
}

export interface ReplicationPolicy {
  mode: ReplicationMode;
  sourceRegion: RegionId;
  targetRegion: RegionId;
  lagToleranceMs: number;
  encryptInTransit: boolean;
}

export interface DrConfig {
  strategy: DrStrategy;
  primaryRegion: RegionId;
  failoverRegion: RegionId;
  rtoSeconds: number;        // recovery-time objective
  rpoSeconds: number;        // recovery-point objective
  autoFailover: boolean;
  healthCheckIntervalMs: number;
}

export interface RegionEndpoints {
  database: string;
  objectStorage: string;
  gpuScheduler: string;
}

export interface RegionDescriptor {
  id: RegionId;
  zone: ResidencyZone;
  endpoints: RegionEndpoints;
  isolated: boolean;
}

// ── Integration Interfaces ──────────────────────────────────────────────────

export interface DatabaseLayerAdapter {
  setReadReplica(source: RegionId, target: RegionId, mode: ReplicationMode): Promise<void>;
  promoteReplica(region: RegionId): Promise<void>;
  enforceResidency(policy: DataResidencyPolicy): Promise<void>;
  getReplicationLagMs(source: RegionId, target: RegionId): Promise<number>;
}

export interface ObjectStorageAdapter {
  configureBucketReplication(
    bucket: string,
    source: RegionId,
    target: RegionId,
    encrypt: boolean,
  ): Promise<void>;
  enforceBucketResidency(bucket: string, allowedRegions: RegionId[]): Promise<void>;
  getBucketRegion(bucket: string): Promise<RegionId>;
}

export interface GpuSchedulerAdapter {
  activatePool(region: RegionId): Promise<void>;
  deactivatePool(region: RegionId): Promise<void>;
  getPoolStatus(region: RegionId): Promise<"active" | "warm-standby" | "cold">;
  migrateJobs(source: RegionId, target: RegionId): Promise<number>;
}

// ── Service Implementation ──────────────────────────────────────────────────

const REGION_CATALOG: Record<RegionId, RegionDescriptor> = {
  "us-east-1": {
    id: "us-east-1",
    zone: "US",
    isolated: false,
    endpoints: {
      database: "db.us-east-1.flowforge.internal",
      objectStorage: "s3.us-east-1.flowforge.internal",
      gpuScheduler: "gpu.us-east-1.flowforge.internal",
    },
  },
  "eu-west-1": {
    id: "eu-west-1",
    zone: "EU",
    isolated: false,
    endpoints: {
      database: "db.eu-west-1.flowforge.internal",
      objectStorage: "s3.eu-west-1.flowforge.internal",
      gpuScheduler: "gpu.eu-west-1.flowforge.internal",
    },
  },
  "us-gov-west-1": {
    id: "us-gov-west-1",
    zone: "GovCloud",
    isolated: true,
    endpoints: {
      database: "db.us-gov-west-1.flowforge.gov",
      objectStorage: "s3.us-gov-west-1.flowforge.gov",
      gpuScheduler: "gpu.us-gov-west-1.flowforge.gov",
    },
  },
  "ap-southeast-1": {
    id: "ap-southeast-1",
    zone: "APAC",
    isolated: false,
    endpoints: {
      database: "db.ap-southeast-1.flowforge.internal",
      objectStorage: "s3.ap-southeast-1.flowforge.internal",
      gpuScheduler: "gpu.ap-southeast-1.flowforge.internal",
    },
  },
};

export class MultiRegionConfigService {
  private activeRegion: RegionId;
  private residencyPolicy: DataResidencyPolicy;
  private replicationPolicies: ReplicationPolicy[] = [];
  private drConfig: DrConfig;

  constructor(
    private readonly db: DatabaseLayerAdapter,
    private readonly storage: ObjectStorageAdapter,
    private readonly gpu: GpuSchedulerAdapter,
    initialConfig?: {
      region?: RegionId;
      residency?: DataResidencyPolicy;
      dr?: Partial<DrConfig>;
    },
  ) {
    this.activeRegion = initialConfig?.region ?? "us-east-1";

    this.residencyPolicy = initialConfig?.residency ?? {
      zone: "US",
      allowedRegions: ["us-east-1"],
      crossRegionReplication: false,
    };

    this.drConfig = {
      strategy: "active-passive",
      primaryRegion: this.activeRegion,
      failoverRegion: "eu-west-1",
      rtoSeconds: 300,
      rpoSeconds: 60,
      autoFailover: false,
      healthCheckIntervalMs: 10_000,
      ...initialConfig?.dr,
    };
  }

  // ── Region Selection ────────────────────────────────────────────────────

  getActiveRegion(): RegionDescriptor {
    return REGION_CATALOG[this.activeRegion];
  }

  getAvailableRegions(): RegionDescriptor[] {
    return Object.values(REGION_CATALOG);
  }

  async selectRegion(regionId: RegionId): Promise<void> {
    const target = REGION_CATALOG[regionId];
    if (!target) throw new Error(`Unknown region: ${regionId}`);

    if (target.isolated && this.residencyPolicy.zone !== "GovCloud") {
      throw new Error("GovCloud region requires GovCloud residency policy");
    }

    if (!this.residencyPolicy.allowedRegions.includes(regionId)) {
      throw new Error(
        `Region ${regionId} is not permitted by residency policy (zone: ${this.residencyPolicy.zone})`,
      );
    }

    this.activeRegion = regionId;
  }

  // ── Data Residency ──────────────────────────────────────────────────────

  getResidencyPolicy(): DataResidencyPolicy {
    return { ...this.residencyPolicy };
  }

  async setResidencyPolicy(policy: DataResidencyPolicy): Promise<void> {
    // Validate: all allowed regions must belong to the declared zone
    for (const r of policy.allowedRegions) {
      const desc = REGION_CATALOG[r];
      if (!desc) throw new Error(`Unknown region in allowedRegions: ${r}`);
      if (desc.zone !== policy.zone) {
        throw new Error(
          `Region ${r} (zone ${desc.zone}) conflicts with residency zone ${policy.zone}`,
        );
      }
    }

    // Enforce on database layer
    await this.db.enforceResidency(policy);

    // Enforce on every bucket in allowed regions
    const bucketRegionChecks = policy.allowedRegions.map(async (r) => {
      await this.storage.enforceBucketResidency("simulation-results", policy.allowedRegions);
      await this.storage.enforceBucketResidency("ml-artifacts", policy.allowedRegions);
      await this.storage.enforceBucketResidency("audit-logs", policy.allowedRegions);
    });
    await Promise.all(bucketRegionChecks);

    this.residencyPolicy = policy;
  }

  // ── Cross-Region Replication ────────────────────────────────────────────

  getReplicationPolicies(): ReplicationPolicy[] {
    return this.replicationPolicies.map((p) => ({ ...p }));
  }

  async addReplicationPolicy(policy: ReplicationPolicy): Promise<void> {
    if (!this.residencyPolicy.crossRegionReplication) {
      throw new Error("Cross-region replication is disabled by the current residency policy");
    }

    const sourceDesc = REGION_CATALOG[policy.sourceRegion];
    const targetDesc = REGION_CATALOG[policy.targetRegion];

    if (sourceDesc.isolated || targetDesc.isolated) {
      throw new Error("Replication to/from an isolated (GovCloud) region is forbidden");
    }

    // Database replication
    await this.db.setReadReplica(policy.sourceRegion, policy.targetRegion, policy.mode);

    // Storage replication
    await this.storage.configureBucketReplication(
      "simulation-results",
      policy.sourceRegion,
      policy.targetRegion,
      policy.encryptInTransit,
    );

    this.replicationPolicies.push(policy);
  }

  async removeReplicationPolicy(source: RegionId, target: RegionId): Promise<void> {
    this.replicationPolicies = this.replicationPolicies.filter(
      (p) => !(p.sourceRegion === source && p.targetRegion === target),
    );

    await this.db.setReadReplica(source, target, "none");
  }

  async getReplicationHealth(): Promise<
    { source: RegionId; target: RegionId; lagMs: number; withinTolerance: boolean }[]
  > {
    return Promise.all(
      this.replicationPolicies.map(async (p) => {
        const lagMs = await this.db.getReplicationLagMs(p.sourceRegion, p.targetRegion);
        return {
          source: p.sourceRegion,
          target: p.targetRegion,
          lagMs,
          withinTolerance: lagMs <= p.lagToleranceMs,
        };
      }),
    );
  }

  // ── Disaster Recovery ─────────────────────────────────────────────────

  getDrConfig(): DrConfig {
    return { ...this.drConfig };
  }

  async configureDr(update: Partial<DrConfig>): Promise<void> {
    const next = { ...this.drConfig, ...update };

    if (next.primaryRegion === next.failoverRegion) {
      throw new Error("Primary and failover regions must differ");
    }

    const primaryDesc = REGION_CATALOG[next.primaryRegion];
    const failoverDesc = REGION_CATALOG[next.failoverRegion];

    if (primaryDesc.isolated !== failoverDesc.isolated) {
      throw new Error("Cannot mix isolated and non-isolated regions in a DR pair");
    }

    this.drConfig = next;
  }

  async executeFailover(): Promise<{
    previousPrimary: RegionId;
    newPrimary: RegionId;
    jobsMigrated: number;
  }> {
    const prev = this.drConfig.primaryRegion;
    const next = this.drConfig.failoverRegion;

    // 1. Promote database replica
    await this.db.promoteReplica(next);

    // 2. Activate GPU pool in failover region
    await this.gpu.activatePool(next);

    // 3. Migrate in-flight GPU jobs
    const jobsMigrated = await this.gpu.migrateJobs(prev, next);

    // 4. Deactivate old primary GPU pool
    await this.gpu.deactivatePool(prev);

    // 5. Swap DR config
    this.drConfig = {
      ...this.drConfig,
      primaryRegion: next,
      failoverRegion: prev,
    };
    this.activeRegion = next;

    return { previousPrimary: prev, newPrimary: next, jobsMigrated };
  }

  // ── Diagnostics ───────────────────────────────────────────────────────

  async healthCheck(): Promise<{
    activeRegion: RegionDescriptor;
    gpuStatus: Record<RegionId, "active" | "warm-standby" | "cold">;
    replication: Awaited<ReturnType<MultiRegionConfigService["getReplicationHealth"]>>;
  }> {
    const regions = this.getAvailableRegions();

    const gpuEntries = await Promise.all(
      regions.map(async (r) => [r.id, await this.gpu.getPoolStatus(r.id)] as const),
    );

    const gpuStatus = Object.fromEntries(gpuEntries) as Record<
      RegionId,
      "active" | "warm-standby" | "cold"
    >;

    return {
      activeRegion: this.getActiveRegion(),
      gpuStatus,
      replication: await this.getReplicationHealth(),
    };
  }
}
