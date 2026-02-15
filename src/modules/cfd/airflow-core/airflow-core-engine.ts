// ─── Airflow Core Engine ───────────────────────────────────────────────────
// Unified orchestrator for all airflow domains.
// Automatically classifies simulation configs, delegates to the correct
// domain module, and returns a normalised analysis result.
//
//   AirflowCoreEngine
//     ├── HVAC            (generic internal-flow with heat transfer)
//     ├── Fan / Blower    (rotating machinery)
//     ├── Cleanroom       (particle transport + ISO compliance)
//     ├── Industrial Exhaust (species transport + backflow)
//     ├── Agriculture     (multi-zone + ammonia + heat stress)
//     └── Data Center     (rack thermal + containment + PUE)
// ──────────────────────────────────────────────────────────────────────────

import { FlowType } from "@/packages/types";
import type {
  SimulationConfig,
  FanSimulationConfig,
  CleanroomSimulationConfig,
  ExhaustSimulationConfig,
  AgricultureSimulationConfig,
  DataCenterSimulationConfig,
  EfficiencyMetrics,
  CleanroomMetrics,
  AgricultureVentilationMetrics,
  DataCenterMetrics,
  ExhaustSystemMetrics,
  SpeciesRemovalBreakdown,
  VelocityFieldEntry,
  PressureFieldEntry,
  TemperatureFieldEntry,
} from "@/packages/types";

// Domain modules
import { CFDResultsInterpreter } from "../results/results-interpreter";
import { generateRotatingFrameMeshAdjustments } from "../solver/rotating-machinery";
import { ExhaustOptimizationEngine } from "../exhaust/exhaust-optimization-engine";
import { HeatStressPredictor } from "../agriculture/heat-stress-predictor";
import { AmmoniaRiskEstimator } from "../agriculture/ammonia-risk-estimator";
import { CoolingEfficiencyPredictor } from "../datacenter/cooling-efficiency-predictor";

import type {
  AirflowDomain,
  AnySimulationConfig,
  DomainMetrics,
  AirflowAnalysisResult,
  DomainAnalysis,
  FieldData,
  ExhaustSolverData,
} from "./types";

// ── Engine ─────────────────────────────────────────────────────────────────

export class AirflowCoreEngine {
  private readonly resultsInterpreter = new CFDResultsInterpreter();
  private readonly exhaustEngine = new ExhaustOptimizationEngine();
  private readonly heatStressPredictor = new HeatStressPredictor();
  private readonly ammoniaEstimator = new AmmoniaRiskEstimator();
  private readonly coolingPredictor = new CoolingEfficiencyPredictor();

  // ════════════════════════════════════════════════════════════════════
  //  1. Domain Classification
  // ════════════════════════════════════════════════════════════════════

  /**
   * Classify a simulation config into an airflow domain.
   * Returns domain + confidence.
   */
  classifyDomain(config: AnySimulationConfig): { domain: AirflowDomain; confidence: number } {
    // Data Center — highest specificity
    if (this.isDataCenter(config)) return { domain: "data-center", confidence: 0.95 };

    // Agriculture
    if (this.isAgriculture(config)) return { domain: "agriculture", confidence: 0.95 };

    // Industrial Exhaust
    if (this.isExhaust(config)) return { domain: "industrial-exhaust", confidence: 0.93 };

    // Cleanroom
    if (this.isCleanroom(config)) return { domain: "cleanroom", confidence: 0.93 };

    // Fan / Blower (rotating machinery)
    if (this.isFanBlower(config)) return { domain: "fan-blower", confidence: 0.92 };

    // HVAC (internal flow with heat transfer, not matching other domains)
    if (this.isHVAC(config)) return { domain: "hvac", confidence: 0.80 };

    return { domain: "generic", confidence: 0.5 };
  }

  // ════════════════════════════════════════════════════════════════════
  //  2. Unified Analysis
  // ════════════════════════════════════════════════════════════════════

