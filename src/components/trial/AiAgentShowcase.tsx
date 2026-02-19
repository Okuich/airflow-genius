import { Brain, MessageSquare, Wrench, TrendingUp, Sparkles } from "lucide-react";
import type { RoleProfile } from "./role-data";

const AI_AGENT_FEATURES = [
  {
    icon: MessageSquare,
    title: "Natural Language Setup",
    desc: "Describe your simulation in plain English — the AI Agent configures mesh, boundary conditions, and solver settings for you.",
  },
  {
    icon: Wrench,
    title: "Guided Troubleshooting",
    desc: "When simulations diverge, the Agent diagnoses root causes and suggests fixes — no manual residual analysis needed.",
  },
  {
    icon: TrendingUp,
    title: "Results Interpretation",
    desc: "Get instant AI summaries of pressure drops, flow patterns, and efficiency ratings with actionable recommendations.",
  },
  {
    icon: Sparkles,
    title: "Role-Aware Workflows",
    desc: "The Agent adapts its guidance to your role — solver tuning for engineers, compliance summaries for managers, alert config for facilities.",
  },
];

export default function AiAgentShowcase({ activeRole }: { activeRole: RoleProfile | null }) {
  return (
    <section className="border-t border-border bg-primary/[0.02]">
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full mb-4">
            <Brain className="w-3.5 h-3.5" /> AI-Powered Onboarding
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-3">
            Your AI Engineering Agent, from day one
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">
            No more reading docs for hours. The AI Agent guides you through setup,
            troubleshoots issues in real time, and adapts to your expertise level.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
          {/* Chat preview */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-background p-5 space-y-3">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">FlowForge Agent</span>
              <span className="ml-auto text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">Online</span>
            </div>

            <ChatBubble from="agent">
              Welcome! I see you're a {activeRole?.label || "CFD Engineer"}. Let me help you set up your first simulation.
            </ChatBubble>
            <ChatBubble from="user">
              I need to simulate airflow through a rectangular duct with a 90° bend.
            </ChatBubble>
            <ChatBubble from="agent">
              Great choice for a first run. I'll configure a k-ε turbulence model with refined mesh at the bend. Want me to set up the boundary conditions too?
            </ChatBubble>
            <ChatBubble from="user">
              Yes, please — inlet velocity 5 m/s, atmospheric outlet.
            </ChatBubble>
            <ChatBubble from="agent">
              Done! ✅ Mesh: 245K cells with boundary layer refinement. Solver: SIMPLE with 500 iterations. Ready to launch — shall I start?
            </ChatBubble>

            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Ask the AI Agent anything…</span>
              </div>
            </div>
          </div>

          {/* Feature list */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {AI_AGENT_FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-border p-5 bg-background hover:border-primary/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({ from, children }: { from: "agent" | "user"; children: React.ReactNode }) {
  return (
    <div className={`flex ${from === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
        from === "agent"
          ? "bg-muted/40 text-foreground border border-border"
          : "bg-primary/10 text-foreground"
      }`}>
        {children}
      </div>
    </div>
  );
}
