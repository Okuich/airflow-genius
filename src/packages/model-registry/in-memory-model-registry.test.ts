import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryModelRegistry } from "./in-memory-model-registry";
import type { SaveVersionOptions } from "./types";

const makeOpts = (overrides?: Partial<SaveVersionOptions>): SaveVersionOptions => ({
  organizationId: "org-1",
  modelType: "pressure_drop",
  weights: { coefficients: [0.5, -0.3, 0.1], intercept: 2.5, featureNames: ["a", "b", "c"] },
  normalization: { mean: [0, 0, 0], std: [1, 1, 1], featureNames: ["a", "b", "c"] },
  metrics: { mse: 0.01, mae: 0.08, r2: 0.92, sampleCount: 50, trainedAt: new Date().toISOString() },
  ...overrides,
});

describe("InMemoryModelRegistry", () => {
  let registry: InMemoryModelRegistry;

  beforeEach(() => {
    registry = new InMemoryModelRegistry();
  });

  it("returns null when no model exists", async () => {
    expect(await registry.getActiveModel("org-1", "pressure_drop")).toBeNull();
  });

  it("saves and retrieves active model", async () => {
    const saved = await registry.saveVersion(makeOpts());
    expect(saved.version).toBe(1);
    expect(saved.isActive).toBe(true);

    const active = await registry.getActiveModel("org-1", "pressure_drop");
    expect(active?.id).toBe(saved.id);
  });

  it("increments version and deactivates previous", async () => {
    const v1 = await registry.saveVersion(makeOpts());
    const v2 = await registry.saveVersion(makeOpts());

    expect(v2.version).toBe(2);

    const active = await registry.getActiveModel("org-1", "pressure_drop");
    expect(active?.version).toBe(2);

    const all = await registry.listVersions("org-1", "pressure_drop");
    expect(all).toHaveLength(2);
    expect(all[0].version).toBe(2);
    expect(all[0].isActive).toBe(true);
    expect(all[1].isActive).toBe(false);
  });

  it("isolates by org and model type", async () => {
    await registry.saveVersion(makeOpts({ organizationId: "org-1", modelType: "pressure_drop" }));
    await registry.saveVersion(makeOpts({ organizationId: "org-1", modelType: "convergence" }));
    await registry.saveVersion(makeOpts({ organizationId: "org-2", modelType: "pressure_drop" }));

    expect(await registry.listVersions("org-1", "pressure_drop")).toHaveLength(1);
    expect(await registry.listVersions("org-1", "convergence")).toHaveLength(1);
    expect(await registry.listVersions("org-2", "pressure_drop")).toHaveLength(1);
    expect(await registry.getActiveModel("org-2", "convergence")).toBeNull();
  });

  it("clears all versions", async () => {
    await registry.saveVersion(makeOpts());
    registry.clear();
    expect(await registry.listVersions("org-1", "pressure_drop")).toHaveLength(0);
  });
});
