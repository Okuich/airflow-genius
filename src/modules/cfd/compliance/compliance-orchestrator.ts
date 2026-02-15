// ─── Compliance Orchestrator ────────────────────────────────────────────────
// End-to-end pipeline:
//   Simulation Results → Rules → Standards → Risk → Audit Doc
// ──────────────────────────────────────────────────────────────────────────

import type {
  AirflowComplianceDomain,
  CompliancePipelineResult,
} from "@/packages/types";
import { ComplianceRulesEngine } from "./compliance-rules-engine";
import { StandardMappingEngine } from "./standard-mapping-engine";
import { RiskScoringEngine } from "./risk-scoring-engine";
import { AuditDocumentGenerator } from "./audit-doc-generator";

export class ComplianceOrchestrator {
  private readonly rulesEngine: ComplianceRulesEngine;
  private readonly standardMapper = new StandardMappingEngine();
  private readonly riskScorer = new RiskScoringEngine();
  private readonly auditGen = new AuditDocumentGenerator();

  constructor(customRules?: import("@/packages/types").ComplianceRule[]) {
    this.rulesEngine = new ComplianceRulesEngine(customRules);
  }

  /**
   * Run the full compliance pipeline.
   *
   * @param simulationId    Simulation identifier.
   * @param organizationId  Org for audit doc attribution.
   * @param domain          Airflow domain to scope rules.
   * @param metrics         Key-value metric map from simulation results.
   * @param contextKeywords Optional keywords to refine standard mapping.
   */
  run(params: {
    simulationId: string;
    organizationId: string;
    domain: AirflowComplianceDomain;
    metrics: Record<string, number>;
    contextKeywords?: string[];
  }): CompliancePipelineResult {
    // 1. Evaluate rules
    const checkResults = this.rulesEngine.evaluate(params.metrics, params.domain);

    // 2. Map standards
    const standardMappings = this.standardMapper.mapStandards(
      params.domain,
      params.contextKeywords
    );

    // 3. Score risk
    const riskReport = this.riskScorer.computeRisk(checkResults);

    // 4. Generate audit document
    const auditDocument = this.auditGen.generate({
      simulationId: params.simulationId,
      organizationId: params.organizationId,
      checkResults,
      standardMappings,
      riskReport,
    });

    return {
      simulationId: params.simulationId,
      checkResults,
      standardMappings,
      riskReport,
      auditDocument,
      analyzedAt: new Date().toISOString(),
    };
  }
}
