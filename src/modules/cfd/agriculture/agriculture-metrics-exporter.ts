// ─── Agriculture Ventilation Metrics Exporter ──────────────────────────────
// Exports AgricultureVentilationMetrics, AmmoniaRiskAssessment, and
// HeatStressAssessment data to CSV and JSON for regulatory reporting.
// ──────────────────────────────────────────────────────────────────────────

import type {
  AgricultureVentilationMetrics,
  AmmoniaRiskAssessment,
  HeatStressAssessment,
  ZoneAmmoniaLevel,
  ZoneHeatStress,
} from "@/packages/types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AgricultureExportPayload {
  /** Report metadata */
  reportId: string;
  generatedAt: string;
  organizationId: string;
  facilityName: string;
  livestockType: string;
  reportingPeriod: { from: string; to: string };

  /** Core metrics */
  ventilationMetrics: AgricultureVentilationMetrics;

  /** Risk assessments */
  ammoniaAssessment: AmmoniaRiskAssessment;
  heatStressAssessment: HeatStressAssessment;

  /** Regulatory context */
  regulatoryStandards: RegulatoryReference[];
}

export interface RegulatoryReference {
  standardCode: string;
  authority: string;
  description: string;
  metric: string;
  threshold: number;
  unit: string;
  status: "pass" | "fail" | "warning";
  actualValue: number;
}

export type AgricultureExportFormat = "csv" | "json";

// ── Exporter ───────────────────────────────────────────────────────────────

