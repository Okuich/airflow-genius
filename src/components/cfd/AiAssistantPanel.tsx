import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    role: "assistant",
    content:
      "Hello! I'm FlowForge AI — your CFD engineering assistant. I can help with simulation setup, mesh quality, turbulence model selection, boundary conditions, convergence issues, and results interpretation.\n\nWhat can I help you with?",
  },
];

interface AiAssistantPanelProps {
  onClose: () => void;
}

export function AiAssistantPanel({ onClose }: AiAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Mock AI response for now — will connect to Lovable AI backend
    setTimeout(() => {
      const responses: Record<string, string> = {
        default:
          "I'd recommend reviewing your mesh quality metrics first. For HVAC duct simulations, a y+ value between 30-300 works well with standard wall functions in the k-ε model. Would you like me to walk you through the setup?",
      };

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: responses.default,
        },
      ]);
      setIsLoading(false);
    }, 1200);
  };

  return (
    <div className="w-96 h-screen flex flex-col surface-panel border-l border-surface-border animate-slide-in-right shrink-0">
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-data-cyan" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Agent</h3>
            <p className="text-[10px] text-muted-foreground">CFD Engineering Assistant</p>
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
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
            <div
              className={`max-w-[80%] px-3 py-2.5 rounded-lg text-sm leading-relaxed ${
                msg.role === "assistant"
                  ? "surface-raised text-foreground"
                  : "bg-primary/15 text-foreground"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
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
      <div className="px-4 py-3 border-t border-surface-border">
        <div className="flex items-center gap-2 surface-raised rounded-lg px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about CFD setup, convergence..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="text-data-cyan hover:opacity-80 disabled:opacity-30 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Powered by FlowForge AI — resolves 95% of user issues
        </p>
      </div>
    </div>
  );
}
