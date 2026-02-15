// ─── Agent Enums ────────────────────────────────────────────────────────────

export enum IntentCategory {
  ConvergenceIssue = "convergence_issue",
  MeshQuality = "mesh_quality",
  BoundaryMisconfiguration = "boundary_misconfiguration",
  NonPhysicalResults = "non_physical_results",
  PerformanceInterpretation = "performance_interpretation",
  BillingDispute = "billing_dispute",
  ComputeOverrun = "compute_overrun",
  ContaminationDiagnostic = "contamination_diagnostic",
  ExhaustSystemDiagnostic = "exhaust_system_diagnostic",
  DataCenterDiagnostic = "data_center_diagnostic",
  GeneralQuestion = "general_question",
  SimulationSetup = "simulation_setup",
  Unknown = "unknown",
}

export enum Severity {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

export enum ActionType {
  AdjustMesh = "adjust_mesh",
  ModifyBoundaryCondition = "modify_boundary_condition",
  ChangeTurbulenceModel = "change_turbulence_model",
  AdjustRelaxationFactors = "adjust_relaxation_factors",
  ReduceTimeStep = "reduce_time_step",
  RefineBladeTip = "refine_blade_tip",
  ProvideExplanation = "provide_explanation",
  EscalateToSupport = "escalate_to_support",
  ApplyCredit = "apply_credit",
  SetComputeLimit = "set_compute_limit",
  RestartSolver = "restart_solver",
  AdjustParticleTransport = "adjust_particle_transport",
  RefineCleanroomMesh = "refine_cleanroom_mesh",
  AdjustExhaustFlow = "adjust_exhaust_flow",
  OptimizeHoodDesign = "optimize_hood_design",
  AddBackdraftDamper = "add_backdraft_damper",
  OptimizeContainment = "optimize_containment",
  AdjustCoolingCapacity = "adjust_cooling_capacity",
  RebalanceAirflow = "rebalance_airflow",
}

export enum DiagnosticCheck {
  ResidualTrend = "residual_trend",
  MeshOrthogonality = "mesh_orthogonality",
  MeshSkewness = "mesh_skewness",
  YPlusRange = "y_plus_range",
  CourantNumber = "courant_number",
  MassBalance = "mass_balance",
  EnergyBalance = "energy_balance",
  BoundaryConsistency = "boundary_consistency",
  ReferenceValues = "reference_values",
  TurbulenceRatio = "turbulence_ratio",
  ParticleResidenceTime = "particle_residence_time",
  ContaminantDecayRate = "contaminant_decay_rate",
  ISOClassCompliance = "iso_class_compliance",
  LaminarCoverage = "laminar_coverage",
  CaptureVelocity = "capture_velocity",
  BackflowRisk = "backflow_risk",
  SpeciesConcentration = "species_concentration",
  NegativePressure = "negative_pressure",
  RackHotspot = "rack_hotspot",
  ContainmentLeak = "containment_leak",
  PUEDeviation = "pue_deviation",
  CoolingCapacity = "cooling_capacity",
}

export enum PlanStatus {
  Pending = "pending",
  InProgress = "in_progress",
  Completed = "completed",
  Failed = "failed",
  RolledBack = "rolled_back",
}

// ─── Core Interfaces ────────────────────────────────────────────────────────

export interface AgentContext {
  sessionId: string;
  userId: string;
  simulationId: string | null;
  jobId: string | null;
  conversationHistory: ConversationEntry[];
  currentConfig: Record<string, unknown> | null;
  metadata: ContextMetadata;
  timestamp: string;
}

export interface ContextMetadata {
  userTier: "free" | "pro" | "enterprise";
  totalSimulations: number;
  accountAgeMonths: number;
  previousIssueCount: number;
  currentComputeUsageHours: number;
  computeLimitHours: number;
}

export interface ConversationEntry {
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
  intentClassification: IntentCategory | null;
}

export interface AgentIntent {
  category: IntentCategory;
  confidence: number;
  subCategory: string | null;
  entities: ExtractedEntity[];
  rawInput: string;
  requiresClarification: boolean;
  suggestedFollowUp: string | null;
}

export interface ExtractedEntity {
  type: "simulation_id" | "parameter" | "value" | "error_code" | "metric";
  value: string;
  confidence: number;
  position: [number, number];
}

export interface DiagnosticResult {
  check: DiagnosticCheck;
  passed: boolean;
  value: number | string | null;
  threshold: string;
  severity: Severity;
  detail: string;
}

export interface DiagnosticReport {
  simulationId: string;
  jobId: string | null;
  runAt: string;
  overallSeverity: Severity;
  results: DiagnosticResult[];
  summary: string;
  rootCauseProbability: RootCause[];
}

export interface RootCause {
  cause: string;
  probability: number;
  relatedChecks: DiagnosticCheck[];
  suggestedFix: string;
}

export interface PlannedAction {
  id: string;
  type: ActionType;
  description: string;
  parameters: Record<string, unknown>;
  estimatedImpact: string;
  reversible: boolean;
  requiresApproval: boolean;
  order: number;
}

export interface ResolutionPlan {
  id: string;
  intent: AgentIntent;
  diagnosticReport: DiagnosticReport | null;
  actions: PlannedAction[];
  status: PlanStatus;
  confidence: number;
  explanation: string;
  estimatedResolutionTime: string;
  createdAt: string;
  completedAt: string | null;
}

export interface ActionResult {
  actionId: string;
  success: boolean;
  output: string;
  sideEffects: string[];
  error: string | null;
  durationMs: number;
}

export interface PlanExecutionResult {
  planId: string;
  status: PlanStatus;
  actionResults: ActionResult[];
  overallSuccess: boolean;
  summary: string;
  followUpRequired: boolean;
  followUpMessage: string | null;
}

// ─── Memory / Cache Interfaces ──────────────────────────────────────────────

export interface MemoryEntry {
  key: string;
  value: unknown;
  ttlSeconds: number | null;
  createdAt: string;
  accessedAt: string;
  accessCount: number;
  tags: string[];
}

export interface InteractionRecord {
  sessionId: string;
  userId: string;
  intent: AgentIntent;
  diagnosticReport: DiagnosticReport | null;
  resolutionPlan: ResolutionPlan | null;
  executionResult: PlanExecutionResult | null;
  userSatisfaction: number | null;
  resolvedWithoutEscalation: boolean;
  timestamp: string;
  durationMs: number;
}

export interface MemoryStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  getByTag(tag: string): Promise<MemoryEntry[]>;
  recordInteraction(record: InteractionRecord): Promise<void>;
  getInteractionHistory(userId: string, limit: number): Promise<InteractionRecord[]>;
  getSimilarIssues(intent: AgentIntent, limit: number): Promise<InteractionRecord[]>;
  clear(): Promise<void>;
}

export interface CacheOptions {
  ttlSeconds: number;
  tags: string[];
  namespace: string;
}