  /**
   * Run a full domain-specific analysis.
   *
   * @param config     Simulation configuration (any domain).
   * @param fieldData  Post-processed field data (velocity, pressure, temperature).
   * @param metrics    Domain-specific metrics from the CFD solver.
   * @param exhaust    Exhaust-specific solver outputs (only for exhaust domain).
   */
  analyze(
    config: AnySimulationConfig,
    fieldData: FieldData,
    metrics: DomainMetrics,
    exhaust?: ExhaustSolverData
  ): AirflowAnalysisResult {
    const { domain, confidence } = this.classifyDomain(config);

    const analysis = this.delegateAnalysis(
      domain,
      config,
      fieldData,
      metrics,
      exhaust
    );

    const topRecommendations = this.extractRecommendations(analysis);
    const overallHealthScore = this.computeHealthScore(analysis, metrics);

    return {
      domain,
      classificationConfidence: confidence,
      analysis,
      topRecommendations,
      overallHealthScore: round4(overallHealthScore),
      analyzedAt: new Date().toISOString(),
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //  3. Domain Delegation
  // ════════════════════════════════════════════════════════════════════

  private delegateAnalysis(
    domain: AirflowDomain,
    config: AnySimulationConfig,
    fieldData: FieldData,
    metrics: DomainMetrics,
    exhaust?: ExhaustSolverData
  ): DomainAnalysis {
    // Base summary from results interpreter
    const efficiencyMetrics = metrics.efficiency ?? this.defaultEfficiencyMetrics();
    const summary = this.resultsInterpreter.interpret(
      fieldData.velocity,
      fieldData.pressure,
      fieldData.temperature,
      efficiencyMetrics
    );

    switch (domain) {
      case "fan-blower":
        return this.analyzeFanBlower(config as FanSimulationConfig, summary);

      case "cleanroom":
        return this.analyzeCleanroom(config as CleanroomSimulationConfig, summary, metrics);

      case "industrial-exhaust":
        return this.analyzeExhaust(config as ExhaustSimulationConfig, summary, exhaust);

      case "agriculture":
        return this.analyzeAgriculture(config as AgricultureSimulationConfig, summary, metrics);

      case "data-center":
        return this.analyzeDataCenter(config as DataCenterSimulationConfig, summary, metrics);

      case "hvac":
        return { domain: "hvac", summary };

      default:
        return { domain: "generic", summary };
    }
  }

  // ── Fan / Blower ───────────────────────────────────────────────────────

  private analyzeFanBlower(
    config: FanSimulationConfig,
    summary: import("@/packages/types").HumanReadableSummary
  ): DomainAnalysis {
    const meshAdjustments = generateRotatingFrameMeshAdjustments(config);
    return {
      domain: "fan-blower",
      summary,
      meshAdjustments,
    };
  }

  // ── Cleanroom ──────────────────────────────────────────────────────────

  private analyzeCleanroom(
    config: CleanroomSimulationConfig,
    summary: import("@/packages/types").HumanReadableSummary,
    metrics: DomainMetrics
  ): DomainAnalysis {
    return {
      domain: "cleanroom",
      summary,
      isoClassEstimate: metrics.cleanroom?.isoClassEstimate ?? config.targetISOClass,
      laminarStabilityScore: metrics.cleanroom?.laminarStabilityScore ?? 0,
    };
  }

  // ── Industrial Exhaust ─────────────────────────────────────────────────

  private analyzeExhaust(
    config: ExhaustSimulationConfig,
    summary: import("@/packages/types").HumanReadableSummary,
    exhaust?: ExhaustSolverData
  ): DomainAnalysis {
    if (!exhaust) {
      return { domain: "industrial-exhaust", summary, optimization: this.emptyExhaustResult() };
    }
    const optimization = this.exhaustEngine.evaluate(
      config,
      exhaust.metrics,
      exhaust.speciesResults
    );
    return { domain: "industrial-exhaust", summary, optimization };
  }

  // ── Agriculture ────────────────────────────────────────────────────────

  private analyzeAgriculture(
    config: AgricultureSimulationConfig,
    summary: import("@/packages/types").HumanReadableSummary,
    metrics: DomainMetrics
  ): DomainAnalysis {
    const heatStress = this.heatStressPredictor.assess(config, metrics.agriculture);
    const ammoniaRisk = this.ammoniaEstimator.estimate(config, metrics.agriculture);
    return { domain: "agriculture", summary, heatStress, ammoniaRisk };
  }

  // ── Data Center ────────────────────────────────────────────────────────

  private analyzeDataCenter(
    config: DataCenterSimulationConfig,
    summary: import("@/packages/types").HumanReadableSummary,
    metrics: DomainMetrics
  ): DomainAnalysis {
    const coolingReport = this.coolingPredictor.predict(config, metrics.dataCenter);
    return { domain: "data-center", summary, coolingReport };
  }

  // ════════════════════════════════════════════════════════════════════
  //  4. Recommendations & Health Score
  // ════════════════════════════════════════════════════════════════════

  private extractRecommendations(analysis: DomainAnalysis): string[] {
    const recs: string[] = [];

    // Base summary recommendations
    recs.push(...analysis.summary.recommendations);

    // Domain-specific recommendations
    switch (analysis.domain) {
      case "industrial-exhaust":
        recs.push(...analysis.optimization.recommendations.map((r) => `[${r.priority.toUpperCase()}] ${r.message}`));
        break;
      case "agriculture":
        recs.push(...analysis.heatStress.mitigations);
        recs.push(...analysis.ammoniaRisk.mitigations);
        break;
      case "data-center":
        recs.push(...analysis.coolingReport.topRecommendations);
        break;
    }

    // Deduplicate and cap
    return [...new Set(recs)].slice(0, 10);
  }

  private computeHealthScore(analysis: DomainAnalysis, metrics: DomainMetrics): number {
    // Base health from efficiency rating
    const ratingScores: Record<string, number> = {
      Excellent: 0.95,
      Good: 0.75,
      Average: 0.50,
      Poor: 0.20,
    };
    let baseScore = ratingScores[analysis.summary.efficiencyRating] ?? 0.5;

    // Penalize separation zones
    if (analysis.summary.flowSeparationZones > 2) baseScore -= 0.1;
    if (analysis.summary.flowSeparationZones > 5) baseScore -= 0.1;

    // Domain-specific adjustments
    switch (analysis.domain) {
      case "industrial-exhaust":
        baseScore = 0.5 * baseScore + 0.5 * analysis.optimization.effectivenessScore;
        break;
      case "agriculture":
        baseScore = 0.4 * baseScore + 0.3 * (1 - analysis.heatStress.overallIndex) + 0.3 * (1 - analysis.ammoniaRisk.overallRisk);
        break;
      case "data-center":
        baseScore = 0.4 * baseScore + 0.6 * analysis.coolingReport.coolingEfficiencyScore;
        break;
      case "cleanroom":
        if (metrics.cleanroom) {
          baseScore = 0.4 * baseScore + 0.6 * metrics.cleanroom.laminarStabilityScore;
        }
        break;
    }

    return clamp01(baseScore);
  }

  // ════════════════════════════════════════════════════════════════════
  //  5. Domain Detection Guards
  // ════════════════════════════════════════════════════════════════════

  private isDataCenter(config: AnySimulationConfig): config is DataCenterSimulationConfig {
    return "rackHeatLoad" in config || "containment" in config || config.flowType === FlowType.DataCenterCooling;
  }

  private isAgriculture(config: AnySimulationConfig): config is AgricultureSimulationConfig {
    return "multiZoneModel" in config || "moistureTransport" in config || config.flowType === FlowType.AgricultureVentilation;
  }

  private isExhaust(config: AnySimulationConfig): config is ExhaustSimulationConfig {
    return "speciesTransport" in config || "exhaustBoundaryIds" in config || config.flowType === FlowType.ExhaustVentilation;
  }

  private isCleanroom(config: AnySimulationConfig): config is CleanroomSimulationConfig {
    return (
      "particleTransport" in config ||
      config.flowType === FlowType.ParticleDispersion ||
      config.flowType === FlowType.ContaminantDecay ||
      config.flowType === FlowType.LaminarFlowValidation
    );
  }

  private isFanBlower(config: AnySimulationConfig): config is FanSimulationConfig {
    return "rpm" in config || "bladeCount" in config || config.rotatingFrame?.enabled === true;
  }

  private isHVAC(config: AnySimulationConfig): boolean {
    return config.enableHeatTransfer && !this.isFanBlower(config);
  }

  // ════════════════════════════════════════════════════════════════════
  //  6. Defaults / Stubs
  // ════════════════════════════════════════════════════════════════════

  private defaultEfficiencyMetrics(): EfficiencyMetrics {
    return {
      totalPressureRiseOrDrop: 0,
      volumeFlowRate: 0,
      shaftPower: null,
      inletTotalPressure: 101325,
      outletTotalPressure: 101325,
      inletStaticPressure: 101325,
      outletStaticPressure: 101325,
      massFlowRate: 0,
      fluidDensity: 1.225,
    };
  }

  private emptyExhaustResult(): import("@/packages/types").ExhaustOptimizationResult {
    return {
      effectivenessScore: 0,
      captureVelocityRatio: 0,
      predictedRemovalEfficiency: 0,
      recommendations: [],
      speciesBreakdown: [],
      backflowAssessment: {
        overallRisk: 0,
        boundaryRisks: [],
        rootCauses: [],
        mitigations: [],
      },
    };
  }
}

// ── Utility ───────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
