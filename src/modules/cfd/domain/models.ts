// ─── Enums ──────────────────────────────────────────────────────────────────

export enum FlowType {
  Steady = "steady",
  Transient = "transient",
}

export enum TurbulenceType {
  KEpsilon = "k-epsilon",
  SST = "k-omega-sst",
}

export enum BoundaryType {
  Inlet = "inlet",
  Outlet = "outlet",
  Wall = "wall",
  Symmetry = "symmetry",
}

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface TurbulenceModel {
  type: TurbulenceType;
  wallFunction: boolean;
  turbulentIntensity: number;
  turbulentViscosityRatio: number;
  kInitial: number;
  epsilonInitial?: number;
  omegaInitial?: number;
}

export interface BoundaryCondition {
  id: string;
  name: string;
  type: BoundaryType;
  surfaceIds: string[];
  velocity?: Vector3;
  pressure?: number;
  temperature?: number;
  heatFlux?: number;
  turbulentIntensity?: number;
  hydraulicDiameter?: number;
}

export interface MeshSettings {
  baseSize: number;
  minSize: number;
  maxSize: number;
  refinementLevels: number;
  boundaryLayerCount: number;
  boundaryLayerGrowthRate: number;
  targetCellCount: number;
  featureAngle: number;
  qualityThreshold: number;
}

export interface SolverSettings {
  flowType: FlowType;
  maxIterations: number;
  convergenceCriteria: number;
  relaxationPressure: number;
  relaxationVelocity: number;
  relaxationTurbulence: number;
  timeStep?: number;
  totalTime?: number;
  courantNumber?: number;
}

export interface RotatingFrameConfig {
  enabled: boolean;
  rotationSpeed: number;
  rotationAxis: Vector3;
  origin: Vector3;
  zoneId: string;
}

export interface SimulationConfig {
  id: string;
  name: string;
  description: string;
  flowType: FlowType;
  turbulenceModel: TurbulenceModel;
  meshSettings: MeshSettings;
  solverSettings: SolverSettings;
  boundaryConditions: BoundaryCondition[];
  rotatingFrame?: RotatingFrameConfig;
  fluidDensity: number;
  fluidViscosity: number;
  enableHeatTransfer: boolean;
  referenceTemperature?: number;
  referencePressure: number;
}

// ─── Rotating Machinery ─────────────────────────────────────────────────────

export interface BladeTipRefinement {
  tipClearance: number;
  refinementRadius: number;
  refinementLevels: number;
  minCellSize: number;
}

export interface FanSimulationConfig extends SimulationConfig {
  rpm: number;
  bladeCount: number;
  rotatingZoneRadius: number;
  bladeTipRefinement: BladeTipRefinement;
  boundaryLayerAutoDetect: boolean;
}

export interface RotatingMeshAdjustments {
  adjustedBaseSize: number;
  adjustedMinSize: number;
  bladeTipRefinementZone: {
    innerRadius: number;
    outerRadius: number;
    axialExtent: number;
    cellSize: number;
    refinementLevels: number;
  };
  interfaceRefinement: {
    cellSize: number;
    transitionLayers: number;
  };
  recommendedBoundaryLayers: number;
  recommendedGrowthRate: number;
  estimatedCellCount: number;
}
