import { z } from "zod";
import { FlowType, TurbulenceType, BoundaryType } from "@/modules/cfd/domain/models";

/**
 * Form-specific schemas — relaxed from the full domain schemas
 * (no uuid requirement on id, surfaceIds as comma-separated string, etc.)
 */

export const BuilderTurbulenceSchema = z
  .object({
    type: z.nativeEnum(TurbulenceType),
    wallFunction: z.boolean(),
    turbulentIntensity: z.coerce.number().min(0).max(1),
    turbulentViscosityRatio: z.coerce.number().positive(),
    kInitial: z.coerce.number().positive(),
    epsilonInitial: z.coerce.number().positive().optional(),
    omegaInitial: z.coerce.number().positive().optional(),
  })
  .refine(
    (d) =>
      (d.type === TurbulenceType.KEpsilon && d.epsilonInitial !== undefined) ||
      (d.type === TurbulenceType.SST && d.omegaInitial !== undefined),
    { message: "k-ε requires ε initial; SST requires ω initial" }
  );

export const BuilderMeshSchema = z
  .object({
    baseSize: z.coerce.number().positive(),
    minSize: z.coerce.number().positive(),
    maxSize: z.coerce.number().positive(),
    refinementLevels: z.coerce.number().int().min(0).max(10),
    boundaryLayerCount: z.coerce.number().int().min(0).max(30),
    boundaryLayerGrowthRate: z.coerce.number().min(1).max(2),
    targetCellCount: z.coerce.number().int().positive(),
    featureAngle: z.coerce.number().min(0).max(180),
    qualityThreshold: z.coerce.number().min(0).max(1),
  })
  .refine((d) => d.minSize <= d.baseSize && d.baseSize <= d.maxSize, {
    message: "Constraint: minSize ≤ baseSize ≤ maxSize",
  });

export const BuilderBoundarySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.nativeEnum(BoundaryType),
  surfaceIds: z.string().min(1, "At least one surface ID required"),
  velocity: z.object({
    x: z.coerce.number(),
    y: z.coerce.number(),
    z: z.coerce.number(),
  }).optional(),
  pressure: z.coerce.number().optional(),
  temperature: z.coerce.number().positive().optional(),
  heatFlux: z.coerce.number().optional(),
});

export const BuilderRotatingFrameSchema = z.object({
  enabled: z.boolean(),
  rotationSpeed: z.coerce.number().min(0),
  rotationAxis: z.object({
    x: z.coerce.number(),
    y: z.coerce.number(),
    z: z.coerce.number(),
  }),
  origin: z.object({
    x: z.coerce.number(),
    y: z.coerce.number(),
    z: z.coerce.number(),
  }),
  zoneId: z.string().min(1, "Zone ID required"),
});

export const BuilderSolverSchema = z
  .object({
    flowType: z.nativeEnum(FlowType),
    maxIterations: z.coerce.number().int().positive().max(100_000),
    convergenceCriteria: z.coerce.number().positive().max(1),
    relaxationPressure: z.coerce.number().min(0).max(1),
    relaxationVelocity: z.coerce.number().min(0).max(1),
    relaxationTurbulence: z.coerce.number().min(0).max(1),
    timeStep: z.coerce.number().positive().optional(),
    totalTime: z.coerce.number().positive().optional(),
  })
  .refine(
    (d) =>
      d.flowType !== FlowType.Transient ||
      (d.timeStep !== undefined && d.totalTime !== undefined),
    { message: "Transient flow requires timeStep and totalTime" }
  );

export const SimulationBuilderSchema = z.object({
  name: z.string().min(1, "Simulation name is required").max(200),
  description: z.string().max(2000).optional(),
  turbulenceModel: BuilderTurbulenceSchema,
  meshSettings: BuilderMeshSchema,
  solverSettings: BuilderSolverSchema,
  boundaryConditions: z.array(BuilderBoundarySchema).min(1, "At least one boundary condition is required"),
  rotatingFrame: BuilderRotatingFrameSchema.optional(),
  fluidDensity: z.coerce.number().positive(),
  fluidViscosity: z.coerce.number().positive(),
  enableHeatTransfer: z.boolean(),
  referencePressure: z.coerce.number(),
});

export type SimulationBuilderFormData = z.infer<typeof SimulationBuilderSchema>;
