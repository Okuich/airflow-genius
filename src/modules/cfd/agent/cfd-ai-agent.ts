import {
  type AgentContext,
  type AgentIntent,
  type DiagnosticReport,
  type DiagnosticResult,
  type ResolutionPlan,
  type PlannedAction,
  type PlanExecutionResult,
  type ActionResult,
  type MemoryStore,
  type RootCause,
  IntentCategory,
  Severity,
  ActionType,
  DiagnosticCheck,
  PlanStatus,
} from "./types";
import { InMemoryStore } from "./memory-store";
import { StructuredLogger } from "../solver/logger";
import { ComputeUsageService } from "../compute/compute-usage-service";
import type { AgentNotification, UsageReport } from "../compute/compute-usage-service";
import { InferenceClient, type InferenceResult } from "../inference/inference-client";
import type { FeatureVector } from "@/packages/types";

// ─── Knowledge Patterns ─────────────────────────────────────────────────────

interface KnowledgePattern {
  intent: IntentCategory;
  keywords: string[];
  diagnosticChecks: DiagnosticCheck[];
  commonActions: ActionType[];
}

const KNOWLEDGE_BASE: KnowledgePattern[] = [
  {
    intent: IntentCategory.ConvergenceIssue,
    keywords: ["diverge", "convergence", "residual", "oscillat", "not converging", "blow up", "nan", "infinity"],
    diagnosticChecks: [DiagnosticCheck.ResidualTrend, DiagnosticCheck.CourantNumber, DiagnosticCheck.MeshOrthogonality, DiagnosticCheck.ReferenceValues],
    commonActions: [ActionType.AdjustRelaxationFactors, ActionType.ReduceTimeStep, ActionType.AdjustMesh, ActionType.RestartSolver],
  },
  {
    intent: IntentCategory.MeshQuality,
    keywords: ["mesh", "cell", "skew", "orthogonal", "aspect ratio", "y+", "yplus", "refine", "coarse"],
    diagnosticChecks: [DiagnosticCheck.MeshOrthogonality, DiagnosticCheck.MeshSkewness, DiagnosticCheck.YPlusRange],
    commonActions: [ActionType.AdjustMesh, ActionType.RefineBladeTip],
  },
  {
    intent: IntentCategory.BoundaryMisconfiguration,
    keywords: ["boundary", "inlet", "outlet", "wall", "pressure", "velocity", "backflow", "reverse flow"],
    diagnosticChecks: [DiagnosticCheck.BoundaryConsistency, DiagnosticCheck.MassBalance, DiagnosticCheck.ReferenceValues],
    commonActions: [ActionType.ModifyBoundaryCondition, ActionType.ProvideExplanation],
  },
  {
    intent: IntentCategory.NonPhysicalResults,
    keywords: ["negative pressure", "unphysical", "non-physical", "impossible", "wrong result", "unrealistic", "too high", "too low"],
    diagnosticChecks: [DiagnosticCheck.MassBalance, DiagnosticCheck.EnergyBalance, DiagnosticCheck.BoundaryConsistency, DiagnosticCheck.TurbulenceRatio],
    commonActions: [ActionType.ChangeTurbulenceModel, ActionType.ModifyBoundaryCondition, ActionType.AdjustMesh],
  },
  {
    intent: IntentCategory.PerformanceInterpretation,
    keywords: ["performance", "efficiency", "pressure rise", "flow rate", "fan curve", "operating point", "interpret", "result"],
    diagnosticChecks: [DiagnosticCheck.MassBalance, DiagnosticCheck.EnergyBalance],
    commonActions: [ActionType.ProvideExplanation],
  },
  {
    intent: IntentCategory.BillingDispute,
    keywords: ["bill", "charge", "invoice", "credit", "refund", "overcharge", "cost", "price", "payment"],
    diagnosticChecks: [],
    commonActions: [ActionType.ApplyCredit, ActionType.EscalateToSupport],
  },
  {
    intent: IntentCategory.ComputeOverrun,
    keywords: ["compute", "cpu", "hours", "limit", "quota", "exceed", "overrun", "timeout", "slow", "long running"],
    diagnosticChecks: [DiagnosticCheck.CourantNumber, DiagnosticCheck.ResidualTrend],
    commonActions: [ActionType.SetComputeLimit, ActionType.ReduceTimeStep, ActionType.AdjustMesh],
  },
  {
    intent: IntentCategory.ContaminationDiagnostic,
    keywords: ["contamination", "particle", "cleanroom", "iso class", "iso 14644", "retention", "dispersion", "decay", "laminar flow", "hepa", "air change", "recovery time"],
    diagnosticChecks: [DiagnosticCheck.ParticleResidenceTime, DiagnosticCheck.ContaminantDecayRate, DiagnosticCheck.ISOClassCompliance, DiagnosticCheck.LaminarCoverage],
    commonActions: [ActionType.AdjustParticleTransport, ActionType.RefineCleanroomMesh, ActionType.ProvideExplanation],
  },
  {
    intent: IntentCategory.ExhaustSystemDiagnostic,
    keywords: ["exhaust", "hood", "capture velocity", "backflow", "backdraft", "species", "fume", "ventilation", "duct", "buoyancy", "plume", "negative pressure", "contaminant removal", "exposure limit"],
    diagnosticChecks: [DiagnosticCheck.CaptureVelocity, DiagnosticCheck.BackflowRisk, DiagnosticCheck.SpeciesConcentration, DiagnosticCheck.NegativePressure],
    commonActions: [ActionType.AdjustExhaustFlow, ActionType.OptimizeHoodDesign, ActionType.AddBackdraftDamper, ActionType.ProvideExplanation],
  },
  {
    intent: IntentCategory.DataCenterDiagnostic,
    keywords: ["data center", "datacenter", "rack", "hotspot", "containment", "pue", "cooling", "crac", "crah", "cold aisle", "hot aisle", "blanking panel", "raised floor", "tile", "bypass air", "recirculation", "server room"],
    diagnosticChecks: [DiagnosticCheck.RackHotspot, DiagnosticCheck.ContainmentLeak, DiagnosticCheck.PUEDeviation, DiagnosticCheck.CoolingCapacity],
    commonActions: [ActionType.OptimizeContainment, ActionType.AdjustCoolingCapacity, ActionType.RebalanceAirflow, ActionType.ProvideExplanation],
  },
  {
    intent: IntentCategory.ComplianceDiagnostic,
    keywords: ["compliance", "regulation", "standard", "ashrae", "iso 14644", "osha", "nfpa", "acgih", "audit", "violation", "pel", "tlv", "pue target", "code", "compliant", "non-compliant", "risk score"],
    diagnosticChecks: [DiagnosticCheck.ComplianceViolation, DiagnosticCheck.RiskScoreThreshold, DiagnosticCheck.AuditReadiness],
    commonActions: [ActionType.RunComplianceAudit, ActionType.RemediateViolation, ActionType.GenerateAuditReport, ActionType.ProvideExplanation],
  },
];

