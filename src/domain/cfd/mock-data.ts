import {
  Simulation,
  SimulationMetrics,
  SimulationStatus,
  type SimulationStatusType,
} from "./types";

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_SIMULATIONS: Simulation[] = [
  {
    id: "sim-001",
    name: "Centrifugal Blower — Design Point",
    description: "Steady-state analysis at 3,450 RPM with k-ω SST turbulence model",
    projectId: "proj-001",
    status: SimulationStatus.SOLVING,
    progress: 67,
    currentIteration: 1340,
    cellCount: 4_200_000,
    meshConfig: {
      baseSize: 0.002,
      refinementLevels: 4,
      boundaryLayerCount: 15,
      boundaryLayerGrowthRate: 1.2,
      qualityThreshold: 0.85,
    },
    solverConfig: {
      type: "steady",
      turbulenceModel: "k-omega-sst",
      maxIterations: 2000,
      convergenceCriteria: 1e-6,
      relaxationFactors: { pressure: 0.3, velocity: 0.7, turbulence: 0.8 },
      enableHeatTransfer: false,
      rotatingReferenceFrame: {
        enabled: true,
        rotationSpeed: 3450,
        rotationAxis: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
      },
    },
    fluidProperties: {
      name: "Air (25°C)",
      density: 1.184,
      viscosity: 1.849e-5,
    },
    boundaryConditions: [],
    residuals: Array.from({ length: 1340 }, (_, i) => ({
      iteration: i + 1,
      continuity: Math.max(1e-6, 1e-1 * Math.exp(-i / 300)),
      xMomentum: Math.max(1e-6, 5e-2 * Math.exp(-i / 280)),
      yMomentum: Math.max(1e-6, 5e-2 * Math.exp(-i / 290)),
      zMomentum: Math.max(1e-6, 3e-2 * Math.exp(-i / 310)),
      kTurbulent: Math.max(1e-6, 2e-2 * Math.exp(-i / 350)),
      epsilonOrOmega: Math.max(1e-6, 3e-2 * Math.exp(-i / 340)),
    })),
    createdAt: "2026-02-14T09:30:00Z",
    updatedAt: "2026-02-15T11:45:00Z",
    estimatedTimeRemaining: 1200,
  },
  {
    id: "sim-002",
    name: "Axial Fan Heat Rejection — Off-Design",
    description: "Transient thermal analysis with heat transfer at reduced speed",
    projectId: "proj-001",
    status: SimulationStatus.COMPLETED,
    progress: 100,
    currentIteration: 1800,
    cellCount: 6_800_000,
    meshConfig: {
      baseSize: 0.0015,
      refinementLevels: 5,
      boundaryLayerCount: 20,
      boundaryLayerGrowthRate: 1.15,
      qualityThreshold: 0.9,
    },
    solverConfig: {
      type: "transient",
      turbulenceModel: "k-epsilon",
      maxIterations: 1800,
      convergenceCriteria: 1e-5,
      relaxationFactors: { pressure: 0.3, velocity: 0.7, turbulence: 0.8 },
      enableHeatTransfer: true,
      timeStep: 0.001,
      totalTime: 1.8,
    },
    fluidProperties: {
      name: "Air (80°C)",
      density: 0.999,
      viscosity: 2.09e-5,
      specificHeat: 1010,
      thermalConductivity: 0.0299,
    },
    boundaryConditions: [],
    residuals: [],
    createdAt: "2026-02-13T14:00:00Z",
    updatedAt: "2026-02-14T02:30:00Z",
    completedAt: "2026-02-14T02:30:00Z",
  },
  {
    id: "sim-003",
    name: "HVAC Duct System — Pressure Drop",
    description: "Steady-state duct network analysis with k-ε RNG model",
    projectId: "proj-002",
    status: SimulationStatus.QUEUED,
    progress: 0,
    currentIteration: 0,
    cellCount: 2_100_000,
    meshConfig: {
      baseSize: 0.005,
      refinementLevels: 3,
      boundaryLayerCount: 10,
      boundaryLayerGrowthRate: 1.3,
      qualityThreshold: 0.75,
    },
    solverConfig: {
      type: "steady",
      turbulenceModel: "k-epsilon-rng",
      maxIterations: 1500,
      convergenceCriteria: 1e-5,
      relaxationFactors: { pressure: 0.3, velocity: 0.7, turbulence: 0.8 },
      enableHeatTransfer: false,
    },
    fluidProperties: {
      name: "Air (20°C)",
      density: 1.204,
      viscosity: 1.825e-5,
    },
    boundaryConditions: [],
    residuals: [],
    createdAt: "2026-02-15T08:00:00Z",
    updatedAt: "2026-02-15T08:00:00Z",
  },
  {
    id: "sim-004",
    name: "Mixed Flow Fan — Surge Analysis",
    description: "Transient simulation near stall condition with SST model",
    projectId: "proj-001",
    status: SimulationStatus.FAILED,
    progress: 34,
    currentIteration: 680,
    cellCount: 5_500_000,
    meshConfig: {
      baseSize: 0.001,
      refinementLevels: 5,
      boundaryLayerCount: 18,
      boundaryLayerGrowthRate: 1.18,
      qualityThreshold: 0.88,
    },
    solverConfig: {
      type: "transient",
      turbulenceModel: "k-omega-sst",
      maxIterations: 2000,
      convergenceCriteria: 1e-6,
      relaxationFactors: { pressure: 0.2, velocity: 0.5, turbulence: 0.6 },
      enableHeatTransfer: false,
      rotatingReferenceFrame: {
        enabled: true,
        rotationSpeed: 1750,
        rotationAxis: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
      },
      timeStep: 0.0005,
      totalTime: 1.0,
    },
    fluidProperties: {
      name: "Air (25°C)",
      density: 1.184,
      viscosity: 1.849e-5,
    },
    boundaryConditions: [],
    residuals: [],
    createdAt: "2026-02-12T16:00:00Z",
    updatedAt: "2026-02-12T18:45:00Z",
  },
];

export function getMockSimulations(): Simulation[] {
  return MOCK_SIMULATIONS;
}

export function getMockSimulation(id: string): Simulation | undefined {
  return MOCK_SIMULATIONS.find((s) => s.id === id);
}

export function getMockMetrics(): SimulationMetrics {
  return {
    totalSimulations: MOCK_SIMULATIONS.length,
    running: MOCK_SIMULATIONS.filter((s) => s.status === SimulationStatus.SOLVING || s.status === SimulationStatus.MESHING).length,
    completed: MOCK_SIMULATIONS.filter((s) => s.status === SimulationStatus.COMPLETED).length,
    failed: MOCK_SIMULATIONS.filter((s) => s.status === SimulationStatus.FAILED).length,
    avgSolveTime: 12.5,
    totalCpuHours: 342.7,
  };
}

export function getStatusLabel(status: SimulationStatusType): string {
  const labels: Record<SimulationStatusType, string> = {
    draft: "Draft",
    queued: "Queued",
    meshing: "Meshing",
    solving: "Solving",
    post_processing: "Post-Processing",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return labels[status];
}

export function getStatusClass(status: SimulationStatusType): string {
  switch (status) {
    case SimulationStatus.SOLVING:
    case SimulationStatus.MESHING:
    case SimulationStatus.POST_PROCESSING:
      return "status-running";
    case SimulationStatus.COMPLETED:
      return "status-completed";
    case SimulationStatus.FAILED:
    case SimulationStatus.CANCELLED:
      return "status-failed";
    case SimulationStatus.QUEUED:
    case SimulationStatus.DRAFT:
      return "status-queued";
    default:
      return "status-queued";
  }
}
