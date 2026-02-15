// ─── Compliance Report Generator ────────────────────────────────────────────
// Produces deterministic, PDF-ready structured compliance reports with:
//   • Regulatory references from the standard catalog
//   • Simulation metadata hash for integrity verification
//   • Timestamp & digital signature placeholder
//   • Deterministic output (same inputs → same output, modulo timestamp)
// ──────────────────────────────────────────────────────────────────────────

import type {
  ComplianceFinding,
  ComplianceRiskReport,
  StandardMapping,
  AuditDocument,
  ComplianceRule,
} from "@/packages/types";
import { RULE_LIBRARY } from "@/packages/compliance-knowledge";
import { STANDARD_CATALOG } from "@/packages/compliance-knowledge/standard-catalog";
import { MeshQualityAnalyzer, type MeshQualityThresholds } from "@/modules/cfd/diagnostics";

// ── Types ───────────────────────────────────────────────────────────────────

export interface RegulatoryReference {
  standard: string;
  authority: string;
  title: string;
  editionYear: number;
  applicableClauses: { clauseId: string; title: string; requirement: string }[];
}

export interface ReportFindingEntry {
  index: number;
  ruleId: string;
  authority: string;
  standardCode: string;
  description: string;
  severity: string;
  status: "Pass" | "Fail";
  measuredValue: number;
  threshold: number;
  operator: string;
  recommendation: string;
  deadline: string | null;
}

export interface ReportRiskSummary {
  overallScore: number;
  highRiskCount: number;
  projectedRemediationCost: number;
  complianceProbability: number;
  verdict: "compliant" | "conditionally_compliant" | "non_compliant";
  verdictLabel: string;
}

export interface DigitalSignaturePlaceholder {
  signerId: string | null;
  signerRole: string;
  signedAt: string | null;
  signatureHash: string | null;
  status: "pending" | "signed" | "rejected";
}

/** Mesh diagnostics section for compliance reports. */
export interface ReportMeshDiagnostics {
  skewnessIssues: number;
  aspectRatioIssues: number;
  skewnessFailRate: number;
  aspectRatioFailRate: number;
  wallResolutionQuality: "Poor" | "Acceptable" | "Good";
  yPlusStats: { min: number; max: number; mean: number; median: number };
  remediationSteps: string[];
}

export interface ComplianceReportDocument {
  /** Deterministic report ID derived from metadata hash. */
  reportId: string;
  /** Report version for future schema changes. */
  version: "1.0";
  /** ISO timestamp of generation. */
  generatedAt: string;
  /** SHA-256 hex hash of simulation metadata for integrity verification. */
  metadataHash: string;

  /** Simulation identification. */
  simulation: {
    simulationId: string;
    organizationId: string;
  };

  /** Risk summary and verdict. */
  riskSummary: ReportRiskSummary;

  /** All findings (pass + fail), sorted by severity then ruleId. */
  findings: ReportFindingEntry[];

  /** Regulatory references derived from findings. */
  regulatoryReferences: RegulatoryReference[];

  /** Digital signature placeholders. */
  signatures: DigitalSignaturePlaceholder[];

  /** Mesh quality diagnostics with auto-generated remediation steps. */
  meshDiagnostics?: ReportMeshDiagnostics;

  /** Raw data hash inputs (for audit reproducibility). */
  integrityManifest: {
    findingCount: number;
    failCount: number;
    passCount: number;
    ruleIdsEvaluated: string[];
    hashAlgorithm: "SHA-256";
    metadataHash: string;
  };
}

export interface MeshDataInput {
  cellSkewness: number[];
  aspectRatios: number[];
  yPlusValues: number[];
  thresholds?: Partial<MeshQualityThresholds>;
}

export interface ReportGeneratorInput {
  simulationId: string;
  organizationId: string;
  findings: ComplianceFinding[];
  riskReport: ComplianceRiskReport;
  standardMappings?: StandardMapping[];
  /** Optional mesh data — when provided, mesh diagnostics are included in the report. */
  meshData?: MeshDataInput;
  /** Override timestamp for deterministic tests. */
  timestamp?: string;
}

// ── Severity sort order ─────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

// ── Generator ───────────────────────────────────────────────────────────────