// ─── Agent Implementation ───────────────────────────────────────────────────

export class CFDAIAgent {
  private readonly memory: MemoryStore;
  private readonly logger: StructuredLogger;
  private readonly inferenceClient = new InferenceClient();
  private computeService: ComputeUsageService | null = null;
  private readonly notificationLog: AgentNotification[] = [];

  constructor(memory?: MemoryStore) {
    this.memory = memory ?? new InMemoryStore();
    this.logger = new StructuredLogger("CFDAIAgent");
  }

  // ── Inference API Integration ──────────────────────────────────────

  /**
   * Get surrogate model predictions for a feature vector.
   * Used to enrich diagnostics and resolution plans with ML insights.
   */
  async getSurrogatePredictions(
    orgId: string,
    features: FeatureVector
  ): Promise<InferenceResult[]> {
    try {
      const results = await this.inferenceClient.predictAll(orgId, features);
      this.logger.info("Surrogate predictions retrieved", {
        orgId,
        predictions: results.filter((r) => r.prediction).length,
      });
      return results;
    } catch (err) {
      this.logger.warn("Failed to get surrogate predictions", { error: String(err) });
      return [];
    }
  }

  /**
   * Enrich a diagnostic report with surrogate model predictions.
   * Adds convergence risk and efficiency predictions to the report summary.
   */
  async enrichDiagnosticsWithML(
    report: DiagnosticReport,
    orgId: string,
    features: FeatureVector
  ): Promise<DiagnosticReport> {
    const predictions = await this.getSurrogatePredictions(orgId, features);

    const convergencePred = predictions.find((p) => p.prediction?.modelType === "convergence");
    const efficiencyPred = predictions.find((p) => p.prediction?.modelType === "efficiency");

    let mlSummary = "";
    if (convergencePred?.prediction) {
      mlSummary += ` ML convergence prediction: ${convergencePred.prediction.label} (confidence: ${(convergencePred.prediction.confidence * 100).toFixed(0)}%).`;
    }
    if (efficiencyPred?.prediction) {
      mlSummary += ` ML efficiency prediction: ${efficiencyPred.prediction.label} (confidence: ${(efficiencyPred.prediction.confidence * 100).toFixed(0)}%).`;
    }

    if (mlSummary) {
      return {
        ...report,
        summary: report.summary + mlSummary,
      };
    }

    return report;
  }

  // ── Compute Usage Integration ───────────────────────────────────────

