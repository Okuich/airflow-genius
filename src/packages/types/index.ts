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
  LaminarFlowValidation = "laminar_flow_validation",
  ParticleDispersion = "particle_dispersion",
  ContaminantDecay = "contaminant_decay",
  ExhaustVentilation = "exhaust_ventilation",
  BuoyancyDriven = "buoyancy_driven",
  AgricultureVentilation = "agriculture_ventilation",
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

export interface CleanroomMetrics {
  airChangeRate: number;
  particleRetentionRate: number;
  isoClassEstimate: string;
  laminarStabilityScore: number;
}

// ── Cleanroom / Particle Transport ──────────────────────────────────────────

export interface ParticleTransportModel {
  /** Enable Lagrangian particle tracking. */
  enabled: boolean;
  /** Particle diameter in metres. */
  particleDiameter: number;
  /** Particle density in kg/m³. */
  particleDensity: number;
  /** Number of tracked parcels. */
  parcelCount: number;
  /** Injection surface IDs (subset of boundary IDs). */
  injectionSurfaceIds: string[];
  /** Enable gravitational settling. */
  gravitySedimentation: boolean;
  /** Enable Brownian diffusion for sub-micron particles. */
  brownianDiffusion: boolean;
  /** Particle-wall interaction mode. */
  wallInteraction: "stick" | "reflect" | "escape";
  /** Contaminant half-life in seconds (null = no decay). */
  contaminantHalfLife: number | null;
}

export interface LaminarFlowValidationMode {
  /** Target unidirectional flow axis. */
  primaryAxis: "x" | "y" | "z";
  /** Maximum allowable velocity deviation angle (degrees). */
  maxDeviationAngle: number;
  /** Minimum laminar coverage fraction to pass (0–1). */
  coverageThreshold: number;
  /** Sampling plane count along primary axis. */
  samplingPlanes: number;
  /** Whether to auto-generate ISO 14644 compliance report. */
  generateISOReport: boolean;
}

export interface CleanroomSimulationConfig extends SimulationConfig {
  particleTransport: ParticleTransportModel;
  laminarValidation?: LaminarFlowValidationMode;
  /** Target ISO cleanliness class (e.g. "ISO 5", "ISO 7"). */
  targetISOClass: string;
  /** Room volume in m³ (used for air-change-rate calculation). */
  roomVolume: number;
  /** HEPA filter face velocity in m/s. */
  filterFaceVelocity: number;
}

export interface ParticleDispersionMetrics {
  /** Mean particle residence time in seconds. */
  meanResidenceTime: number;
  /** Fraction of particles removed via outlets (0–1). */
  removalEfficiency: number;
  /** Max particle concentration (particles/m³). */
  peakConcentration: number;
  /** Contamination recovery time to reach 99% removal (seconds). */
  recoveryTime99Pct: number;
  /** Spatial uniformity index of particle distribution (0–1, 1 = uniform). */
  uniformityIndex: number;
}

export interface ContaminantDecayResult {
  /** Time constant τ (seconds) for exponential decay fit. */
  decayTimeConstant: number;
  /** Goodness of fit R² for exponential model. */
  fitR2: number;
  /** Concentration at each sampled timestep. */
  concentrationTimeSeries: { time: number; concentration: number }[];
}

export interface ExhaustSystemMetrics {
  /** Hood face capture velocity in m/s. */
  captureVelocity: number;
  /** Fraction of contaminant mass removed by the exhaust (0–1). */
  contaminantRemovalEfficiency: number;
  /** Stability of negative pressure in the enclosure (0–1, 1 = perfectly stable). */
  negativePressureStability: number;
  /** Risk score for backflow at exhaust openings (0–1, 0 = no risk). */
  backflowRiskScore: number;
}

// ── Industrial Exhaust / Species Transport ──────────────────────────────────

export interface SpeciesTransportModel {
  /** Enable multi-species transport. */
  enabled: boolean;
  /** List of tracked species. */
  species: SpeciesDefinition[];
  /** Schmidt number for turbulent diffusion. */
  turbulentSchmidtNumber: number;
  /** Enable chemical reactions between species. */
  enableReactions: boolean;
}

export interface SpeciesDefinition {
  /** Species identifier (e.g. "CO2", "toluene"). */
  name: string;
  /** Molecular weight in g/mol. */
  molecularWeight: number;
  /** Mass diffusivity in m²/s. */
  massDiffusivity: number;
  /** Initial mass fraction in the domain (0–1). */
  initialMassFraction: number;
  /** Toxicity exposure limit in ppm (null = non-toxic). */
  exposureLimit: number | null;
}