export class AgricultureMetricsExporter {
  /**
   * Generate a full regulatory export payload from analysis results.
   */
  buildPayload(params: {
    organizationId: string;
    facilityName: string;
    livestockType: string;
    reportingPeriod: { from: string; to: string };
    metrics: AgricultureVentilationMetrics;
    ammoniaAssessment: AmmoniaRiskAssessment;
    heatStressAssessment: HeatStressAssessment;
    ammoniaLimitPpm?: number;
  }): AgricultureExportPayload {
    const ammoniaLimit = params.ammoniaLimitPpm ?? 25;

    const regulatoryStandards: RegulatoryReference[] = [
      {
        standardCode: "29 CFR 1910.1000",
        authority: "OSHA",
        description: "Ammonia 8-hr TWA exposure limit",
        metric: "ammoniaConcentration",
        threshold: ammoniaLimit,
        unit: "ppm",
        status: params.metrics.ammoniaConcentration <= ammoniaLimit ? "pass" : "fail",
        actualValue: params.metrics.ammoniaConcentration,
      },
      {
        standardCode: "ACGIH TLV-TWA",
        authority: "ACGIH",
        description: "Ammonia TLV-TWA",
        metric: "ammoniaConcentration",
        threshold: 25,
        unit: "ppm",
        status: params.metrics.ammoniaConcentration <= 25 ? "pass" : "fail",
        actualValue: params.metrics.ammoniaConcentration,
      },
      {
        standardCode: "ASHRAE 62.1",
        authority: "ASHRAE",
        description: "Minimum ventilation rate compliance",
        metric: "airflowUniformityIndex",
        threshold: 0.6,
        unit: "index",
        status: params.metrics.airflowUniformityIndex >= 0.6
          ? params.metrics.airflowUniformityIndex >= 0.8 ? "pass" : "warning"
          : "fail",
        actualValue: params.metrics.airflowUniformityIndex,
      },
      {
        standardCode: "Animal Welfare Standard",
        authority: "Industry",
        description: "Heat stress index within safe limits",
        metric: "heatStressIndex",
        threshold: 0.5,
        unit: "index",
        status: params.heatStressAssessment.riskLevel === "safe" ? "pass"
          : params.heatStressAssessment.riskLevel === "caution" ? "warning" : "fail",
        actualValue: params.heatStressAssessment.overallIndex,
      },
    ];

    return {
      reportId: `agri-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      generatedAt: new Date().toISOString(),
      organizationId: params.organizationId,
      facilityName: params.facilityName,
      livestockType: params.livestockType,
      reportingPeriod: params.reportingPeriod,
      ventilationMetrics: params.metrics,
      ammoniaAssessment: params.ammoniaAssessment,
      heatStressAssessment: params.heatStressAssessment,
      regulatoryStandards,
    };
  }

  /**
   * Export the payload to the requested format.
   */
  export(payload: AgricultureExportPayload, format: AgricultureExportFormat): { content: string; filename: string; mimeType: string } {
    const slug = payload.reportId.slice(0, 30);
    if (format === "json") {
      return {
        content: JSON.stringify(payload, null, 2),
        filename: `${slug}.json`,
        mimeType: "application/json",
      };
    }
    return {
      content: this.toCsv(payload),
      filename: `${slug}.csv`,
      mimeType: "text/csv",
    };
  }

  // ── CSV Rendering ──────────────────────────────────────────────────────

  private toCsv(payload: AgricultureExportPayload): string {
    const sections: string[] = [];

    // Header
    sections.push("# Agriculture Ventilation Metrics — Regulatory Report");
    sections.push(`Report ID,${payload.reportId}`);
    sections.push(`Generated,${payload.generatedAt}`);
    sections.push(`Organization,${payload.organizationId}`);
    sections.push(`Facility,${payload.facilityName}`);
    sections.push(`Livestock Type,${payload.livestockType}`);
    sections.push(`Period From,${payload.reportingPeriod.from}`);
    sections.push(`Period To,${payload.reportingPeriod.to}`);
    sections.push("");

    // Core Metrics
    sections.push("## Ventilation Metrics");
    sections.push("Metric,Value");
    sections.push(`Ammonia Concentration (ppm),${payload.ventilationMetrics.ammoniaConcentration}`);
    sections.push(`Heat Stress Index,${payload.ventilationMetrics.heatStressIndex}`);
    sections.push(`Humidity Stability,${payload.ventilationMetrics.humidityStability}`);
    sections.push(`Airflow Uniformity Index,${payload.ventilationMetrics.airflowUniformityIndex}`);
    sections.push("");

    // Ammonia Zone Breakdown
    sections.push("## Ammonia Zone Concentrations");
    sections.push("Zone ID,Zone Name,Concentration (ppm),Peak (ppm),Exceeds Limit");
    for (const z of payload.ammoniaAssessment.zoneConcentrations) {
      sections.push(`${z.zoneId},${z.zoneName},${z.concentration},${z.peakConcentration},${z.exceedsLimit}`);
    }
    sections.push(`Overall Risk,${payload.ammoniaAssessment.overallRisk}`);
    sections.push(`Daily Emission (kg/day),${payload.ammoniaAssessment.dailyEmission}`);
    sections.push("");

    // Heat Stress Zone Breakdown
    sections.push("## Heat Stress Zone Assessments");
    sections.push("Zone ID,Zone Name,THI,Effective Temp (°C),Air Velocity (m/s),Heat Stress Index");
    for (const z of payload.heatStressAssessment.zoneAssessments) {
      sections.push(`${z.zoneId},${z.zoneName},${z.temperatureHumidityIndex},${z.effectiveTemperature},${z.airVelocityAtAnimalLevel},${z.heatStressIndex}`);
    }
    sections.push(`Overall Index,${payload.heatStressAssessment.overallIndex}`);
    sections.push(`Risk Level,${payload.heatStressAssessment.riskLevel}`);
    sections.push("");

    // Regulatory Compliance
    sections.push("## Regulatory Compliance");
    sections.push("Standard,Authority,Description,Metric,Threshold,Unit,Actual,Status");
    for (const r of payload.regulatoryStandards) {
      sections.push(`${r.standardCode},${r.authority},"${r.description}",${r.metric},${r.threshold},${r.unit},${r.actualValue},${r.status}`);
    }
    sections.push("");

    // Mitigations
    sections.push("## Ammonia Mitigations");
    for (const m of payload.ammoniaAssessment.mitigations) {
      sections.push(`"${m.replace(/"/g, '""')}"`);
    }
    sections.push("");
    sections.push("## Heat Stress Mitigations");
    for (const m of payload.heatStressAssessment.mitigations) {
      sections.push(`"${m.replace(/"/g, '""')}"`);
    }

    return sections.join("\n");
  }
}

// ── Download helper ──────────────────────────────────────────────────────

export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
