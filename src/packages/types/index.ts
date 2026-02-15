// ─── packages/types ─────────────────────────────────────────────────────────
// Canonical type definitions for the FlowForge CFD platform.
// Every module imports from here — no type duplication.
// ─────────────────────────────────────────────────────────────────────────────

// ── Geometry ────────────────────────────────────────────────────────────────

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface FieldPoint {
  x: number;
  y: number;
  z: number;
}

// ── Simulation Enums ────────────────────────────────────────────────────────

export enum FlowType {
  Steady = "steady",
  Transient = "transient",
}

export enum TurbulenceType {
  KEpsilon = "k-epsilon",
  KEpsilonRNG = "k-epsilon-rng",
  SST = "k-omega-sst",
  SpalartAllmaras = "spalart-allmaras",
}

export enum BoundaryType {
  Inlet = "inlet",
  Outlet = "outlet",
  Wall = "wall",
  Symmetry = "symmetry",
  Periodic = "periodic",
  RotatingWall = "rotating_wall",
  VelocityInlet = "velocity_inlet",
  PressureInlet = "pressure_inlet",
  PressureOutlet = "pressure_outlet",
}

export enum SimulationStatus {
  Draft = "draft",
  Queued = "queued",
  Meshing = "meshing",
  Solving = "solving",
  PostProcessing = "post_processing",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

// ── Simulation Models ───────────────────────────────────────────────────────

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
  rotationSpeed?: number;
  rotationAxis?: Vector3;
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

// ── Rotating Machinery ──────────────────────────────────────────────────────

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

// ── Residuals / Diagnostics ─────────────────────────────────────────────────

export interface ResidualData {
  iteration: number;
  continuity: number;
  xMomentum: number;
  yMomentum: number;
  zMomentum: number;
  energy?: number | null;
  kTurbulent?: number | null;
  epsilonOrOmega?: number | null;
}

export interface MeshStats {
  cellCount: number;
  avgOrthogonality: number;
  maxSkewness: number;
  maxAspectRatio: number;
  minVolume: number;
  nonOrthogonalCellPercent: number;
  avgYPlus: number | null;
}

export interface RelaxationFactors {
  pressure: number;
  velocity: number;
  turbulence: number;
  energy: number | null;
}

// ── Results / Post-Processing ───────────────────────────────────────────────

export interface VelocityFieldEntry {
  position: FieldPoint;
  magnitude: number;
  components: { u: number; v: number; w: number };
}

export interface PressureFieldEntry {
  position: FieldPoint;
  staticPressure: number;
  totalPressure: number;
}

export interface TemperatureFieldEntry {
  position: FieldPoint;
  temperature: number;
}

export interface EfficiencyMetrics {
  totalPressureRiseOrDrop: number;
  volumeFlowRate: number;
  shaftPower: number | null;
  inletTotalPressure: number;
  outletTotalPressure: number;
  inletStaticPressure: number;
  outletStaticPressure: number;
  massFlowRate: number;
  fluidDensity: number;
}

export type EfficiencyRating = "Poor" | "Average" | "Good" | "Excellent";

export interface HumanReadableSummary {
  keyFindings: string[];
  pressureLossEstimate: number;
  efficiencyRating: EfficiencyRating;
  flowSeparationZones: number;
  recommendations: string[];
}

// ── HPC / Solver Service ────────────────────────────────────────────────────

export enum JobStatus {
  Queued = "queued",
  Meshing = "meshing",
  Solving = "solving",
  PostProcessing = "post_processing",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

export enum SolverErrorCode {
  DivergenceDetected = "DIVERGENCE_DETECTED",
  MeshQualityFailed = "MESH_QUALITY_FAILED",
  InsufficientMemory = "INSUFFICIENT_MEMORY",
  TimeoutExceeded = "TIMEOUT_EXCEEDED",
  InvalidBoundaryCondition = "INVALID_BOUNDARY_CONDITION",
  LicenseUnavailable = "LICENSE_UNAVAILABLE",
  HPCConnectionFailed = "HPC_CONNECTION_FAILED",
  UnknownError = "UNKNOWN_ERROR",
}

export interface ResidualSnapshot {
  iteration: number;
  continuity: number;
  xMomentum: number;
  yMomentum: number;
  zMomentum: number;
  energy: number | null;
  kTurbulent: number | null;
  epsilonOrOmega: number | null;
}

export interface HPCSubmitResponse {
  jobId: string;
  status: JobStatus;
  submittedAt: string;
  estimatedStartTime: string;
  queuePosition: number;
}

export interface HPCStatusResponse {
  jobId: string;
  status: JobStatus;
  progress: number;
  currentIteration: number;
  maxIterations: number;
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
  lastResidual: ResidualSnapshot;
  workerNodeId: string;
}

export interface HPCResultsResponse {
  jobId: string;
  completedAt: string;
  totalIterations: number;
  converged: boolean;
  finalResiduals: ResidualSnapshot;
  outputFiles: OutputFile[];
  performanceMetrics: PerformanceMetrics;
}

export interface OutputFile {
  name: string;
  url: string;
  sizeBytes: number;
  format: "vtk" | "csv" | "png" | "json";
}

export interface PerformanceMetrics {
  totalCpuHours: number;
  peakMemoryGB: number;
  cellCount: number;
  wallClockSeconds: number;
  parallelEfficiency: number;
}

export interface SolverError {
  code: SolverErrorCode;
  message: string;
  jobId: string;
  iteration: number | null;
  timestamp: string;
  recoverable: boolean;
  suggestedAction: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface SolverServiceConfig {
  hpcBaseUrl: string;
  apiKey: string;
  timeoutMs: number;
  retry: RetryConfig;
  pollingIntervalMs: number;
  maxPollingDurationMs: number;
}

export interface SubmissionResult {
  success: boolean;
  jobId: string | null;
  error: SolverError | null;
  response: HPCSubmitResponse | null;
}

export interface StatusResult {
  success: boolean;
  status: HPCStatusResponse | null;
  error: SolverError | null;
}

export interface ResultsResult {
  success: boolean;
  results: HPCResultsResponse | null;
  error: SolverError | null;
}

// ── Compute / Billing ───────────────────────────────────────────────────────

export type UserTier = "free" | "pro" | "enterprise";

export type WarningLevel = "none" | "approaching" | "critical" | "exceeded";

export interface ComputeUsageSnapshot {
  cpuHours: number;
  gpuHours: number;
  memoryGBHours: number;
  simulationDurationHours: number;
}

export interface CostEstimate {
  cpuCost: number;
  gpuCost: number;
  memoryCost: number;
  totalCost: number;
  currency: "USD";
}

// ── Multi-Tenant ────────────────────────────────────────────────────────────

export type AppRole = "owner" | "admin" | "member" | "viewer";

// ── Logging ─────────────────────────────────────────────────────────────────

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

// ── ML / Surrogate Models ───────────────────────────────────────────────────

/** Post-simulation feature vector derived from results (deterministic). */
export interface FeatureVector {
  reynoldsNumber: number;
  turbulenceIntensity: number;
  pressureDrop: number;
  efficiency: number;
  meshQualityScore: number;
  convergenceSpeed: number;
}

/** Input bundle for results-based feature extraction. */
export interface SimulationResults {
  config: SimulationConfig;
  meshStats: MeshStats;
  residuals: ResidualData[];
  pressureDrop: number;
  efficiencyRating: EfficiencyRating;
  solveTimeSeconds: number;
  totalIterations: number;
  converged: boolean;
}

export type SurrogateModelType = "pressure_drop" | "convergence" | "efficiency";

export interface SimulationFeatureVector {
  // Mesh features
  cellCount: number;
  baseSize: number;
  refinementLevels: number;
  boundaryLayerCount: number;
  boundaryLayerGrowthRate: number;
  qualityThreshold: number;

