import { useState, useMemo } from "react";
import type { CoolingEfficiencyReport } from "@/modules/cfd/datacenter";
import type { DataCenterSimulationConfig } from "@/packages/types";
import {
  Stethoscope,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Thermometer,
  Wind,
  Zap,
  Wrench,
  ArrowRight,
  CircleDot,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

type Severity = "pass" | "warning" | "critical";

interface DiagnosticCheck {
  id: string;
  label: string;
  description: string;
  severity: Severity;
  value: string;
  threshold: string;
  actions: RecommendedAction[];
}

interface RecommendedAction {
  title: string;
  detail: string;
  impact: "high" | "medium" | "low";
  category: "containment" | "cooling" | "airflow" | "infrastructure";
}

interface WizardStep {
  id: string;
  title: string;
  icon: React.ElementType;
  checks: DiagnosticCheck[];
}

// ── Diagnostics Engine ───────────────────────────────────────────────────

function buildSteps(
  report: CoolingEfficiencyReport,
  config: DataCenterSimulationConfig
): WizardStep[] {
  const { hotspotAssessment, containmentAssessment, pueEstimate } = report;

  // Step 1: Thermal
  const thermalChecks: DiagnosticCheck[] = [];
  const hotspotRatio = hotspotAssessment.hotspotCount / Math.max(hotspotAssessment.rackTemperatures.length, 1);

  thermalChecks.push({
    id: "hotspot-count",
    label: "Hotspot Count",
    description: `${hotspotAssessment.hotspotCount} rack(s) exceed the ΔT threshold of ${config.rackHeatLoad.hotspotThreshold}°C above supply.`,
    severity: hotspotAssessment.hotspotCount === 0 ? "pass" : hotspotRatio > 0.3 ? "critical" : "warning",
    value: `${hotspotAssessment.hotspotCount}`,
    threshold: "0",
    actions: hotspotAssessment.hotspotCount > 0
      ? [
          { title: "Redistribute workloads", detail: "Move high-density workloads away from hotspot racks to balance thermal load across the hall.", impact: "high", category: "airflow" },
          { title: "Add targeted cooling", detail: "Deploy in-row cooling units adjacent to hotspot racks for localised heat extraction.", impact: "high", category: "cooling" },
        ]
      : [],
  });

  thermalChecks.push({
    id: "thermal-risk",
    label: "Thermal Risk Level",
    description: `Overall thermal risk is rated "${hotspotAssessment.thermalRisk}".`,
    severity: hotspotAssessment.thermalRisk === "safe" ? "pass" : hotspotAssessment.thermalRisk === "critical" ? "critical" : "warning",
    value: hotspotAssessment.thermalRisk,
    threshold: "safe",
    actions: hotspotAssessment.thermalRisk !== "safe"
      ? [{ title: "Lower supply air temperature", detail: `Reduce supply air from ${config.rackHeatLoad.supplyAirTemperature}°C toward ASHRAE A1 minimum (18°C) to increase cooling headroom.`, impact: "medium", category: "cooling" }]
      : [],
  });

  // Step 2: Containment
  const containmentChecks: DiagnosticCheck[] = [];

  containmentChecks.push({
    id: "containment-score",
    label: "Containment Score",
    description: `Containment integrity is ${(containmentAssessment.containmentScore * 100).toFixed(0)}%. Target ≥ 90%.`,
    severity: containmentAssessment.containmentScore >= 0.9 ? "pass" : containmentAssessment.containmentScore >= 0.7 ? "warning" : "critical",
    value: `${(containmentAssessment.containmentScore * 100).toFixed(0)}%`,
    threshold: "≥ 90%",
    actions: containmentAssessment.containmentScore < 0.9
      ? containmentAssessment.leakSources.map((leak) => ({
          title: `Fix: ${leak.location}`,
          detail: `Severity ${(leak.severity * 100).toFixed(0)}% — estimated leakage ${leak.leakageRate.toFixed(2)} m³/s. Address ${leak.fixCategory} issues.`,
          impact: leak.severity > 0.5 ? "high" as const : "medium" as const,
          category: "containment" as const,
        }))
      : [],
  });

  containmentChecks.push({
    id: "bypass-air",
    label: "Bypass Air Fraction",
    description: `${(containmentAssessment.bypassAirFraction * 100).toFixed(0)}% of supply air bypasses IT equipment. Target < 10%.`,
    severity: containmentAssessment.bypassAirFraction <= 0.1 ? "pass" : containmentAssessment.bypassAirFraction <= 0.2 ? "warning" : "critical",
    value: `${(containmentAssessment.bypassAirFraction * 100).toFixed(0)}%`,
    threshold: "< 10%",
    actions: containmentAssessment.bypassAirFraction > 0.1
      ? [
          { title: "Install blanking panels", detail: "Fill all unused rack U-slots with blanking panels to prevent cold air bypass.", impact: "high", category: "containment" },
          { title: "Seal cable cutouts", detail: "Use brush grommets or foam blocks on all cable penetrations.", impact: "medium", category: "containment" },
        ]
      : [],
  });

  // Step 3: PUE & Efficiency
  const pueChecks: DiagnosticCheck[] = [];

  pueChecks.push({
    id: "pue-value",
    label: "Power Usage Effectiveness",
    description: `Estimated PUE is ${pueEstimate.estimatedPUE.toFixed(2)}. Target: ${config.targetPUE}. Class: ${pueEstimate.efficiencyClass}.`,
    severity: pueEstimate.estimatedPUE <= config.targetPUE ? "pass" : pueEstimate.estimatedPUE <= 1.8 ? "warning" : "critical",
    value: pueEstimate.estimatedPUE.toFixed(2),
    threshold: `≤ ${config.targetPUE}`,
    actions: pueEstimate.estimatedPUE > config.targetPUE
      ? [
          { title: "Raise supply temperature", detail: "Increasing supply air temperature reduces cooling energy. Each 1°C increase can lower PUE by ~0.02.", impact: "high", category: "cooling" },
          { title: "Upgrade to variable-speed fans", detail: "Variable-speed CRAH fans match airflow to real-time demand, cutting air-movement overhead.", impact: "medium", category: "infrastructure" },
        ]
      : [],
  });

  pueChecks.push({
    id: "cooling-overhead",
    label: "Cooling Overhead",
    description: `Cooling contributes ${(pueEstimate.breakdown.coolingOverhead * 100).toFixed(0)}% overhead to total facility power.`,
    severity: pueEstimate.breakdown.coolingOverhead <= 0.3 ? "pass" : pueEstimate.breakdown.coolingOverhead <= 0.5 ? "warning" : "critical",
    value: `${(pueEstimate.breakdown.coolingOverhead * 100).toFixed(0)}%`,
    threshold: "≤ 30%",
    actions: pueEstimate.breakdown.coolingOverhead > 0.3
      ? [
          { title: "Enable free cooling", detail: "Use economiser modes when outdoor temperature permits to reduce compressor runtime.", impact: "high", category: "cooling" },
          { title: "Optimise cooling unit placement", detail: "Run the Cooling Topology Optimizer to find optimal unit count and placement.", impact: "medium", category: "infrastructure" },
        ]
      : [],
  });

  pueChecks.push({
    id: "efficiency-score",
    label: "Composite Efficiency",
    description: `Overall cooling efficiency score is ${(report.coolingEfficiencyScore * 100).toFixed(1)}%.`,
    severity: report.coolingEfficiencyScore >= 0.8 ? "pass" : report.coolingEfficiencyScore >= 0.6 ? "warning" : "critical",
    value: `${(report.coolingEfficiencyScore * 100).toFixed(1)}%`,
    threshold: "≥ 80%",
    actions: report.coolingEfficiencyScore < 0.8
      ? [{ title: "Run full optimization", detail: "Use the Cooling Topology Optimizer to systematically improve containment, temperature, and airflow parameters.", impact: "high", category: "infrastructure" }]
      : [],
  });

  return [
    { id: "thermal", title: "Thermal Analysis", icon: Thermometer, checks: thermalChecks },
    { id: "containment", title: "Containment Integrity", icon: Wind, checks: containmentChecks },
    { id: "efficiency", title: "PUE & Efficiency", icon: Zap, checks: pueChecks },
  ];
}

// ── Sub-components ───────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === "pass") return <CheckCircle2 className="w-4 h-4 text-data-emerald" />;
  if (severity === "warning") return <AlertTriangle className="w-4 h-4 text-data-amber" />;
  return <XCircle className="w-4 h-4 text-data-rose" />;
}

