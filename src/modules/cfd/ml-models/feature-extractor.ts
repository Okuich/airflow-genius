// ─── Step 2: Feature Extraction ────────────────────────────────────────────
// Converts a SimulationConfig into a flat numeric feature vector
// suitable for surrogate model training & inference.
// ──────────────────────────────────────────────────────────────────────────

import type {
  SimulationConfig,
  SimulationFeatureVector,
  SimulationCompletedEvent,
  BoundaryType,
} from "@/packages/types";
import { FlowType, TurbulenceType } from "@/packages/types";

const TURBULENCE_INDEX: Record<string, number> = {
  [TurbulenceType.KEpsilon]: 0,
  [TurbulenceType.KEpsilonRNG]: 1,
  [TurbulenceType.SST]: 2,
  [TurbulenceType.SpalartAllmaras]: 3,
};

export class FeatureExtractor {
  static readonly FEATURE_NAMES: (keyof SimulationFeatureVector)[] = [
    "cellCount", "baseSize", "refinementLevels", "boundaryLayerCount",
    "boundaryLayerGrowthRate", "qualityThreshold",
    "flowType", "turbulenceModel", "maxIterations", "convergenceCriteria",
    "relaxationPressure", "relaxationVelocity", "relaxationTurbulence",
    "fluidDensity", "fluidViscosity", "reynoldsNumber",
    "inletCount", "outletCount", "wallCount",
    "maxInletVelocity", "avgInletVelocity",
    "hasRotatingFrame", "rpm",
  ];

  /** Extract feature vector from a simulation config. */
  extract(config: SimulationConfig): SimulationFeatureVector {
    const bcs = config.boundaryConditions;

    const inlets = bcs.filter((bc) =>
      bc.type === ("inlet" as BoundaryType) ||
      bc.type === ("velocity_inlet" as BoundaryType) ||
      bc.type === ("pressure_inlet" as BoundaryType)
    );
    const outlets = bcs.filter((bc) =>
      bc.type === ("outlet" as BoundaryType) ||
      bc.type === ("pressure_outlet" as BoundaryType)
    );
    const walls = bcs.filter((bc) =>
      bc.type === ("wall" as BoundaryType) ||
      bc.type === ("rotating_wall" as BoundaryType)
    );

    const inletVelocities = inlets
      .filter((bc) => bc.velocity)
      .map((bc) => Math.sqrt(bc.velocity!.x ** 2 + bc.velocity!.y ** 2 + bc.velocity!.z ** 2));

    const maxInletVelocity = inletVelocities.length > 0 ? Math.max(...inletVelocities) : 0;
    const avgInletVelocity = inletVelocities.length > 0
      ? inletVelocities.reduce((a, b) => a + b, 0) / inletVelocities.length : 0;

    // Estimate Reynolds number: Re = ρ * V * L / μ  (L ≈ baseSize as characteristic length)
    const charLength = config.meshSettings.baseSize;
    const reynoldsNumber = config.fluidDensity * avgInletVelocity * charLength / config.fluidViscosity;

    return {
      cellCount: config.meshSettings.targetCellCount,
      baseSize: config.meshSettings.baseSize,
      refinementLevels: config.meshSettings.refinementLevels,
      boundaryLayerCount: config.meshSettings.boundaryLayerCount,
      boundaryLayerGrowthRate: config.meshSettings.boundaryLayerGrowthRate,
      qualityThreshold: config.meshSettings.qualityThreshold,
      flowType: config.flowType === FlowType.Steady ? 0 : 1,
      turbulenceModel: TURBULENCE_INDEX[config.turbulenceModel.type] ?? 0,
      maxIterations: config.solverSettings.maxIterations,
      convergenceCriteria: config.solverSettings.convergenceCriteria,
      relaxationPressure: config.solverSettings.relaxationPressure,
      relaxationVelocity: config.solverSettings.relaxationVelocity,
      relaxationTurbulence: config.solverSettings.relaxationTurbulence,
      fluidDensity: config.fluidDensity,
      fluidViscosity: config.fluidViscosity,
      reynoldsNumber,
      inletCount: inlets.length,
      outletCount: outlets.length,
      wallCount: walls.length,
      maxInletVelocity,
      avgInletVelocity,
      hasRotatingFrame: config.rotatingFrame?.enabled ? 1 : 0,
      rpm: config.rotatingFrame?.rotationSpeed ?? 0,
    };
  }

  /** Extract from a completed-event payload (convenience). */
  extractFromEvent(event: SimulationCompletedEvent): SimulationFeatureVector {
    return this.extract(event.config);
  }

  /** Convert a feature vector to a flat number array (ordered by FEATURE_NAMES). */
  toArray(features: SimulationFeatureVector): number[] {
    return FeatureExtractor.FEATURE_NAMES.map((k) => features[k]);
  }
}
