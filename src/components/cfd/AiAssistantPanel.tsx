import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Bot, User, Zap, Activity, Grid3X3, ArrowRightLeft, BarChart3, Play, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, SimulationContext, ExtractedAction, QuickAction } from "./ai-chat-types";
import { QUICK_ACTIONS, extractActions, generateMessageId } from "./ai-chat-types";
import { streamAgentMessage, streamExecutePlan } from "./ai-chat-service";

interface AiAssistantPanelProps {
  onClose: () => void;
  simulationContext?: SimulationContext;
}

const ICON_MAP: Record<QuickAction["icon"], typeof Activity> = {
  convergence: Activity,
  mesh: Grid3X3,
  boundary: ArrowRightLeft,
  performance: BarChart3,
};

export function AiAssistantPanel({ onClose, simulationContext }: AiAssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: generateMessageId(),
      role: "assistant",
      content: simulationContext
        ? `Connected to **${simulationContext.name}** (${simulationContext.status}). I can diagnose issues, interpret results, or suggest optimisations. What do you need?`
        : "Hello! I'm FlowForge AI — your CFD engineering assistant. Select a simulation for context-aware help, or ask me anything about CFD setup, convergence, and results.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = { id: generateMessageId(), role: "user", content: text, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    const assistantId = generateMessageId();
    let fullContent = "";

    // Add empty assistant message
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date().toISOString() }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const allMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

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
  }, [input, isStreaming, messages, simulationContext]);

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
  };

  return (
    <div className={`${expanded ? "w-[420px]" : "w-14"} h-screen flex flex-col surface-panel border-l border-surface-border shrink-0 transition-all duration-200`}>
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
                <h3 className="text-sm font-semibold text-foreground">AI Agent</h3>
                {simulationContext ? (
                  <p className="text-[10px] text-data-cyan truncate max-w-[180px]">{simulationContext.name}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">CFD Engineering Assistant</p>
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

          {/* Quick Actions */}
          {messages.length <= 1 && (
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
                placeholder={simulationContext ? `Ask about ${simulationContext.name}…` : "Ask about CFD setup, convergence…"}
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
              FlowForge AI · Powered by Lovable Cloud
            </p>
          </div>
        </>
      )}
    </div>
  );
}