export class ComplianceReportGenerator {
  /**
   * Generate a deterministic, PDF-ready compliance report document.
   * Given the same inputs and timestamp, the output is identical.
   */
  async generate(input: ReportGeneratorInput): Promise<ComplianceReportDocument> {
    const timestamp = input.timestamp ?? new Date().toISOString();

    // ── Metadata hash ────────────────────────────────────────────────────
    const metadataHash = await this.computeMetadataHash(input);

    // ── Report ID (deterministic from hash) ──────────────────────────────
    const reportId = `rpt-${metadataHash.slice(0, 16)}`;

    // ── Findings ─────────────────────────────────────────────────────────
    const findings = this.buildFindings(input.findings);

    // ── Regulatory references ────────────────────────────────────────────
    const regulatoryReferences = this.buildRegulatoryReferences(input.findings);

    // ── Risk summary ─────────────────────────────────────────────────────
    const riskSummary = this.buildRiskSummary(input.riskReport, input.findings);

    // ── Signatures ───────────────────────────────────────────────────────
    const signatures = this.buildSignaturePlaceholders(riskSummary.verdict);

    // ── Mesh diagnostics ─────────────────────────────────────────────────
    const meshDiagnostics = input.meshData
      ? this.buildMeshDiagnostics(input.meshData)
      : undefined;

    // ── Integrity manifest ───────────────────────────────────────────────
    const ruleIdsEvaluated = [...input.findings.map((f) => f.ruleId)].sort();
    const failCount = input.findings.filter((f) => f.status === "Fail").length;

    return {
      reportId,
      version: "1.0",
      generatedAt: timestamp,
      metadataHash,
      simulation: {
        simulationId: input.simulationId,
        organizationId: input.organizationId,
      },
      riskSummary,
      findings,
      regulatoryReferences,
      signatures,
      meshDiagnostics,
      integrityManifest: {
        findingCount: input.findings.length,
        failCount,
        passCount: input.findings.length - failCount,
        ruleIdsEvaluated,
        hashAlgorithm: "SHA-256",
        metadataHash,
      },
    };
  }

  // ── Metadata Hash ──────────────────────────────────────────────────────

  /**
   * Compute a deterministic SHA-256 hash of the simulation metadata
   * and findings for integrity verification.
   */
  private async computeMetadataHash(input: ReportGeneratorInput): Promise<string> {
    const canonical = JSON.stringify({
      simulationId: input.simulationId,
      organizationId: input.organizationId,
      findings: input.findings
        .map((f) => ({
          ruleId: f.ruleId,
          status: f.status,
          measuredValue: f.measuredValue,
          threshold: f.threshold,
          riskLevel: f.riskLevel,
        }))
        .sort((a, b) => a.ruleId.localeCompare(b.ruleId)),
      riskReport: input.riskReport,
    });

    // Use Web Crypto API (available in browsers and Deno/Edge)
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const data = new TextEncoder().encode(canonical);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    // Fallback: deterministic simple hash for environments without crypto.subtle
    return this.simpleDeterministicHash(canonical);
  }

  /** Simple deterministic hash fallback (not cryptographic). */
  private simpleDeterministicHash(input: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < input.length; i++) {
      const ch = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    const combined = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
    return combined.padStart(64, "0");
  }

  // ── Findings Builder ───────────────────────────────────────────────────