export interface BuoyancyDrivenFlowConfig {
  /** Enable Boussinesq approximation for buoyancy. */
  enabled: boolean;
  /** Thermal expansion coefficient β (1/K). */
  thermalExpansionCoefficient: number;
  /** Reference temperature for Boussinesq model (K). */
  referenceTemperature: number;
  /** Gravity vector (typically {x:0, y:-9.81, z:0}). */
  gravity: Vector3;
  /** Rayleigh number estimate (derived, informational). */
  rayleighNumber?: number;
}

export interface ExhaustSimulationConfig extends SimulationConfig {
  /** Species transport model for contaminant tracking. */
  speciesTransport: SpeciesTransportModel;
  /** Buoyancy configuration for thermal plume modelling. */
  buoyancy?: BuoyancyDrivenFlowConfig;
  /** Exhaust hood / duct IDs in boundary conditions. */
  exhaustBoundaryIds: string[];
  /** Source emission rate in kg/s (contaminant generation). */
  sourceEmissionRate: number;
  /** Enclosure volume in m³. */
  enclosureVolume: number;
  /** Target capture velocity at hood face in m/s. */
  targetCaptureVelocity: number;
}

export interface ExhaustOptimizationResult {
  /** Overall exhaust effectiveness score (0–1). */
  effectivenessScore: number;
  /** Current vs target capture velocity ratio. */
  captureVelocityRatio: number;
  /** Predicted contaminant removal efficiency (0–1). */
  predictedRemovalEfficiency: number;
  /** Recommended actions to improve exhaust performance. */
  recommendations: ExhaustRecommendation[];
  /** Per-species breakdown. */
  speciesBreakdown: SpeciesRemovalBreakdown[];
  /** Backflow risk assessment. */
  backflowAssessment: BackflowAssessment;
}

export interface ExhaustRecommendation {
  category: "hood_design" | "duct_sizing" | "fan_selection" | "baffle_placement" | "source_control";
  message: string;
  priority: "low" | "medium" | "high" | "critical";
  estimatedImprovement: string;
}

export interface SpeciesRemovalBreakdown {
  speciesName: string;
  inletMassFraction: number;
  outletMassFraction: number;
  removalEfficiency: number;
  exceedsExposureLimit: boolean;
}

export interface BackflowAssessment {
  /** Overall backflow risk (0–1, 0 = no risk). */
  overallRisk: number;
  /** Per-exhaust-boundary risk breakdown. */
  boundaryRisks: BoundaryBackflowRisk[];
  /** Root causes identified. */
  rootCauses: string[];
  /** Mitigation actions. */
  mitigations: string[];
}

export interface BoundaryBackflowRisk {
  boundaryId: string;
  boundaryName: string;
  riskScore: number;
  /** Fraction of face area with reverse flow. */
  reverseFlowFraction: number;
  /** Mean reverse velocity magnitude in m/s. */
  meanReverseVelocity: number;
}

export interface AgricultureVentilationMetrics {
  /** Ammonia concentration in ppm at animal breathing zone. */
  ammoniaConcentration: number;
  /** Heat stress index (0–1, 1 = severe heat stress). */
  heatStressIndex: number;
  /** Stability of relative humidity across the enclosure (0–1, 1 = perfectly stable). */
  humidityStability: number;
  /** Spatial uniformity of airflow distribution (0–1, 1 = uniform). */
  airflowUniformityIndex: number;
}

// ── Agricultural Ventilation ────────────────────────────────────────────────

export interface MultiZoneAirflowModel {
  /** Enable multi-zone network airflow model. */
  enabled: boolean;
  /** Zone definitions within the agricultural building. */
  zones: AirflowZone[];
  /** Inter-zone openings / connections. */
  connections: ZoneConnection[];
  /** Wind-driven natural ventilation coefficient. */
  windPressureCoefficient: number;
  /** Stack effect enabled (thermal buoyancy between zones). */
  enableStackEffect: boolean;
}

export interface AirflowZone {
  /** Zone identifier. */
  id: string;
  /** Descriptive name (e.g. "Barn Section A", "Manure Pit"). */
  name: string;
  /** Zone volume in m³. */
  volume: number;
  /** Average zone temperature in °C. */
  temperature: number;
  /** Average relative humidity (0–1). */
  relativeHumidity: number;
  /** Ammonia source emission rate in mg/s. */
  ammoniaEmissionRate: number;
  /** Metabolic heat generation from livestock in W. */
  animalHeatLoad: number;
  /** Moisture production from livestock in g/s. */
  moistureProductionRate: number;
  /** Number of animals in this zone. */
  animalCount: number;
}

