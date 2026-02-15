// ─── packages/model-registry/in-memory-model-registry ────────────────────────
// In-memory implementation of IModelRegistry for testing and development.
// ─────────────────────────────────────────────────────────────────────────────

import type { SurrogateModelType } from "@/packages/types";
import type { IModelRegistry } from "./model-registry";
import type { ModelVersion, SaveVersionOptions } from "./types";

export class InMemoryModelRegistry implements IModelRegistry {
  private readonly versions: ModelVersion[] = [];

  async getActiveModel(
    orgId: string,
    modelType: SurrogateModelType
  ): Promise<ModelVersion | null> {
    return (
      this.versions.find(
        (m) =>
          m.organizationId === orgId &&
          m.modelType === modelType &&
          m.isActive
      ) ?? null
    );
  }

  async saveVersion(options: SaveVersionOptions): Promise<ModelVersion> {
    const { organizationId: orgId, modelType, weights, normalization, metrics } = options;

    // Deactivate previous
    for (const m of this.versions) {
      if (m.organizationId === orgId && m.modelType === modelType) {
        m.isActive = false;
      }
    }

    // Find next version
    const existing = this.versions.filter(
      (m) => m.organizationId === orgId && m.modelType === modelType
    );
    const nextVersion = existing.length > 0
      ? Math.max(...existing.map((m) => m.version)) + 1
      : 1;

    const model: ModelVersion = {
      id: crypto.randomUUID(),
      organizationId: orgId,
      modelType,
      version: nextVersion,
      weights,
      normalization,
      metrics,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.versions.push(model);
    return model;
  }

  async listVersions(
    orgId: string,
    modelType: SurrogateModelType
  ): Promise<ModelVersion[]> {
    return this.versions
      .filter((m) => m.organizationId === orgId && m.modelType === modelType)
      .sort((a, b) => b.version - a.version);
  }

  /** Reset all versions (test utility). */
  clear(): void {
    this.versions.length = 0;
  }
}
