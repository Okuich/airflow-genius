import { useState, useCallback } from "react";
import { AlertTriangle, ShieldAlert, Info, Zap, RefreshCw, Brain, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { AnomalyDetectionResponse, StatAnomaly, AIAlert } from "@/modules/cfd/cleanroom/cleanroom-api-client";
import { cleanroomApi } from "@/modules/cfd/cleanroom/cleanroom-api-client";

// ── Severity styling ────────────────────────────────────────────────────────

const SEVERITY_MAP = {
  critical: { icon: ShieldAlert, color: "text-data-rose", bg: "bg-data-rose/10", border: "border-data-rose/30", label: "Critical" },
  warning: { icon: AlertTriangle, color: "text-data-amber", bg: "bg-data-amber/10", border: "border-data-amber/30", label: "Warning" },
  info: { icon: Info, color: "text-data-cyan", bg: "bg-data-cyan/10", border: "border-data-cyan/30", label: "Info" },
} as const;

const METRIC_LABELS: Record<string, string> = {
  air_change_rate: "Air Change Rate",
  particle_retention: "Particle Retention",
  laminar_stability: "Laminar Stability",
};

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAnomalyDetection(orgId?: string) {
  const [data, setData] = useState<AnomalyDetectionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async (hoursBack = 24) => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await cleanroomApi.detectAnomalies({ orgId, hoursBack });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detection failed");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  return { data, loading, error, detect };
}

// ── Standalone stat anomaly card (when no AI analysis available) ─────────

function StatAnomalyCard({ anomaly }: { anomaly: StatAnomaly }) {
  const DirectionIcon = anomaly.direction === "spike" ? ArrowUpRight : ArrowDownRight;
  const dirColor = anomaly.direction === "spike" ? "text-data-rose" : "text-data-cyan";

  return (
    <div className="surface-raised border border-surface-border rounded-lg p-4 flex items-start gap-3">
      <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-data-amber/10`}>
        <Zap className="w-4 h-4 text-data-amber" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{anomaly.zone}</span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {METRIC_LABELS[anomaly.metric] ?? anomaly.metric}
          </span>
          <DirectionIcon className={`w-3.5 h-3.5 ${dirColor}`} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Value <span className="font-mono text-foreground">{anomaly.value.toFixed(4)}</span> deviates
          from mean <span className="font-mono">{anomaly.mean}</span> (z-score: <span className="font-mono font-semibold">{anomaly.zScore}</span>)
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
          {new Date(anomaly.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// ── AI Alert card ───────────────────────────────────────────────────────────

function AIAlertCard({ alert }: { alert: AIAlert }) {
  const sev = SEVERITY_MAP[alert.severity];
  const SevIcon = sev.icon;

  return (
    <div className={`rounded-lg border p-4 ${sev.bg} ${sev.border}`}>
      <div className="flex items-start gap-3">
        <SevIcon className={`w-5 h-5 shrink-0 mt-0.5 ${sev.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold uppercase ${sev.color}`}>{sev.label}</span>
            <span className="text-xs text-foreground font-semibold">{alert.zone}</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {METRIC_LABELS[alert.metric] ?? alert.metric}
            </span>
            {alert.isoImpact && (
              <span className="text-[10px] font-semibold text-data-rose bg-data-rose/10 px-1.5 py-0.5 rounded">
                ISO Impact
              </span>
            )}
          </div>
          <p className="text-xs text-foreground mt-1.5"><strong>Cause:</strong> {alert.rootCause}</p>
          <p className="text-xs text-muted-foreground mt-1"><strong>Action:</strong> {alert.recommendation}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────────────

interface AnomalyAlertPanelProps {
  orgId?: string;
}

export function AnomalyAlertPanel({ orgId }: AnomalyAlertPanelProps) {
  const { data, loading, error, detect } = useAnomalyDetection(orgId);

  const hasMockMode = !orgId;
  const anomalyCount = (data?.anomalies?.length ?? 0) + (data?.aiAnalysis?.alerts?.length ?? 0);

  return (
    <section className="surface-raised rounded-xl border border-surface-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Brain className="w-4 h-4 text-data-violet" />
          AI Anomaly Alerts
          {anomalyCount > 0 && (
            <span className="text-[10px] font-bold bg-data-rose/20 text-data-rose px-1.5 py-0.5 rounded-full">
              {anomalyCount}
            </span>
          )}
        </h2>
        <button
          onClick={() => detect(24)}
          disabled={loading || hasMockMode}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors surface-raised border border-surface-border rounded-lg px-3 py-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Scanning…" : "Run Detection"}
        </button>
      </div>

      {hasMockMode && (
        <p className="text-xs text-muted-foreground italic mb-4">
          Connect to an organization to enable live anomaly detection on persisted telemetry.
        </p>
      )}

      {error && (
        <div className="text-xs text-data-rose bg-data-rose/10 border border-data-rose/20 rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {data && !data.aiAnalysis && data.anomalies.length === 0 && (
        <div className="text-xs text-data-emerald bg-data-emerald/10 border border-data-emerald/20 rounded-lg px-3 py-2">
          ✓ {data.message ?? "No anomalies detected"} ({data.sampleCount} samples analyzed)
        </div>
      )}

      {data?.aiAnalysis && (
        <div className="space-y-3 mb-4">
          {data.aiAnalysis.alerts
            .sort((a, b) => {
              const order = { critical: 0, warning: 1, info: 2 };
              return order[a.severity] - order[b.severity];
            })
            .map((alert, i) => (
              <AIAlertCard key={i} alert={alert} />
            ))}
          {data.aiAnalysis.overallAssessment && (
            <div className="text-xs text-muted-foreground bg-surface-overlay/50 rounded-lg px-4 py-3 mt-2">
              <strong className="text-foreground">Assessment:</strong> {data.aiAnalysis.overallAssessment}
            </div>
          )}
        </div>
      )}

      {data && !data.aiAnalysis && data.anomalies.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
            Statistical Anomalies ({data.sampleCount} samples)
          </p>
          {data.anomalies.map((a, i) => (
            <StatAnomalyCard key={i} anomaly={a} />
          ))}
        </div>
      )}

      {!data && !loading && !error && !hasMockMode && (
        <p className="text-xs text-muted-foreground">
          Click "Run Detection" to scan for anomalies in the last 24 hours.
        </p>
      )}
    </section>
  );
}