export interface ZoneConnection {
  /** Source zone ID. */
  fromZoneId: string;
  /** Target zone ID. */
  toZoneId: string;
  /** Opening area in m². */
  openingArea: number;
  /** Discharge coefficient (0–1). */
  dischargeCoefficient: number;
  /** Is this a controllable opening (e.g. adjustable curtain). */
  controllable: boolean;
}

export interface MoistureTransportModel {
  /** Enable moisture (water vapour) transport. */
  enabled: boolean;
  /** Ambient outdoor relative humidity (0–1). */
  ambientHumidity: number;
  /** Ambient outdoor temperature in °C. */
  ambientTemperature: number;
  /** Condensation modelling on cold surfaces. */
  enableCondensation: boolean;
  /** Evaporation from wet surfaces (e.g. manure, waterers). */
  enableEvaporation: boolean;
  /** Latent heat exchange coupling with energy equation. */
  latentHeatCoupling: boolean;
}

export interface AgricultureSimulationConfig extends SimulationConfig {
  /** Multi-zone airflow network model. */
  multiZoneModel: MultiZoneAirflowModel;
  /** Moisture transport configuration. */
  moistureTransport: MoistureTransportModel;
  /** Buoyancy configuration for thermal stratification. */
  buoyancy?: BuoyancyDrivenFlowConfig;
  /** Target ammonia concentration limit in ppm. */
  ammoniaLimit: number;
  /** Maximum acceptable heat stress index (0–1). */
  heatStressThreshold: number;
  /** Total building volume in m³. */
  buildingVolume: number;
  /** Livestock type for metabolic heat model. */
  livestockType: "poultry" | "swine" | "dairy" | "beef";
}

export interface HeatStressAssessment {
  /** Overall heat stress index (0–1, 1 = severe). */
  overallIndex: number;
  /** Per-zone breakdown. */
  zoneAssessments: ZoneHeatStress[];
  /** Risk level classification. */
  riskLevel: "safe" | "caution" | "danger" | "emergency";
  /** Recommended mitigations. */
  mitigations: string[];
}

export interface ZoneHeatStress {
  zoneId: string;
  zoneName: string;
  /** Temperature-humidity index (THI). */
  temperatureHumidityIndex: number;
  /** Effective temperature felt by animals in °C. */
  effectiveTemperature: number;
  /** Airflow velocity at animal level in m/s. */
  airVelocityAtAnimalLevel: number;
  /** Heat stress index for this zone (0–1). */
  heatStressIndex: number;
}

export interface AmmoniaRiskAssessment {
  /** Overall ammonia risk score (0–1, 0 = safe). */
  overallRisk: number;
  /** Per-zone ammonia levels. */
  zoneConcentrations: ZoneAmmoniaLevel[];
  /** Zones exceeding the limit. */
  exceedingZones: string[];
  /** Estimated daily ammonia emission in kg/day. */
  dailyEmission: number;
  /** Recommended mitigations. */
  mitigations: string[];
}

export interface ZoneAmmoniaLevel {
  zoneId: string;
  zoneName: string;
  /** Average ammonia concentration in ppm. */
  concentration: number;
  /** Peak ammonia concentration in ppm. */
  peakConcentration: number;
  /** Exceeds regulatory limit. */
  exceedsLimit: boolean;
}

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

export interface RefinementStudyCompletedEvent {
  simulationId: string;
  organizationId: string;
  userId: string;
  gridIndependent: boolean;
  gciFine: number | null;
  timestamp: string;
}

export interface SimulationEarlyTerminationEvent {
  simulationId: string;
  organizationId: string;
  reason: string;
  analysis: {
    trend: string;
    confidence: number;
    slope: number;
    amplitude: number;
    currentLevel: number;
    iteration: number;
  };
  suggestedFixes: string[];
  timestamp: string;
}

/** Map of all platform event names to their payload types. */
export interface PlatformEventMap {
  "simulation.submitted": SimulationSubmittedEvent;
  "simulation.completed": SimulationCompletedEvent;
  "simulation.failed": SimulationFailedEvent;
  "simulation.early_termination": SimulationEarlyTerminationEvent;
  "diagnostic.generated": DiagnosticGeneratedEvent;
  "model.updated": ModelUpdatedEvent;
  "billing.threshold_exceeded": BillingThresholdExceededEvent;
  "feature.created": FeatureVectorCreatedEvent;
  "training.threshold_reached": TrainingThresholdReachedEvent;
  "training.job_launched": TrainingJobLaunchedEvent;
  "refinement_study.completed": RefinementStudyCompletedEvent;
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