  attachComputeService(service: ComputeUsageService): void {
    this.computeService = service;
    service.onAgentNotification((notification) => {
      this.handleComputeNotification(notification);
    });
    this.logger.info("ComputeUsageService attached to agent");
  }

  getComputeReport(): UsageReport | null {
    return this.computeService?.generateReport() ?? null;
  }

  getNotificationLog(): AgentNotification[] {
    return [...this.notificationLog];
  }

  private handleComputeNotification(notification: AgentNotification): void {
    this.notificationLog.push(notification);
    this.logger.warn("Compute usage notification", {
      severity: notification.severity,
      title: notification.title,
      autoAction: notification.autoAction,
    });
  }

  // ── 1. Intent Classification ────────────────────────────────────────────

  async classifyIntent(userInput: string, context: AgentContext): Promise<AgentIntent> {
    this.logger.info("Classifying intent", { sessionId: context.sessionId, inputLength: userInput.length });

    const input = userInput.toLowerCase();
    const scores = new Map<IntentCategory, number>();

    for (const pattern of KNOWLEDGE_BASE) {
      let score = 0;
      for (const keyword of pattern.keywords) {
        if (input.includes(keyword)) {
          score += keyword.split(" ").length; // multi-word keywords score higher
        }
      }
      if (score > 0) scores.set(pattern.intent, score);
    }

    let bestCategory = IntentCategory.Unknown;
    let bestScore = 0;
    for (const [category, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    const totalPossible = Math.max(1, [...scores.values()].reduce((a, b) => a + b, 0));
    const confidence = bestScore > 0 ? Math.min(bestScore / totalPossible + 0.3, 0.98) : 0.1;

    const entities = this.extractEntities(userInput);

    const intent: AgentIntent = {
      category: bestCategory,
      confidence,
      subCategory: this.deriveSubCategory(bestCategory, input),
      entities,
      rawInput: userInput,
      requiresClarification: confidence < 0.5,
      suggestedFollowUp: confidence < 0.5
        ? "Could you provide more details about the issue? For example, which simulation is affected and what symptoms are you seeing?"
        : null,
    };

    // Cache for context continuity
    await this.memory.set(`intent:${context.sessionId}:latest`, intent, 3600);

    this.logger.info("Intent classified", { category: intent.category, confidence: intent.confidence, requiresClarification: intent.requiresClarification });
    return intent;
  }

  // ── 2. Diagnostics ──────────────────────────────────────────────────────

  async runDiagnostics(context: AgentContext, intent: AgentIntent): Promise<DiagnosticReport> {
    this.logger.info("Running diagnostics", { sessionId: context.sessionId, intent: intent.category });

    const pattern = KNOWLEDGE_BASE.find((p) => p.intent === intent.category);
    const checks = pattern?.diagnosticChecks ?? [DiagnosticCheck.ResidualTrend, DiagnosticCheck.MeshOrthogonality];

    const results: DiagnosticResult[] = checks.map((check) => this.runSingleCheck(check, context));

    const overallSeverity = this.computeOverallSeverity(results);
    const rootCauses = this.identifyRootCauses(results, intent);

    const report: DiagnosticReport = {
      simulationId: context.simulationId ?? "unknown",
      jobId: context.jobId,
      runAt: new Date().toISOString(),
      overallSeverity,
      results,
      summary: this.generateDiagnosticSummary(results, rootCauses),
      rootCauseProbability: rootCauses,
    };

    await this.memory.set(`diagnostics:${context.sessionId}:latest`, report, 7200);

    this.logger.info("Diagnostics complete", { severity: overallSeverity, checksRun: results.length, rootCauses: rootCauses.length });
    return report;
  }

  // ── 3. Resolution Planning ──────────────────────────────────────────────

  async createResolutionPlan(
    context: AgentContext,
    intent: AgentIntent,
    diagnosticReport: DiagnosticReport | null
  ): Promise<ResolutionPlan> {
    this.logger.info("Creating resolution plan", { sessionId: context.sessionId, intent: intent.category });

    // Check for similar resolved issues
    const similar = await this.memory.getSimilarIssues(intent, 3);
    const hasHistoricalData = similar.length > 0;

    const actions = this.generateActions(intent, diagnosticReport, context);
    const confidence = this.computePlanConfidence(intent, diagnosticReport, hasHistoricalData);

    const plan: ResolutionPlan = {
      id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      intent,
      diagnosticReport,
      actions,
      status: PlanStatus.Pending,
      confidence,
      explanation: this.generatePlanExplanation(intent, actions, diagnosticReport),
      estimatedResolutionTime: this.estimateResolutionTime(actions),
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    await this.memory.set(`plan:${context.sessionId}:${plan.id}`, plan, 86400);

    this.logger.info("Plan created", { planId: plan.id, actionCount: actions.length, confidence });
    return plan;
  }

  // ── 4. Plan Execution ───────────────────────────────────────────────────

  async executePlan(context: AgentContext, plan: ResolutionPlan): Promise<PlanExecutionResult> {
    this.logger.info("Executing plan", { planId: plan.id, actionCount: plan.actions.length });

    plan.status = PlanStatus.InProgress;
    const actionResults: ActionResult[] = [];
    let overallSuccess = true;

    const sortedActions = [...plan.actions].sort((a, b) => a.order - b.order);

    for (const action of sortedActions) {
      if (action.requiresApproval) {
        this.logger.info("Action requires approval — skipping in automated mode", { actionId: action.id, type: action.type });
        actionResults.push({
          actionId: action.id,
          success: false,
          output: "Requires user approval before execution",
          sideEffects: [],
          error: null,
          durationMs: 0,
        });
        continue;
      }

      const result = await this.executeAction(action, context);
      actionResults.push(result);

      if (!result.success) {
        overallSuccess = false;
        this.logger.warn("Action failed, halting plan", { actionId: action.id, error: result.error });
        break;
      }
    }

    plan.status = overallSuccess ? PlanStatus.Completed : PlanStatus.Failed;
    plan.completedAt = new Date().toISOString();

    const executionResult: PlanExecutionResult = {
      planId: plan.id,
      status: plan.status,
      actionResults,
      overallSuccess,
      summary: this.generateExecutionSummary(actionResults, overallSuccess),
      followUpRequired: !overallSuccess || actionResults.some((r) => r.sideEffects.length > 0),
      followUpMessage: overallSuccess
        ? null
        : "Some actions could not be completed. Would you like me to try an alternative approach?",
    };

    this.logger.info("Plan execution complete", { planId: plan.id, success: overallSuccess });
    return executionResult;
  }

  // ── 5. Learning / Memory ────────────────────────────────────────────────

  async learnFromInteraction(
    context: AgentContext,
    intent: AgentIntent,
    diagnosticReport: DiagnosticReport | null,
    plan: ResolutionPlan | null,
    executionResult: PlanExecutionResult | null,
    userSatisfaction: number | null
  ): Promise<void> {
    this.logger.info("Recording interaction for learning", { sessionId: context.sessionId, intent: intent.category });

    await this.memory.recordInteraction({
      sessionId: context.sessionId,
      userId: context.userId,
      intent,
      diagnosticReport,
      resolutionPlan: plan,
      executionResult,
      userSatisfaction,
      resolvedWithoutEscalation:
        executionResult?.overallSuccess === true &&
        !plan?.actions.some((a) => a.type === ActionType.EscalateToSupport),
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - new Date(context.timestamp).getTime(),
    });
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  private extractEntities(input: string): AgentIntent["entities"] {
    const entities: AgentIntent["entities"] = [];

    const simIdMatch = input.match(/sim[-_]?\w{3,}/i);
    if (simIdMatch) {
      entities.push({ type: "simulation_id", value: simIdMatch[0], confidence: 0.9, position: [simIdMatch.index ?? 0, (simIdMatch.index ?? 0) + simIdMatch[0].length] });
    }

    const numericMatch = input.match(/(\d+\.?\d*)\s*(rpm|pa|m\/s|cells|iterations|hours)/gi);
    if (numericMatch) {
      for (const m of numericMatch) {
        const idx = input.indexOf(m);
        entities.push({ type: "value", value: m, confidence: 0.85, position: [idx, idx + m.length] });
      }
    }

    return entities;
  }

  private deriveSubCategory(category: IntentCategory, input: string): string | null {
    const subCategories: Partial<Record<IntentCategory, Record<string, string[]>>> = {
      [IntentCategory.ConvergenceIssue]: {
        divergence: ["diverge", "blow up", "nan", "infinity"],
        oscillation: ["oscillat", "fluctuat", "unstable"],
        stall: ["stall", "plateau", "not decreasing"],
      },
      [IntentCategory.MeshQuality]: {
        skewness: ["skew", "distort"],
        resolution: ["coarse", "refine", "resolution"],
        boundary_layer: ["y+", "yplus", "boundary layer", "wall distance"],
      },
    };

    const subs = subCategories[category];
    if (!subs) return null;

    for (const [sub, keywords] of Object.entries(subs)) {
      if (keywords.some((k) => input.includes(k))) return sub;
    }
    return null;
  }

  private runSingleCheck(check: DiagnosticCheck, _context: AgentContext): DiagnosticResult {
    // Simulated diagnostic — in production, this queries real simulation data
    const checkTemplates: Record<DiagnosticCheck, () => DiagnosticResult> = {
      [DiagnosticCheck.ResidualTrend]: () => ({ check, passed: false, value: 1e-3, threshold: "< 1e-5", severity: Severity.High, detail: "Residuals have plateaued at 1e-3, 2 orders above target" }),
      [DiagnosticCheck.MeshOrthogonality]: () => ({ check, passed: true, value: 0.85, threshold: "> 0.7", severity: Severity.Low, detail: "Average orthogonality 0.85 — acceptable" }),
      [DiagnosticCheck.MeshSkewness]: () => ({ check, passed: true, value: 0.35, threshold: "< 0.8", severity: Severity.Low, detail: "Max skewness 0.35 — good quality" }),
      [DiagnosticCheck.YPlusRange]: () => ({ check, passed: false, value: "5-120", threshold: "30-300 (wall fn) or <1 (resolved)", severity: Severity.Medium, detail: "y+ values inconsistent across walls; some below 1, others above 30" }),
      [DiagnosticCheck.CourantNumber]: () => ({ check, passed: true, value: 0.8, threshold: "< 1.0", severity: Severity.Low, detail: "Max Courant number 0.8 — within limits" }),
      [DiagnosticCheck.MassBalance]: () => ({ check, passed: true, value: 0.02, threshold: "< 1%", severity: Severity.Low, detail: "Global mass imbalance 0.02% — acceptable" }),
      [DiagnosticCheck.EnergyBalance]: () => ({ check, passed: true, value: 0.5, threshold: "< 2%", severity: Severity.Low, detail: "Energy balance error 0.5% — acceptable" }),
      [DiagnosticCheck.BoundaryConsistency]: () => ({ check, passed: false, value: null, threshold: "All BCs physically consistent", severity: Severity.High, detail: "Outlet pressure lower than inlet static — potential backflow" }),
      [DiagnosticCheck.ReferenceValues]: () => ({ check, passed: true, value: null, threshold: "Consistent with fluid properties", severity: Severity.Low, detail: "Reference pressure and temperature consistent" }),
      [DiagnosticCheck.TurbulenceRatio]: () => ({ check, passed: true, value: 12, threshold: "1-100", severity: Severity.Low, detail: "Turbulent viscosity ratio 12 — within range" }),
      [DiagnosticCheck.ParticleResidenceTime]: () => ({ check, passed: false, value: 45, threshold: "< 30s for ISO 5", severity: Severity.Medium, detail: "Mean particle residence time 45s exceeds target — check outlet placement and air change rate" }),
      [DiagnosticCheck.ContaminantDecayRate]: () => ({ check, passed: true, value: 0.92, threshold: "R² > 0.85", severity: Severity.Low, detail: "Contaminant decay fit R² = 0.92 — good exponential fit" }),
      [DiagnosticCheck.ISOClassCompliance]: () => ({ check, passed: false, value: "ISO 6", threshold: "ISO 5", severity: Severity.High, detail: "Estimated ISO class 6 exceeds target ISO 5 — particle retention rate insufficient" }),
      [DiagnosticCheck.LaminarCoverage]: () => ({ check, passed: true, value: 0.87, threshold: "> 0.80", severity: Severity.Low, detail: "Laminar coverage 87% — meets unidirectional flow requirement" }),
      [DiagnosticCheck.CaptureVelocity]: () => ({ check, passed: false, value: 0.35, threshold: "> 0.5 m/s (ACGIH min)", severity: Severity.High, detail: "Hood capture velocity 0.35 m/s is below ACGIH minimum — contaminant escape likely" }),
      [DiagnosticCheck.BackflowRisk]: () => ({ check, passed: false, value: 0.65, threshold: "< 0.2", severity: Severity.High, detail: "Backflow risk score 0.65 — reverse flow detected at exhaust openings, consider backdraft dampers" }),
      [DiagnosticCheck.SpeciesConcentration]: () => ({ check, passed: false, value: "above TLV", threshold: "Below occupational exposure limit", severity: Severity.Critical, detail: "One or more species exceed the occupational exposure limit at worker breathing zone" }),
      [DiagnosticCheck.NegativePressure]: () => ({ check, passed: true, value: -30, threshold: "< -25 Pa", severity: Severity.Low, detail: "Enclosure negative pressure -30 Pa — adequate containment" }),
      [DiagnosticCheck.RackHotspot]: () => ({ check, passed: false, value: 4, threshold: "0", severity: Severity.High, detail: "4 rack hotspots detected — exhaust temperatures exceed threshold by >5 °C" }),
      [DiagnosticCheck.ContainmentLeak]: () => ({ check, passed: false, value: 0.72, threshold: "> 0.85", severity: Severity.Medium, detail: "Containment score 0.72 — bypass air detected from missing blanking panels and unsealed cable cutouts" }),
      [DiagnosticCheck.PUEDeviation]: () => ({ check, passed: false, value: 1.65, threshold: "< 1.4", severity: Severity.Medium, detail: "Estimated PUE 1.65 exceeds target 1.4 — cooling overhead is dominant contributor" }),
      [DiagnosticCheck.CoolingCapacity]: () => ({ check, passed: true, value: 1.25, threshold: "> 1.2× IT load", severity: Severity.Low, detail: "Cooling capacity 1.25× IT load — adequate headroom" }),
      [DiagnosticCheck.ComplianceViolation]: () => ({ check, passed: false, value: 2, threshold: "0 violations", severity: Severity.High, detail: "2 regulatory violations detected — immediate remediation required" }),
      [DiagnosticCheck.RiskScoreThreshold]: () => ({ check, passed: false, value: 0.55, threshold: "< 0.3", severity: Severity.Medium, detail: "Overall compliance risk score 0.55 exceeds acceptable threshold" }),
      [DiagnosticCheck.AuditReadiness]: () => ({ check, passed: false, value: "incomplete", threshold: "All standards addressed", severity: Severity.Medium, detail: "Audit documentation incomplete — missing remediation plans for outstanding findings" }),
    };

    return checkTemplates[check]();
  }

  private computeOverallSeverity(results: DiagnosticResult[]): Severity {
    if (results.some((r) => r.severity === Severity.Critical)) return Severity.Critical;
    if (results.some((r) => r.severity === Severity.High)) return Severity.High;
    if (results.some((r) => r.severity === Severity.Medium)) return Severity.Medium;
    return Severity.Low;
  }

  private identifyRootCauses(results: DiagnosticResult[], intent: AgentIntent): RootCause[] {
    const failedChecks = results.filter((r) => !r.passed);
    if (failedChecks.length === 0) return [];

    const causes: RootCause[] = [];

    if (failedChecks.some((c) => c.check === DiagnosticCheck.ResidualTrend)) {
      causes.push({
        cause: "Solver convergence stalled due to insufficient relaxation or mesh quality",
        probability: 0.75,
        relatedChecks: [DiagnosticCheck.ResidualTrend, DiagnosticCheck.MeshOrthogonality],
        suggestedFix: "Reduce under-relaxation factors (pressure: 0.2, velocity: 0.5) and check for highly skewed cells",
      });
    }

    if (failedChecks.some((c) => c.check === DiagnosticCheck.BoundaryConsistency)) {
      causes.push({
        cause: "Boundary condition inconsistency causing non-physical flow",
        probability: 0.8,
        relatedChecks: [DiagnosticCheck.BoundaryConsistency, DiagnosticCheck.MassBalance],
        suggestedFix: "Verify inlet/outlet pressure levels ensure a positive pressure gradient in the flow direction",
      });
    }

    if (failedChecks.some((c) => c.check === DiagnosticCheck.YPlusRange)) {
      causes.push({
        cause: "Inconsistent near-wall resolution for chosen turbulence model",
        probability: 0.65,
        relatedChecks: [DiagnosticCheck.YPlusRange],
        suggestedFix: "For k-ε with wall functions, target y+ 30-300. Refine or coarsen first cell height accordingly.",
      });
    }

    return causes.sort((a, b) => b.probability - a.probability);
  }

  private generateDiagnosticSummary(results: DiagnosticResult[], rootCauses: RootCause[]): string {
    const failed = results.filter((r) => !r.passed).length;
    const total = results.length;

    if (failed === 0) return `All ${total} diagnostic checks passed. The simulation appears healthy.`;

    const topCause = rootCauses[0];
    return `${failed} of ${total} checks flagged issues. Most likely root cause (${Math.round((topCause?.probability ?? 0) * 100)}% confidence): ${topCause?.cause ?? "undetermined"}. Suggested fix: ${topCause?.suggestedFix ?? "review simulation setup"}.`;
  }

  private generateActions(
    intent: AgentIntent,
    report: DiagnosticReport | null,
    context: AgentContext
  ): PlannedAction[] {
    const pattern = KNOWLEDGE_BASE.find((p) => p.intent === intent.category);
    const actionTypes = pattern?.commonActions ?? [ActionType.ProvideExplanation];

    return actionTypes.map((type, index) => ({
      id: `action-${Date.now()}-${index}`,
      type,
      description: this.describeAction(type, report),
      parameters: this.deriveActionParameters(type, report, context),
      estimatedImpact: this.estimateActionImpact(type),
      reversible: type !== ActionType.EscalateToSupport && type !== ActionType.ApplyCredit,
      requiresApproval: type === ActionType.ApplyCredit || type === ActionType.EscalateToSupport,
      order: index,
    }));
  }

  private describeAction(type: ActionType, report: DiagnosticReport | null): string {
    const descriptions: Record<ActionType, string> = {
      [ActionType.AdjustMesh]: "Refine mesh in regions with quality issues",
      [ActionType.ModifyBoundaryCondition]: "Correct boundary condition values to ensure physical consistency",
      [ActionType.ChangeTurbulenceModel]: "Switch turbulence model for better accuracy in this flow regime",
      [ActionType.AdjustRelaxationFactors]: "Reduce under-relaxation factors to improve solver stability",
      [ActionType.ReduceTimeStep]: "Decrease time step to maintain Courant number below 1",
      [ActionType.RefineBladeTip]: "Add local mesh refinement around blade tips",
      [ActionType.ProvideExplanation]: "Explain results and provide engineering guidance",
      [ActionType.EscalateToSupport]: "Transfer to human support specialist",
      [ActionType.ApplyCredit]: "Apply compute credit to user account",
      [ActionType.SetComputeLimit]: "Configure compute usage alerts and hard limits",
      [ActionType.RestartSolver]: "Restart solver with adjusted parameters",
      [ActionType.AdjustParticleTransport]: "Adjust particle transport model parameters (parcel count, wall interaction, injection surfaces)",
      [ActionType.RefineCleanroomMesh]: "Refine mesh near HEPA filter faces, injection surfaces, and critical zones for particle tracking accuracy",
      [ActionType.AdjustExhaustFlow]: "Increase exhaust fan capacity or adjust duct sizing to improve capture velocity and containment",
      [ActionType.OptimizeHoodDesign]: "Modify hood geometry — reduce source-to-hood distance, add flanges, or switch to canopy hood for buoyant sources",
      [ActionType.AddBackdraftDamper]: "Install backdraft dampers on exhaust openings to prevent reverse flow during transient pressure fluctuations",
      [ActionType.OptimizeContainment]: "Improve hot/cold aisle containment — install blanking panels, seal cable cutouts, and add end-of-row doors",
      [ActionType.AdjustCoolingCapacity]: "Adjust CRAC/CRAH setpoints or add supplemental cooling to eliminate rack hotspots",
      [ActionType.RebalanceAirflow]: "Rebalance raised-floor tile placement and plenum airflow to match rack-level demand",
      [ActionType.RunComplianceAudit]: "Run full compliance audit against applicable regulatory standards (ASHRAE, ISO, OSHA, etc.)",
      [ActionType.RemediateViolation]: "Apply recommended remediation for identified compliance violations",
      [ActionType.GenerateAuditReport]: "Generate formal audit documentation with findings, risk scores, and remediation deadlines",
    };
    return descriptions[type];
  }

  private deriveActionParameters(
    type: ActionType,
    _report: DiagnosticReport | null,
    _context: AgentContext
  ): Record<string, unknown> {
    const paramMap: Record<ActionType, Record<string, unknown>> = {
      [ActionType.AdjustRelaxationFactors]: { pressure: 0.2, velocity: 0.5, turbulence: 0.6 },
      [ActionType.ReduceTimeStep]: { factor: 0.5 },
      [ActionType.AdjustMesh]: { targetRefinementLevels: 2, qualityThreshold: 0.85 },
      [ActionType.RefineBladeTip]: { additionalLevels: 2, tipClearanceRatio: 0.02 },
      [ActionType.ChangeTurbulenceModel]: { recommended: "k-omega-sst" },
      [ActionType.ModifyBoundaryCondition]: {},
      [ActionType.ProvideExplanation]: {},
      [ActionType.EscalateToSupport]: { priority: "normal" },
      [ActionType.ApplyCredit]: {},
      [ActionType.SetComputeLimit]: { warningThresholdPercent: 80, hardLimitPercent: 100 },
      [ActionType.RestartSolver]: { fromIteration: 0 },
      [ActionType.AdjustParticleTransport]: { increaseParcelCount: true, wallInteraction: "reflect" },
      [ActionType.RefineCleanroomMesh]: { targetRefinementLevels: 3, nearFilterRefinement: true },
      [ActionType.AdjustExhaustFlow]: { increaseFlowRatePercent: 20, checkDuctLosses: true },
      [ActionType.OptimizeHoodDesign]: { addFlanges: true, reduceStandoff: true },
      [ActionType.AddBackdraftDamper]: { damperType: "gravity", locations: "all_exhaust_openings" },
      [ActionType.OptimizeContainment]: { installBlankingPanels: true, sealCutouts: true, addDoors: true },
      [ActionType.AdjustCoolingCapacity]: { raiseSupplyTemp: false, addUnits: false },
      [ActionType.RebalanceAirflow]: { reviewTilePlacement: true, plenumObstructionCheck: true },
      [ActionType.RunComplianceAudit]: { includeAllStandards: true },
      [ActionType.RemediateViolation]: { autoApply: false, requiresApproval: true },
      [ActionType.GenerateAuditReport]: { format: "structured", includeRemediation: true },
    };
    return paramMap[type] ?? {};
  }

  private estimateActionImpact(type: ActionType): string {
    const impacts: Record<ActionType, string> = {
      [ActionType.AdjustRelaxationFactors]: "May slow convergence but prevent divergence",
      [ActionType.ReduceTimeStep]: "Increases compute time but improves stability",
      [ActionType.AdjustMesh]: "Increases cell count by ~20-40%, improves accuracy",
      [ActionType.RefineBladeTip]: "Adds ~15% cells in tip region, captures tip vortex",
      [ActionType.ChangeTurbulenceModel]: "SST generally better for separated flows and fan passages",
      [ActionType.ModifyBoundaryCondition]: "Ensures physically consistent flow field",
      [ActionType.ProvideExplanation]: "Informational only, no simulation changes",
      [ActionType.EscalateToSupport]: "Human specialist review within 24 hours",
      [ActionType.ApplyCredit]: "Refunds compute hours to account balance",
      [ActionType.SetComputeLimit]: "Prevents unexpected compute overages",
      [ActionType.RestartSolver]: "Fresh start with adjusted parameters",
      [ActionType.AdjustParticleTransport]: "Improves particle tracking accuracy and residence time prediction",
      [ActionType.RefineCleanroomMesh]: "Captures near-wall particle dynamics and HEPA filter flow distribution",
      [ActionType.AdjustExhaustFlow]: "Increases capture velocity and reduces backflow risk at exhaust openings",
      [ActionType.OptimizeHoodDesign]: "Maximizes contaminant capture at the source before dilution into the workspace",
      [ActionType.AddBackdraftDamper]: "Physically prevents reverse flow during fan-off or transient pressure events",
      [ActionType.OptimizeContainment]: "Reduces bypass air by 20-30%, lowering CRAC load and improving rack inlet temperatures",
      [ActionType.AdjustCoolingCapacity]: "Eliminates thermal hotspots by matching cooling supply to IT heat load",
      [ActionType.RebalanceAirflow]: "Ensures each rack receives adequate airflow, reducing both hotspots and overcooling",
      [ActionType.RunComplianceAudit]: "Identifies all regulatory violations and risk areas across applicable standards",
      [ActionType.RemediateViolation]: "Resolves compliance violations to bring simulation within regulatory limits",
      [ActionType.GenerateAuditReport]: "Produces formal audit documentation for regulatory review and sign-off",
    };
    return impacts[type];
  }

  private computePlanConfidence(
    intent: AgentIntent,
    report: DiagnosticReport | null,
    hasHistory: boolean
  ): number {
    let confidence = intent.confidence * 0.5;
    if (report && report.rootCauseProbability.length > 0) {
      confidence += report.rootCauseProbability[0].probability * 0.3;
    }
    if (hasHistory) confidence += 0.15;
    return Math.min(confidence, 0.98);
  }

  private generatePlanExplanation(
    intent: AgentIntent,
    actions: PlannedAction[],
    report: DiagnosticReport | null
  ): string {
    const rootCause = report?.rootCauseProbability[0];
    const actionList = actions.map((a) => a.description).join("; ");

    if (rootCause) {
      return `Based on diagnostics, the most likely cause is: ${rootCause.cause}. Planned actions: ${actionList}.`;
    }
    return `For ${intent.category.replace(/_/g, " ")}, the following actions are recommended: ${actionList}.`;
  }

  private estimateResolutionTime(actions: PlannedAction[]): string {
    const hasCompute = actions.some((a) =>
      [ActionType.AdjustMesh, ActionType.RestartSolver, ActionType.RefineBladeTip].includes(a.type)
    );
    if (hasCompute) return "30-120 minutes (requires re-computation)";
    if (actions.some((a) => a.type === ActionType.EscalateToSupport)) return "24 hours (human review)";
    return "< 5 minutes";
  }

  private async executeAction(action: PlannedAction, _context: AgentContext): Promise<ActionResult> {
    const start = Date.now();
    this.logger.info("Executing action", { actionId: action.id, type: action.type });

    // In production, each action type dispatches to a real service.
    // Here we simulate successful execution.
    return {
      actionId: action.id,
      success: true,
      output: `${action.type} executed: ${action.description}`,
      sideEffects: action.type === ActionType.AdjustMesh ? ["Cell count increased"] : [],
      error: null,
      durationMs: Date.now() - start,
    };
  }

  private generateExecutionSummary(results: ActionResult[], success: boolean): string {
    const completed = results.filter((r) => r.success).length;
    const total = results.length;
    return success
      ? `All ${total} actions completed successfully.`
      : `${completed} of ${total} actions completed. Review failed actions for manual intervention.`;
  }
}
