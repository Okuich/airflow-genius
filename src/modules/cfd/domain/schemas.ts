import { z } from "zod";
import { FlowType, TurbulenceType, BoundaryType } from "./models";

// ─── Primitives ─────────────────────────────────────────────────────────────

export const Vector3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});

// ─── Turbulence ─────────────────────────────────────────────────────────────

export const TurbulenceModelSchema = z
  .object({
    type: z.nativeEnum(TurbulenceType),
    wallFunction: z.boolean(),
    turbulentIntensity: z.number().min(0).max(1),
    turbulentViscosityRatio: z.number().positive(),
    kInitial: z.number().positive(),
    epsilonInitial: z.number().positive().optional(),
    omegaInitial: z.number().positive().optional(),
  })
  .refine(
    (d) =>
      (d.type === TurbulenceType.KEpsilon && d.epsilonInitial !== undefined) ||
      (d.type === TurbulenceType.SST && d.omegaInitial !== undefined),
    { message: "k-epsilon requires epsilonInitial; SST requires omegaInitial" }
  );

// ─── Boundary Conditions ────────────────────────────────────────────────────

export const BoundaryConditionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: z.nativeEnum(BoundaryType),
  surfaceIds: z.array(z.string().min(1)).min(1),
  velocity: Vector3Schema.optional(),
  pressure: z.number().optional(),
  temperature: z.number().positive().optional(),
  heatFlux: z.number().optional(),
  turbulentIntensity: z.number().min(0).max(1).optional(),
  hydraulicDiameter: z.number().positive().optional(),
});

// ─── Mesh ───────────────────────────────────────────────────────────────────

export const MeshSettingsSchema = z
  .object({
    baseSize: z.number().positive(),
    minSize: z.number().positive(),
    maxSize: z.number().positive(),
    refinementLevels: z.number().int().min(0).max(10),
    boundaryLayerCount: z.number().int().min(0).max(30),
    boundaryLayerGrowthRate: z.number().min(1).max(2),
    targetCellCount: z.number().int().positive(),
    featureAngle: z.number().min(0).max(180),
    qualityThreshold: z.number().min(0).max(1),
  })
  .refine((d) => d.minSize <= d.baseSize && d.baseSize <= d.maxSize, {
    message: "minSize ≤ baseSize ≤ maxSize required",
  });

// ─── Solver ─────────────────────────────────────────────────────────────────

export const SolverSettingsSchema = z
  .object({
    flowType: z.nativeEnum(FlowType),
    maxIterations: z.number().int().positive().max(100_000),
    convergenceCriteria: z.number().positive().max(1),
    relaxationPressure: z.number().min(0).max(1),
    relaxationVelocity: z.number().min(0).max(1),
    relaxationTurbulence: z.number().min(0).max(1),
    timeStep: z.number().positive().optional(),
    totalTime: z.number().positive().optional(),
    courantNumber: z.number().positive().optional(),
  })
  .refine(
    (d) =>
      d.flowType !== FlowType.Transient ||
      (d.timeStep !== undefined && d.totalTime !== undefined),
    { message: "Transient flow requires timeStep and totalTime" }
  );

// ─── Rotating Frame ─────────────────────────────────────────────────────────

export const RotatingFrameConfigSchema = z.object({
  enabled: z.boolean(),
  rotationSpeed: z.number(),
  rotationAxis: Vector3Schema,
  origin: Vector3Schema,
  zoneId: z.string().min(1),
});

// ─── Simulation Config ──────────────────────────────────────────────────────

export const SimulationConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  flowType: z.nativeEnum(FlowType),
  turbulenceModel: TurbulenceModelSchema,
  meshSettings: MeshSettingsSchema,
  solverSettings: SolverSettingsSchema,
  boundaryConditions: z.array(BoundaryConditionSchema).min(1),
  rotatingFrame: RotatingFrameConfigSchema.optional(),
  fluidDensity: z.number().positive(),
  fluidViscosity: z.number().positive(),
  enableHeatTransfer: z.boolean(),
  referenceTemperature: z.number().positive().optional(),
  referencePressure: z.number(),
});

// ─── Rotating Machinery ─────────────────────────────────────────────────────

export const BladeTipRefinementSchema = z.object({
  tipClearance: z.number().positive().describe("Tip clearance gap in meters"),
  refinementRadius: z.number().positive().describe("Radius of refinement zone around blade tip in meters"),
  refinementLevels: z.number().int().min(1).max(8),
  minCellSize: z.number().positive().describe("Minimum cell size in blade tip region in meters"),
});

export const FanSimulationConfigSchema = SimulationConfigSchema.extend({
  rpm: z.number().min(50).max(50_000).describe("Rotational speed in RPM — typical HVAC fans 300-3600, industrial blowers up to 20000"),
  bladeCount: z.number().int().min(2).max(100),
  rotatingZoneRadius: z.number().positive().describe("Radius of the MRF/sliding mesh zone in meters"),
  bladeTipRefinement: BladeTipRefinementSchema,
  boundaryLayerAutoDetect: z.boolean(),
}).refine(
  (d) => d.bladeTipRefinement.refinementRadius <= d.rotatingZoneRadius,
  { message: "Blade tip refinement radius must not exceed the rotating zone radius" }
).refine(
  (d) => d.bladeTipRefinement.minCellSize <= d.meshSettings.baseSize,
  { message: "Blade tip minCellSize must be ≤ mesh baseSize" }
);