  // Solver features
  flowType: number; // 0 = steady, 1 = transient
  turbulenceModel: number; // one-hot encoded index
  maxIterations: number;
  convergenceCriteria: number;
  relaxationPressure: number;
  relaxationVelocity: number;
  relaxationTurbulence: number;

  // Fluid features
  fluidDensity: number;
  fluidViscosity: number;
  reynoldsNumber: number; // derived

  // Boundary features
  inletCount: number;
  outletCount: number;
  wallCount: number;
  maxInletVelocity: number;
  avgInletVelocity: number;

  // Rotating machinery
  hasRotatingFrame: number; // 0 or 1
  rpm: number;
}

export interface SimulationLabels {
  pressureDrop: number | null;
  converged: number | null; // 0 or 1
  iterationsToConverge: number | null;
  efficiencyRating: number | null; // 0=Poor, 1=Avg, 2=Good, 3=Excellent
  totalPressureLoss: number | null;
  solveTimeSeconds: number | null;
}

export interface NormalizationParams {
  mean: number[];
  std: number[];
  featureNames: string[];
}

export interface SurrogateModelWeights {
  coefficients: number[];
  intercept: number;
  featureNames: string[];
}

export interface SurrogateModelMetrics {
  mse: number;
  mae: number;
  r2: number;
  sampleCount: number;
  trainedAt: string;
}

export interface SurrogateModelVersion {
  id: string;
  organizationId: string;
  modelType: SurrogateModelType;
  version: number;
  weights: SurrogateModelWeights;
  normalization: NormalizationParams;
  metrics: SurrogateModelMetrics;
  isActive: boolean;
  createdAt: string;
}

export interface SurrogatePrediction {
  modelType: SurrogateModelType;
  value: number;
  confidence: number;
  modelVersion: number;
}

// ── Platform Events ─────────────────────────────────────────────────────────

export interface SimulationSubmittedEvent {
  simulationId: string;
  organizationId: string;
  userId: string;
  config: SimulationConfig;
  timestamp: string;
}

export interface SimulationCompletedEvent {
  simulationId: string;
  organizationId: string;
  userId: string;
  config: SimulationConfig;
  results: {
    converged: boolean;
    totalIterations: number;
    finalResiduals: ResidualSnapshot;
    pressureDrop: number;
    efficiencyRating: EfficiencyRating;
    solveTimeSeconds: number;
  };
  timestamp: string;
}

export interface SimulationFailedEvent {
  simulationId: string;
  organizationId: string;
  userId: string;
  error: SolverError;
  lastIteration: number;
  timestamp: string;
}

export interface DiagnosticGeneratedEvent {
  simulationId: string;
  organizationId: string;
  diagnosticType: "convergence" | "mesh_quality" | "boundary_check";
  severity: "info" | "warning" | "critical";
  message: string;
  recommendations: string[];
  timestamp: string;
}

export interface ModelUpdatedEvent {
  organizationId: string;
  modelType: SurrogateModelType;
  version: number;
  metrics: SurrogateModelMetrics;
  previousVersion: number | null;
  timestamp: string;
}

export interface BillingThresholdExceededEvent {
  organizationId: string;
  userId: string;
  resource: "cpuHours" | "gpuHours" | "memoryGBHours" | "simulationDurationHours";
  currentValue: number;
  limit: number;
  percentUsed: number;
  tier: UserTier;
  timestamp: string;
}

export interface FeatureVectorCreatedEvent {
  organizationId: string;
  simulationId: string | null;
  featureStoreEntryId: string;
  geometryCluster: string;
  timestamp: string;
}

export interface TrainingThresholdReachedEvent {
  organizationId: string;
  pendingCount: number;
  threshold: number;
  modelTypes: SurrogateModelType[];
  timestamp: string;
}

export interface TrainingJobLaunchedEvent {
  organizationId: string;
  jobId: string;
  modelType: SurrogateModelType;
  sampleCount: number;
  timestamp: string;
}

/** Map of all platform event names to their payload types. */
export interface PlatformEventMap {
  "simulation.submitted": SimulationSubmittedEvent;
  "simulation.completed": SimulationCompletedEvent;
  "simulation.failed": SimulationFailedEvent;
  "diagnostic.generated": DiagnosticGeneratedEvent;
  "model.updated": ModelUpdatedEvent;
  "billing.threshold_exceeded": BillingThresholdExceededEvent;
  "feature.created": FeatureVectorCreatedEvent;
  "training.threshold_reached": TrainingThresholdReachedEvent;
  "training.job_launched": TrainingJobLaunchedEvent;
}

/** Union of all event names. */
export type PlatformEventName = keyof PlatformEventMap;

/** Generic envelope wrapping any platform event. */
export interface Event<T extends PlatformEventName = PlatformEventName> {
  id: string;
  name: T;
  payload: PlatformEventMap[T];
  timestamp: string;
  source: string;
}

export interface SurrogateRecommendation {
  type: "mesh" | "solver" | "boundary" | "general";
  message: string;
  confidence: number;
  predictedImprovement: string;
}

/** Transport abstraction — implement for Kafka, Redis, etc. */
export interface EventTransport {
  publish<T extends PlatformEventName>(event: Event<T>): Promise<void>;
  subscribe<T extends PlatformEventName>(
    name: T,
    handler: (event: Event<T>) => void | Promise<void>
  ): () => void;
}
