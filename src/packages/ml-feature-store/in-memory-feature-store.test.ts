import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryFeatureStore } from "./in-memory-feature-store";
import type { FeatureVector } from "@/packages/types";
import type { IngestOptions } from "./types";

const toArray = (fv: FeatureVector): number[] => [
  fv.reynoldsNumber, fv.turbulenceIntensity, fv.pressureDrop,
  fv.efficiency, fv.meshQualityScore, fv.convergenceSpeed,
];

const makeFV = (overrides?: Partial<FeatureVector>): FeatureVector => ({
  reynoldsNumber: 50000,
  turbulenceIntensity: 0.05,
  pressureDrop: 245,
  efficiency: 0.67,
  meshQualityScore: 0.85,
  convergenceSpeed: 0.7,
  ...overrides,
});

const makeIngestOpts = (overrides?: Partial<IngestOptions>): IngestOptions => ({
  organizationId: "org-1",
  simulationId: "sim-1",
  featureVersion: "v1",
  featureVector: makeFV(),
  labels: { pressureDrop: 245, converged: 1, efficiency: 0.67 },
  geometryCluster: "internal-flow",
  ...overrides,
});

describe("InMemoryFeatureStore", () => {
  let store: InMemoryFeatureStore;

  beforeEach(() => {
    store = new InMemoryFeatureStore(toArray);
  });

  it("ingests and returns an ID", async () => {
    const id = await store.ingest(makeIngestOpts());
    expect(id).toBeTruthy();
  });

  it("queries by organization", async () => {
    await store.ingest(makeIngestOpts({ organizationId: "org-1" }));
    await store.ingest(makeIngestOpts({ organizationId: "org-2" }));
    const results = await store.query({ organizationId: "org-1" });
    expect(results).toHaveLength(1);
  });

  it("filters by geometry cluster", async () => {
    await store.ingest(makeIngestOpts({ geometryCluster: "internal-flow" }));
    await store.ingest(makeIngestOpts({ geometryCluster: "external-flow" }));
    const results = await store.query({ organizationId: "org-1", geometryCluster: "internal-flow" });
    expect(results).toHaveLength(1);
    expect(results[0].geometryCluster).toBe("internal-flow");
  });

  it("respects limit", async () => {
    for (let i = 0; i < 5; i++) {
      await store.ingest(makeIngestOpts({ simulationId: `sim-${i}` }));
    }
    const results = await store.query({ organizationId: "org-1", limit: 3 });
    expect(results).toHaveLength(3);
  });

  it("returns training pairs filtering null targets", async () => {
    await store.ingest(makeIngestOpts({
      labels: { pressureDrop: 100, converged: null },
    }));
    await store.ingest(makeIngestOpts({
      labels: { pressureDrop: 200, converged: 1 },
    }));

    const pairs = await store.getTrainingData("org-1", "converged");
    expect(pairs).toHaveLength(1);
    expect(pairs[0].target).toBe(1);
    expect(pairs[0].features).toHaveLength(6);
  });

  it("counts entries per org", async () => {
    await store.ingest(makeIngestOpts({ organizationId: "org-1" }));
    await store.ingest(makeIngestOpts({ organizationId: "org-1" }));
    await store.ingest(makeIngestOpts({ organizationId: "org-2" }));
    expect(await store.count("org-1")).toBe(2);
    expect(await store.count("org-2")).toBe(1);
  });

  it("clears all entries", async () => {
    await store.ingest(makeIngestOpts());
    store.clear();
    expect(await store.count("org-1")).toBe(0);
  });
});
