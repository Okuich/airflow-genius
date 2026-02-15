import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, Send, Bot, User, Loader2, Shield, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ComplianceOrchestrator } from "@/packages/compliance-engine";
import type { AirflowComplianceDomain, ComplianceFinding, ComplianceRiskReport } from "@/packages/types";

// ── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AIComplianceAdvisorProps {
  domain: AirflowComplianceDomain;
  metrics: Record<string, number>;
}

// ── Quick prompts ───────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { label: "Explain violations", prompt: "Explain each compliance violation and what regulatory standards require." },
  { label: "Remediation plan", prompt: "Create a prioritized remediation plan with cost and timeline estimates." },
  { label: "Audit readiness", prompt: "Assess our audit readiness and what documentation we need to prepare." },
  { label: "Risk mitigation", prompt: "What are the most cost-effective ways to reduce our overall risk score?" },
];

// ── Streaming helper ────────────────────────────────────────────────────────

const ADVISOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compliance-advisor`;

async function streamAdvisor(opts: {
  messages: { role: string; content: string }[];
  domain: AirflowComplianceDomain;
  metrics: Record<string, number>;
  findings: ComplianceFinding[];
  riskReport: ComplianceRiskReport;
  onDelta: (text: string) => void;
  onDone: (full: string) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}) {
  const resp = await fetch(ADVISOR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      messages: opts.messages,
      domain: opts.domain,
      metrics: opts.metrics,
      findings: opts.findings,
      riskReport: opts.riskReport,
    }),
    signal: opts.signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `Error ${resp.status}` }));
    opts.onError(err.error || `Error ${resp.status}`);
    return;
  }

  if (!resp.body) {
    opts.onError("No response body");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const json = line.slice(6).trim();
      if (json === "[DONE]") {
        opts.onDone(full);
        return;
      }

      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) {
          full += content;
          opts.onDelta(content);
        }
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  // Final flush
  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const json = raw.slice(6).trim();
      if (json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) {
          full += content;
          opts.onDelta(content);
        }
      } catch { /* ignore */ }
    }
  }

  opts.onDone(full);
}

// ── Component ───────────────────────────────────────────────────────────────

function msgId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AIComplianceAdvisor({ domain, metrics }: AIComplianceAdvisorProps) {
  // Compute compliance context
  const complianceResult = useMemo(() => {
    const orch = new ComplianceOrchestrator();
    return orch.run({
      simulationId: "advisor",
      organizationId: "advisor",
      domain,
      metrics,
    });
  }, [domain, metrics]);

  const violations = complianceResult.findings.filter((f) => f.status === "Fail").length;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: msgId(),
      role: "assistant",
      content: violations > 0
        ? `I've analysed your **${domain}** compliance data and found **${violations} violation(s)** with a risk score of **${complianceResult.riskReport.overallScore}/100**. Ask me about specific violations, remediation strategies, or audit preparation.`
        : `Your **${domain}** metrics are fully compliant. I can help with audit documentation, regulatory questions, or proactive risk management.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reset messages when domain/metrics change
  useEffect(() => {
    setMessages([
      {
        id: msgId(),
        role: "assistant",
        content: violations > 0
          ? `I've analysed your **${domain}** compliance data and found **${violations} violation(s)** with a risk score of **${complianceResult.riskReport.overallScore}/100**. Ask me about specific violations, remediation strategies, or audit preparation.`
          : `Your **${domain}** metrics are fully compliant. I can help with audit documentation, regulatory questions, or proactive risk management.`,
      },
    ]);
  }, [domain, metrics, violations, complianceResult.riskReport.overallScore]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    async (overrideInput?: string) => {
      const text = (overrideInput ?? input).trim();
      if (!text || isStreaming) return;

      const userMsg: Message = { id: msgId(), role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsStreaming(true);

      const assistantId = msgId();
      let fullContent = "";

      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const allMessages = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        await streamAdvisor({
          messages: allMessages,
          domain,
          metrics,
          findings: complianceResult.findings,
          riskReport: complianceResult.riskReport,
          onDelta: (chunk) => {
            fullContent += chunk;
            const current = fullContent;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: current } : m))
            );
          },
          onDone: () => setIsStreaming(false),
          onError: (error) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: `⚠️ ${error}` } : m
              )
            );
            setIsStreaming(false);
          },
          signal: controller.signal,
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "⚠️ Connection error. Please try again." }
                : m
            )
          );
        }
        setIsStreaming(false);
      }
    },
    [input, isStreaming, messages, domain, metrics, complianceResult]
  );

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  return (
    <div className="surface-panel rounded-lg flex flex-col h-[600px]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-border flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-foreground">AI Compliance Advisor</h2>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
            {domain.replace("-", " ")} · {violations} violation(s) · Risk {complianceResult.riskReport.overallScore}/100
          </p>
        </div>
        <div
          className={`status-badge ${
            violations === 0
              ? "bg-data-emerald/15 text-data-emerald"
              : complianceResult.riskReport.overallScore >= 50
                ? "bg-data-rose/15 text-data-rose"
                : "bg-data-amber/15 text-data-amber"
          }`}
        >
          <Shield className="w-3 h-3" />
          {violations === 0 ? "Compliant" : "Violations"}
        </div>
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="px-4 py-3 border-b border-surface-border shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Quick Actions</p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.label}
                onClick={() => handleSend(qp.prompt)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md surface-raised hover:bg-surface-overlay transition-colors text-left"
              >
                <Sparkles className="w-3 h-3 text-primary shrink-0" />
                <span className="text-[11px] text-foreground leading-tight">{qp.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                msg.role === "assistant" ? "bg-primary/20" : "bg-surface-overlay"
              }`}
            >
              {msg.role === "assistant" ? (
                <Bot className="w-3.5 h-3.5 text-primary" />
              ) : (
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <div className={`max-w-[85%] ${msg.role === "user" ? "text-right" : ""}`}>
              <div
                className={`px-3 py-2.5 rounded-lg text-sm leading-relaxed ${
                  msg.role === "assistant"
                    ? "surface-raised text-foreground"
                    : "bg-primary/15 text-foreground"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:text-data-cyan [&_code]:bg-surface-overlay [&_code]:px-1 [&_code]:rounded [&_strong]:text-primary">
                    <ReactMarkdown>{msg.content || "…"}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
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
            placeholder="Ask about compliance, remediation, audit prep…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            disabled={isStreaming}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
            className="text-primary hover:opacity-80 disabled:opacity-30 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          FlowForge Compliance Advisor · Powered by Lovable AI
        </p>
      </div>
    </div>
  );
}