function severityBg(s: Severity) {
  if (s === "pass") return "border-data-emerald/20 bg-data-emerald/5";
  if (s === "warning") return "border-data-amber/20 bg-data-amber/5";
  return "border-data-rose/20 bg-data-rose/5";
}

function impactBadge(impact: "high" | "medium" | "low") {
  const styles: Record<string, string> = {
    high: "bg-data-rose/15 text-data-rose",
    medium: "bg-data-amber/15 text-data-amber",
    low: "bg-data-emerald/15 text-data-emerald",
  };
  return <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${styles[impact]}`}>{impact}</span>;
}

function categoryIcon(cat: string) {
  const map: Record<string, string> = {
    containment: "🛡️",
    cooling: "❄️",
    airflow: "💨",
    infrastructure: "🔧",
  };
  return map[cat] ?? "⚙️";
}

// ── Wizard Component ─────────────────────────────────────────────────────

interface Props {
  report: CoolingEfficiencyReport;
  config: DataCenterSimulationConfig;
}

export function CoolingDiagnosticsWizard({ report, config }: Props) {
  const steps = useMemo(() => buildSteps(report, config), [report, config]);
  const [currentStep, setCurrentStep] = useState(0);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);

  const step = steps[currentStep];
  const totalIssues = steps.reduce(
    (acc, s) => acc + s.checks.filter((c) => c.severity !== "pass").length,
    0
  );
  const totalActions = steps.reduce(
    (acc, s) => acc + s.checks.reduce((a2, c) => a2 + c.actions.length, 0),
    0
  );

  return (
    <div className="surface-raised rounded-xl border border-surface-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-data-cyan" />
          <h3 className="text-sm font-semibold text-foreground">Cooling Diagnostics Wizard</h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{totalIssues} issue{totalIssues !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{totalActions} action{totalActions !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Step Nav */}
      <div className="flex border-b border-surface-border">
        {steps.map((s, i) => {
          const issues = s.checks.filter((c) => c.severity !== "pass").length;
          const isCurrent = i === currentStep;
          return (
            <button
              key={s.id}
              onClick={() => setCurrentStep(i)}
              className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-xs font-medium transition-colors border-b-2 ${
                isCurrent
                  ? "border-primary text-foreground bg-surface-overlay/50"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <s.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{s.title}</span>
              {issues > 0 && (
                <span className="w-4 h-4 rounded-full bg-data-rose/20 text-data-rose text-[9px] font-bold flex items-center justify-center">
                  {issues}
                </span>
              )}
              {issues === 0 && (
                <CheckCircle2 className="w-3.5 h-3.5 text-data-emerald" />
              )}
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="p-5 space-y-3">
        {step.checks.map((check) => {
          const isExpanded = expandedCheck === check.id;
          return (
            <div
              key={check.id}
              className={`rounded-lg border p-4 transition-all ${severityBg(check.severity)}`}
            >
              <button
                onClick={() => setExpandedCheck(isExpanded ? null : check.id)}
                className="w-full flex items-start gap-3 text-left"
              >
                <SeverityIcon severity={check.severity} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{check.label}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {check.value} / {check.threshold}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{check.description}</p>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
              </button>

              {/* Expanded actions */}
              {isExpanded && check.actions.length > 0 && (
                <div className="mt-3 ml-7 space-y-2 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    <Wrench className="w-3 h-3" />
                    Recommended Actions
                  </div>
                  {check.actions.map((action, ai) => (
                    <div
                      key={ai}
                      className="surface-overlay rounded-md px-3 py-2.5 border border-surface-border"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{categoryIcon(action.category)}</span>
                        <span className="text-[11px] font-semibold text-foreground flex-1">
                          {action.title}
                        </span>
                        {impactBadge(action.impact)}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 ml-6">
                        {action.detail}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {isExpanded && check.actions.length === 0 && (
                <p className="mt-3 ml-7 text-[10px] text-data-emerald flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> No action required — within target.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Nav */}
      <div className="px-5 py-3 border-t border-surface-border flex items-center justify-between">
        <button
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Previous
        </button>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <CircleDot
              key={i}
              className={`w-2.5 h-2.5 ${i === currentStep ? "text-primary" : "text-muted-foreground/30"}`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))}
          disabled={currentStep === steps.length - 1}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
