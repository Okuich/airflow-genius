import { z } from "zod";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const SimulationStatus = {
  DRAFT: "draft",
  QUEUED: "queued",
  MESHING: "meshing",
  SOLVING: "solving",
  POST_PROCESSING: "post_processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type SimulationStatusType = (typeof SimulationStatus)[keyof typeof SimulationStatus];

export const TurbulenceModel = {
  K_EPSILON: "k-epsilon",
  K_EPSILON_RNG: "k-epsilon-rng",
  K_OMEGA_SST: "k-omega-sst",
  SPALART_ALLMARAS: "spalart-allmaras",
} as const;

export type TurbulenceModelType = (typeof TurbulenceModel)[keyof typeof TurbulenceModel];

export const BoundaryConditionType = {
  VELOCITY_INLET: "velocity_inlet",
  PRESSURE_INLET: "pressure_inlet",
  PRESSURE_OUTLET: "pressure_outlet",
  WALL: "wall",
  SYMMETRY: "symmetry",
  PERIODIC: "periodic",
  ROTATING_WALL: "rotating_wall",
} as const;

export type BoundaryConditionTypeValue = (typeof BoundaryConditionType)[keyof typeof BoundaryConditionType];

export const SolverType = {
  STEADY: "steady",
  TRANSIENT: "transient",
} as const;

export type SolverTypeValue = (typeof SolverType)[keyof typeof SolverType];

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const Vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const FluidPropertiesSchema = z.object({
  name: z.string().min(1).max(100),
  density: z.number().positive().describe("kg/m³"),
  viscosity: z.number().positive().describe("Pa·s"),
  specificHeat: z.number().positive().optional().describe("J/(kg·K)"),
  thermalConductivity: z.number().positive().optional().describe("W/(m·K)"),
});

export const MeshConfigSchema = z.object({
  baseSize: z.number().positive().describe("Base cell size in meters"),
  refinementLevels: z.number().int().min(0).max(10),
  boundaryLayerCount: z.number().int().min(0).max(30),
  boundaryLayerGrowthRate: z.number().min(1.0).max(2.0),
  targetCellCount: z.number().int().positive().optional(),
  qualityThreshold: z.number().min(0).max(1).default(0.7),
});

export const BoundaryConditionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: z.nativeEnum(
    Object.fromEntries(
      Object.entries(BoundaryConditionType).map(([k, v]) => [k, v])
    ) as Record<string, string>
  ) as z.ZodType<BoundaryConditionTypeValue>,
  surfaceIds: z.array(z.string()),
  velocity: Vector3Schema.optional(),
  pressure: z.number().optional(),
  temperature: z.number().positive().optional().describe("Kelvin"),
  heatFlux: z.number().optional().describe("W/m²"),
  rotationSpeed: z.number().optional().describe("RPM"),
  rotationAxis: Vector3Schema.optional(),
});

export const RotatingReferenceFrameSchema = z.object({
  enabled: z.boolean(),
  rotationSpeed: z.number().describe("RPM"),
  rotationAxis: Vector3Schema,
  origin: Vector3Schema,
  zoneId: z.string().optional(),
});

export const SolverConfigSchema = z.object({
  type: z.enum(["steady", "transient"]),
  turbulenceModel: z.enum(["k-epsilon", "k-epsilon-rng", "k-omega-sst", "spalart-allmaras"]),
  maxIterations: z.number().int().positive().max(100000).default(2000),
  convergenceCriteria: z.number().positive().default(1e-6),
  relaxationFactors: z.object({
    pressure: z.number().min(0).max(1).default(0.3),
    velocity: z.number().min(0).max(1).default(0.7),
    turbulence: z.number().min(0).max(1).default(0.8),
  }),
  enableHeatTransfer: z.boolean().default(false),
  rotatingReferenceFrame: RotatingReferenceFrameSchema.optional(),
  timeStep: z.number().positive().optional().describe("seconds - for transient"),
  totalTime: z.number().positive().optional().describe("seconds - for transient"),
});

export const SimulationCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  projectId: z.string().uuid(),
  geometryFileId: z.string().uuid().optional(),
  meshConfig: MeshConfigSchema,
  solverConfig: SolverConfigSchema,
  fluidProperties: FluidPropertiesSchema,
  boundaryConditions: z.array(BoundaryConditionSchema),
});

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface FluidProperties extends z.infer<typeof FluidPropertiesSchema> {}

export interface MeshConfig extends z.infer<typeof MeshConfigSchema> {}

export interface BoundaryCondition extends z.infer<typeof BoundaryConditionSchema> {}

export interface RotatingReferenceFrame extends z.infer<typeof RotatingReferenceFrameSchema> {}

export interface SolverConfig extends z.infer<typeof SolverConfigSchema> {}

export interface SimulationCreate extends z.infer<typeof SimulationCreateSchema> {}

export interface Simulation {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  status: SimulationStatusType;
  meshConfig: MeshConfig;
  solverConfig: SolverConfig;
  fluidProperties: FluidProperties;
  boundaryConditions: BoundaryCondition[];
  progress: number;
  currentIteration: number;
  residuals: ResidualData[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  estimatedTimeRemaining?: number;
  cellCount?: number;
}

export interface ResidualData {
  iteration: number;
  continuity: number;
  xMomentum: number;
  yMomentum: number;
  zMomentum: number;
  energy?: number;
  kTurbulent?: number;
  epsilonOrOmega?: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  simulations: Simulation[];
  createdAt: string;
  updatedAt: string;
}

export interface SimulationMetrics {
  totalSimulations: number;
  running: number;
  completed: number;
  failed: number;
  avgSolveTime: number;
  totalCpuHours: number;
}
