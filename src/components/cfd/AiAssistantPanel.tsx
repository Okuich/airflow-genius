import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Bot, User, Zap, Activity, Grid3X3, ArrowRightLeft, BarChart3, Play, Loader2, ChevronDown, ChevronUp, ShieldCheck, AlertTriangle, AlertOctagon, CheckCircle2, Wrench, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, SimulationContext, ExtractedAction, QuickAction } from "./ai-chat-types";
import { QUICK_ACTIONS, extractActions, generateMessageId } from "./ai-chat-types";
import { streamAgentMessage, streamExecutePlan, runAutoDiagnosis, type DiagnosticReport, type DiagnosticIssue } from "./ai-chat-service";

interface AiAssistantPanelProps {
  onClose: () => void;
  simulationContext?: SimulationContext;
  simulationData?: {
    residuals?: unknown[];
    meshConfig?: Record<string, unknown>;
    solverConfig?: Record<string, unknown>;
    fluidProperties?: Record<string, unknown>;
  };
}

const ICON_MAP: Record<QuickAction["icon"], typeof Activity> = {
  convergence: Activity,
  mesh: Grid3X3,
  boundary: ArrowRightLeft,
  performance: BarChart3,
};

const SEVERITY_CONFIG = {
  ok: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", label: "OK" },
  info: { icon: ShieldCheck, color: "text-data-cyan", bg: "bg-data-cyan/10", border: "border-data-cyan/30", label: "Info" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Warning" },
  critical: { icon: AlertOctagon, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", label: "Critical" },
};

const HEALTH_CONFIG = {
  healthy: { color: "text-emerald-400", bg: "bg-emerald-500/15", label: "Healthy" },
  warning: { color: "text-amber-400", bg: "bg-amber-500/15", label: "Needs Attention" },
  critical: { color: "text-rose-400", bg: "bg-rose-500/15", label: "Critical Issues" },
};

function DiagnosticCard({ report, onAutoFix, isFixing }: { report: DiagnosticReport; onAutoFix: (issues: DiagnosticIssue[]) => void; isFixing: boolean }) {
  const health = HEALTH_CONFIG[report.overallHealth];
  const fixableIssues = report.issues.filter(i => i.autoFixAvailable && i.severity !== "ok");
  const criticalCount = report.issues.filter(i => i.severity === "critical").length;
  const warningCount = report.issues.filter(i => i.severity === "warning").length;

  return (
    <div className="mx-4 mb-3 rounded-lg border border-surface-border overflow-hidden">
      {/* Header */}
      <div className={`px-3 py-2.5 ${health.bg} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Sparkles className={`w-4 h-4 ${health.color}`} />
          <div>
            <p className={`text-xs font-semibold ${health.color}`}>Auto-Diagnosis: {health.label}</p>
            <p className="text-[10px] text-muted-foreground">
              {report.issues.length} checks · {Math.round(report.confidence * 100)}% confidence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          {criticalCount > 0 && <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-medium">{criticalCount} critical</span>}
          {warningCount > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">{warningCount} warning</span>}
        </div>
      </div>

      {/* Summary */}
      <div className="px-3 py-2 border-b border-surface-border">
        <p className="text-[11px] text-muted-foreground leading-relaxed">{report.summary}</p>
      </div>

      {/* Issues */}
      <div className="divide-y divide-surface-border">
        {report.issues
          .filter(i => i.severity !== "ok")
          .slice(0, 4)
          .map((issue) => {
            const sev = SEVERITY_CONFIG[issue.severity];
            const Icon = sev.icon;
            return (
              <div key={issue.id} className="px-3 py-2 flex items-start gap-2">
                <Icon className={`w-3.5 h-3.5 ${sev.color} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground">{issue.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{issue.detail}</p>
                  {issue.fix && (
                    <p className="text-[10px] text-data-cyan mt-0.5">
                      Fix: {issue.fix.description}
                    </p>
                  )}
                </div>
                {issue.autoFixAvailable && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium bg-data-cyan/10 text-data-cyan border border-data-cyan/20">
                    Auto-fix
                  </span>
                )}
              </div>
            );
          })}
      </div>

      {/* Quick Wins + Auto-Fix */}
      {(report.quickWins.length > 0 || fixableIssues.length > 0) && (
        <div className="px-3 py-2.5 border-t border-surface-border bg-surface-overlay/30">
          {report.quickWins.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Quick Wins</p>
              {report.quickWins.map((win, i) => (
                <p key={i} className="text-[11px] text-foreground flex items-start gap-1.5 mb-0.5">
                  <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                  {win}
                </p>
              ))}
            </div>
          )}
          {fixableIssues.length > 0 && (
            <button
              onClick={() => onAutoFix(fixableIssues)}
              disabled={isFixing}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity text-[11px] font-medium"
            >
              {isFixing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Applying fixes…
                </>
              ) : (
                <>
                  <Wrench className="w-3.5 h-3.5" />
                  Auto-Fix {fixableIssues.length} Issue{fixableIssues.length > 1 ? "s" : ""} ({Math.round(report.estimatedResolutionConfidence * 100)}% confidence)
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AiAssistantPanel({ onClose, simulationContext, simulationData }: AiAssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: generateMessageId(),
      role: "assistant",
      content: simulationContext
        ? `Connected to **${simulationContext.name}** (${simulationContext.status}). Running auto-diagnostics…`
        : "Hello! I'm FlowForge AI — your autonomous CFD resolution agent. I can diagnose and auto-fix convergence issues, mesh problems, boundary misconfigurations, and more. Select a simulation for context-aware diagnostics.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const diagRanRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Auto-diagnose on panel open when simulation context exists
  useEffect(() => {
    if (!simulationContext || diagRanRef.current) return;
    diagRanRef.current = true;

    const controller = new AbortController();
    setIsDiagnosing(true);

    const fullContext = {
      ...simulationContext,
      ...simulationData,
    };

    runAutoDiagnosis(fullContext, controller.signal)
      .then((report) => {
        setDiagnosticReport(report);
        setIsDiagnosing(false);
        // Update welcome message
        setMessages((prev) =>
          prev.map((m, i) =>
            i === 0
              ? {
                  ...m,
                  content: `Connected to **${simulationContext.name}**. Diagnosis complete — ${report.overallHealth === "healthy" ? "✅ simulation is healthy" : `⚠️ found ${report.issues.filter((x) => x.severity !== "ok").length} issue(s)`}. Ask me anything or use the auto-fix button below.`,
                }
              : m
          )
        );
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          setIsDiagnosing(false);
          setMessages((prev) =>
            prev.map((m, i) =>
              i === 0
                ? { ...m, content: `Connected to **${simulationContext.name}**. Auto-diagnosis unavailable — ask me anything about your simulation.` }
                : m
            )
          );
        }
      });

    return () => controller.abort();
  }, [simulationContext, simulationData]);

  const handleSend = useCallback(async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = { id: generateMessageId(), role: "user", content: text, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    const assistantId = generateMessageId();
    let fullContent = "";

    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date().toISOString() }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Include diagnostic context in the conversation
      const diagnosticPreamble = diagnosticReport
        ? `[SYSTEM DIAGNOSTIC CONTEXT: ${JSON.stringify({ health: diagnosticReport.overallHealth, issues: diagnosticReport.issues.map(i => ({ id: i.id, severity: i.severity, title: i.title })) })}]\n\n`
        : "";

      const allMessages = [...messages, userMsg].map((m, idx) => ({
        role: m.role,
        content: idx === 0 && diagnosticPreamble ? diagnosticPreamble + m.content : m.content,
      }));

      await streamAgentMessage({
        messages: allMessages,
        simulationId: simulationContext?.simulationId,
        simulationContext,
        onDelta: (chunk) => {
          fullContent += chunk;
          const current = fullContent;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: current } : m))
          );
        },
        onDone: (content) => {
          const actions = extractActions(content);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content, actions: actions.length > 0 ? actions : undefined } : m
            )
          );
          setIsStreaming(false);
        },
        onError: (error) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: `⚠️ ${error}` } : m))
          );
          setIsStreaming(false);
        },
        signal: controller.signal,
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: "⚠️ Connection error. Please try again." } : m))
        );
      }
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, simulationContext, diagnosticReport]);

  const handleAutoFix = useCallback(async (issues: DiagnosticIssue[]) => {
    if (isStreaming || isFixing) return;
    setIsFixing(true);
    setIsStreaming(true);

    const actions = issues
      .filter(i => i.fix)
      .map(i => ({
        type: i.fix!.action,
        description: `[${i.id}] ${i.fix!.description}`,
        parameters: i.fix!.parameters,
      }));

    const planId = `autofix-${Date.now()}`;
    const execId = generateMessageId();

    setMessages((prev) => [
      ...prev,
      { id: generateMessageId(), role: "user", content: `🔧 Auto-fix ${actions.length} issue(s)`, timestamp: new Date().toISOString() },
      { id: execId, role: "assistant", content: "", timestamp: new Date().toISOString() },
    ]);

    let fullContent = "";
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamExecutePlan(
        planId,
        actions,
        simulationContext?.simulationId,
        simulationContext,
        {
          onDelta: (chunk) => {
            fullContent += chunk;
            const current = fullContent;
            setMessages((prev) =>
              prev.map((m) => (m.id === execId ? { ...m, content: current } : m))
            );
          },
          onDone: () => {
            setIsStreaming(false);
            setIsFixing(false);
          },
          onError: (error) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === execId ? { ...m, content: `⚠️ ${error}` } : m))
            );
            setIsStreaming(false);
            setIsFixing(false);
          },
          signal: controller.signal,
        }
      );
    } catch {
      setIsStreaming(false);
      setIsFixing(false);
    }
  }, [isStreaming, isFixing, simulationContext]);

  const handleExecutePlan = useCallback(async (actions: ExtractedAction[]) => {
    if (isStreaming) return;
    setIsStreaming(true);

    const planId = `plan-${Date.now()}`;
    const execId = generateMessageId();

    setMessages((prev) => [
      ...prev,
      { id: generateMessageId(), role: "user", content: `▶ Execute resolution plan (${actions.length} actions)`, timestamp: new Date().toISOString() },
      { id: execId, role: "assistant", content: "", timestamp: new Date().toISOString() },
    ]);

    let fullContent = "";
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamExecutePlan(
        planId,
        actions.map((a) => ({ type: a.type, description: a.description, parameters: a.parameters })),
        simulationContext?.simulationId,
        simulationContext,
        {
          onDelta: (chunk) => {
            fullContent += chunk;
            const current = fullContent;
            setMessages((prev) =>
              prev.map((m) => (m.id === execId ? { ...m, content: current } : m))
            );
          },
          onDone: () => setIsStreaming(false),
          onError: (error) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === execId ? { ...m, content: `⚠️ ${error}` } : m))
            );
            setIsStreaming(false);
          },
          signal: controller.signal,
        }
      );
    } catch {
      setIsStreaming(false);
    }
  }, [isStreaming, simulationContext]);

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setIsFixing(false);
  };

  return (
    <div className={`${expanded ? "w-[440px]" : "w-14"} h-screen flex flex-col surface-panel border-l border-surface-border shrink-0 transition-all duration-200`}>
      {/* Collapsed state */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex flex-col items-center gap-2 py-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Bot className="w-5 h-5 text-data-cyan" />
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}

      {expanded && (
        <>
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-data-cyan" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">AI Resolution Agent</h3>
                {simulationContext ? (
                  <p className="text-[10px] text-data-cyan truncate max-w-[200px]">
                    {isDiagnosing ? "Diagnosing…" : simulationContext.name}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">Autonomous CFD Diagnostics</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Diagnostic Report Card */}
          {isDiagnosing && (
            <div className="mx-4 my-3 rounded-lg border border-surface-border p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-data-cyan animate-spin shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">Running Auto-Diagnostics</p>
                <p className="text-[10px] text-muted-foreground">Analyzing convergence, mesh, solver settings…</p>
              </div>
            </div>
          )}

          {diagnosticReport && !isDiagnosing && (
            <DiagnosticCard report={diagnosticReport} onAutoFix={handleAutoFix} isFixing={isFixing} />
          )}

          {/* Quick Actions (only when no diagnosis available) */}
          {messages.length <= 1 && !diagnosticReport && !isDiagnosing && (
            <div className="px-4 py-3 border-b border-surface-border space-y-2 shrink-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Quick Actions</p>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_ACTIONS.map((qa) => {
                  const Icon = ICON_MAP[qa.icon];
                  return (
                    <button
                      key={qa.label}
                      onClick={() => handleSend(qa.prompt)}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-md surface-raised hover:bg-surface-overlay transition-colors text-left"
                    >
                      <Icon className="w-3.5 h-3.5 text-data-cyan shrink-0" />
                      <span className="text-[11px] text-foreground leading-tight">{qa.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === "assistant" ? "bg-primary/20" : "bg-surface-overlay"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <Bot className="w-3.5 h-3.5 text-data-cyan" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "text-right" : ""}`}>
                  <div
                    className={`px-3 py-2.5 rounded-lg text-sm leading-relaxed ${
                      msg.role === "assistant"
                        ? "surface-raised text-foreground"
                        : "bg-primary/15 text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:text-data-cyan [&_code]:bg-surface-overlay [&_code]:px-1 [&_code]:rounded [&_strong]:text-data-cyan">
                        <ReactMarkdown>{msg.content || "…"}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>

                  {/* Actionable fixes */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="space-y-1.5">
                      {msg.actions.map((action, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-data-cyan/30 bg-data-cyan/5 text-[11px]"
                        >
                          <Zap className="w-3 h-3 text-data-cyan shrink-0" />
                          <span className="text-foreground flex-1">{action.description}</span>
                        </div>
                      ))}
                      <button
                        onClick={() => handleExecutePlan(msg.actions!)}
                        disabled={isStreaming}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity text-[11px] font-medium"
                      >
                        <Play className="w-3 h-3" />
                        Execute Resolution Plan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isStreaming && messages[messages.length - 1]?.content === "" && (
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-data-cyan" />
                </div>
                <div className="surface-raised px-3 py-2.5 rounded-lg">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-surface-border shrink-0">
            {isStreaming && (
              <button
                onClick={handleStop}
                className="flex items-center gap-1.5 mb-2 px-3 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground surface-raised transition-colors w-full justify-center"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                Stop generating
              </button>
            )}
            <div className="flex items-center gap-2 surface-raised rounded-lg px-3 py-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={simulationContext ? `Ask about ${simulationContext.name}…` : "Describe your CFD issue…"}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                disabled={isStreaming}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isStreaming}
                className="text-data-cyan hover:opacity-80 disabled:opacity-30 transition-opacity"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              FlowForge AI · 95% Auto-Resolution · Powered by Lovable Cloud
            </p>
          </div>
        </>
      )}
    </div>
  );
}