  private buildFindings(findings: ComplianceFinding[]): ReportFindingEntry[] {
    return findings
      .map((f, i) => {
        const rule = RULE_LIBRARY.find((r) => r.id === f.ruleId);
        return {
          index: i + 1,
          ruleId: f.ruleId,
          authority: rule?.authority ?? "OSHA",
          standardCode: rule?.standardCode ?? f.ruleId,
          description: rule?.description ?? f.ruleId,
          severity: f.riskLevel,
          status: f.status,
          measuredValue: f.measuredValue,
          threshold: f.threshold,
          operator: rule?.operator ?? "<=",
          recommendation: f.recommendation,
          deadline: this.resolveDeadline(f),
        };
      })
      .sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
          a.ruleId.localeCompare(b.ruleId)
      );
  }

  private resolveDeadline(f: ComplianceFinding): string | null {
    if (f.status === "Pass") return null;
    switch (f.riskLevel) {
      case "Critical": return "immediate";
      case "High": return "7 days";
      case "Medium": return "30 days";
      case "Low": return "90 days";
      default: return null;
    }
  }

  // ── Regulatory References ──────────────────────────────────────────────

  private buildRegulatoryReferences(findings: ComplianceFinding[]): RegulatoryReference[] {
    const ruleIds = new Set(findings.map((f) => f.ruleId));
    const rules = RULE_LIBRARY.filter((r) => ruleIds.has(r.id));

    // Group rules by standard code prefix to find matching catalog entries
    const standardKeys = new Set<string>();
    for (const rule of rules) {
      const catalogEntry = STANDARD_CATALOG.find((s) =>
        s.clauses.some((c) =>
          rule.standardCode.includes(c.clauseId) ||
          s.standard.replace("_", " ").includes(rule.standardCode.split(" ")[0])
        )
      );
      if (catalogEntry) {
        standardKeys.add(catalogEntry.standard);
      }
    }

    // Also match by authority
    for (const rule of rules) {
      const byAuthority = STANDARD_CATALOG.find(
        (s) => s.authority === rule.authority && !standardKeys.has(s.standard)
      );
      if (byAuthority) standardKeys.add(byAuthority.standard);
    }

    return STANDARD_CATALOG
      .filter((s) => standardKeys.has(s.standard))
      .map((s) => ({
        standard: s.standard,
        authority: s.authority,
        title: s.title,
        editionYear: s.editionYear,
        applicableClauses: s.clauses.map((c) => ({
          clauseId: c.clauseId,
          title: c.title,
          requirement: c.requirement,
        })),
      }))
      .sort((a, b) => a.standard.localeCompare(b.standard));
  }

  // ── Risk Summary ───────────────────────────────────────────────────────

  private buildRiskSummary(
    riskReport: ComplianceRiskReport,
    findings: ComplianceFinding[]
  ): ReportRiskSummary {
    const failures = findings.filter((f) => f.status === "Fail");
    let verdict: ReportRiskSummary["verdict"];

    if (riskReport.highRiskCount > 0 || riskReport.overallScore >= 50) {
      verdict = "non_compliant";
    } else if (failures.length > 0) {
      verdict = "conditionally_compliant";
    } else {
      verdict = "compliant";
    }

    const VERDICT_LABELS: Record<string, string> = {
      compliant: "COMPLIANT",
      conditionally_compliant: "CONDITIONALLY COMPLIANT",
      non_compliant: "NON-COMPLIANT",
    };

    return {
      ...riskReport,
      verdict,
      verdictLabel: VERDICT_LABELS[verdict],
    };
  }

  // ── Signature Placeholders ─────────────────────────────────────────────

  private buildSignaturePlaceholders(
    verdict: ReportRiskSummary["verdict"]
  ): DigitalSignaturePlaceholder[] {
    const signatures: DigitalSignaturePlaceholder[] = [
      {
        signerId: null,
        signerRole: "Compliance Officer",
        signedAt: null,
        signatureHash: null,
        status: "pending",
      },
      {
        signerId: null,
        signerRole: "Engineering Lead",
        signedAt: null,
        signatureHash: null,
        status: "pending",
      },
    ];

    if (verdict === "non_compliant") {
      signatures.push({
        signerId: null,
        signerRole: "Executive Sponsor",
        signedAt: null,
        signatureHash: null,
        status: "pending",
      });
    }

    return signatures;
  }

  // ── Mesh Diagnostics ──────────────────────────────────────────────────

  private buildMeshDiagnostics(meshData: MeshDataInput): ReportMeshDiagnostics {
    const analyzer = new MeshQualityAnalyzer(meshData.thresholds);
    const report = analyzer.analyse(
      meshData.cellSkewness,
      meshData.aspectRatios,
      meshData.yPlusValues
    );

    // Build actionable remediation steps from suggestions + cross-domain knowledge
    const remediationSteps: string[] = [];

    if (report.skewnessFailRate > 0.1) {
      remediationSteps.push(
        "CRITICAL: Re-mesh regions with skewness > 0.85 using smaller base cell size and 3+ Laplacian smoothing passes"
      );
    } else if (report.skewnessIssues > 0) {
      remediationSteps.push(
        "Apply 2–3 Laplacian smoothing iterations to reduce skewness in affected cells"
      );
    }

    if (report.aspectRatioFailRate > 0.05) {
      remediationSteps.push(
        "Reduce boundary-layer growth rate to 1.1–1.15 and add local size controls near thin surfaces to lower aspect ratios"
      );
    }

    if (report.wallResolutionQuality === "Poor") {
      if (report.yPlusStats.mean > 300) {
        remediationSteps.push(
          "Add boundary-layer prism cells: target first-cell height for y+ ≈ 50, use 10–15 layers with growth rate 1.2"
        );
      } else if (report.yPlusStats.mean < 1) {
        remediationSteps.push(
          "y+ is very low — consider switching to wall-function turbulence model or increasing first-cell height to reduce cell count"
        );
      } else {
        remediationSteps.push(
          "Adjust first-cell height to bring y+ within wall-function range (30–300) or wall-resolved range (< 1)"
        );
      }
    } else if (report.wallResolutionQuality === "Acceptable") {
      remediationSteps.push(
        "Fine-tune first-cell height for more uniform y+ distribution across all wall surfaces"
      );
    }

    if (remediationSteps.length === 0) {
      remediationSteps.push("Mesh quality is within acceptable limits — no remediation required");
    }

    return {
      skewnessIssues: report.skewnessIssues,
      aspectRatioIssues: report.aspectRatioIssues,
      skewnessFailRate: report.skewnessFailRate,
      aspectRatioFailRate: report.aspectRatioFailRate,
      wallResolutionQuality: report.wallResolutionQuality,
      yPlusStats: report.yPlusStats,
      remediationSteps,
    };
  }
}
