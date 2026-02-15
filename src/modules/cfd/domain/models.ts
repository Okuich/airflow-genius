// Re-export all domain models from the unified types package.
// Existing imports from "./models" continue to work.
export {
  FlowType,
  TurbulenceType,
  BoundaryType,
  type Vector3,
  type TurbulenceModel,
  type BoundaryCondition,
  type MeshSettings,
  type SolverSettings,
  type RotatingFrameConfig,
  type SimulationConfig,
  type BladeTipRefinement,
  type FanSimulationConfig,
  type RotatingMeshAdjustments,
} from "@/packages/types";
