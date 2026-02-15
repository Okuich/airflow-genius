import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MultiRegionConfigService,
  DatabaseLayerAdapter,
  ObjectStorageAdapter,
  GpuSchedulerAdapter,
} from "./multi-region-config-service";

function createMockDb(): DatabaseLayerAdapter {
  return {
    setReadReplica: vi.fn().mockResolvedValue(undefined),
    promoteReplica: vi.fn().mockResolvedValue(undefined),
    enforceResidency: vi.fn().mockResolvedValue(undefined),
    getReplicationLagMs: vi.fn().mockResolvedValue(50),
  };
}

function createMockStorage(): ObjectStorageAdapter {
  return {
    configureBucketReplication: vi.fn().mockResolvedValue(undefined),
    enforceBucketResidency: vi.fn().mockResolvedValue(undefined),
    getBucketRegion: vi.fn().mockResolvedValue("us-east-1"),
  };
}

function createMockGpu(): GpuSchedulerAdapter {
  return {
    activatePool: vi.fn().mockResolvedValue(undefined),
    deactivatePool: vi.fn().mockResolvedValue(undefined),
    getPoolStatus: vi.fn().mockResolvedValue("active"),
    migrateJobs: vi.fn().mockResolvedValue(3),
  };
}

describe("MultiRegionConfigService", () => {
  let db: DatabaseLayerAdapter;
  let storage: ObjectStorageAdapter;
  let gpu: GpuSchedulerAdapter;
  let svc: MultiRegionConfigService;

  beforeEach(() => {
    db = createMockDb();
    storage = createMockStorage();
    gpu = createMockGpu();
    svc = new MultiRegionConfigService(db, storage, gpu);
  });

  it("defaults to us-east-1", () => {
    expect(svc.getActiveRegion().id).toBe("us-east-1");
  });

  it("rejects residency policy with cross-zone regions", async () => {
    await expect(
      svc.setResidencyPolicy({
        zone: "US",
        allowedRegions: ["us-east-1", "eu-west-1"],
        crossRegionReplication: false,
      }),
    ).rejects.toThrow("conflicts with residency zone");
  });

  it("rejects selecting a region not in residency policy", async () => {
    await expect(svc.selectRegion("eu-west-1")).rejects.toThrow("not permitted by residency policy");
  });

  it("rejects GovCloud region without GovCloud residency", async () => {
    await expect(svc.selectRegion("us-gov-west-1")).rejects.toThrow("GovCloud residency policy");
  });

  it("blocks replication when disabled", async () => {
    await expect(
      svc.addReplicationPolicy({
        mode: "async",
        sourceRegion: "us-east-1",
        targetRegion: "eu-west-1",
        lagToleranceMs: 500,
        encryptInTransit: true,
      }),
    ).rejects.toThrow("disabled by the current residency policy");
  });

  it("executes failover and swaps regions", async () => {
    await svc.configureDr({
      primaryRegion: "us-east-1",
      failoverRegion: "eu-west-1",
    });

    const result = await svc.executeFailover();

    expect(result.previousPrimary).toBe("us-east-1");
    expect(result.newPrimary).toBe("eu-west-1");
    expect(result.jobsMigrated).toBe(3);
    expect(db.promoteReplica).toHaveBeenCalledWith("eu-west-1");
    expect(gpu.activatePool).toHaveBeenCalledWith("eu-west-1");
    expect(gpu.deactivatePool).toHaveBeenCalledWith("us-east-1");
    expect(svc.getActiveRegion().id).toBe("eu-west-1");
  });

  it("rejects DR config with same primary and failover", async () => {
    await expect(
      svc.configureDr({ primaryRegion: "us-east-1", failoverRegion: "us-east-1" }),
    ).rejects.toThrow("must differ");
  });

  it("runs health check across all regions", async () => {
    const health = await svc.healthCheck();
    expect(health.activeRegion.id).toBe("us-east-1");
    expect(Object.keys(health.gpuStatus)).toHaveLength(4);
  });
});
