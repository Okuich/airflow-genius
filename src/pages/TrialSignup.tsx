import { useState } from "react";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import {
  Wind, Zap, CheckCircle2, Star, Brain, MessageSquare,
  Wrench, TrendingUp, Sparkles,
} from "lucide-react";
import SignupWizard from "@/components/trial/SignupWizard";
import RoleBenefits from "@/components/trial/RoleBenefits";
import { ROLE_PROFILES, type RoleProfile } from "@/components/trial/role-data";

const SOCIAL_PROOF = [
  { metric: "2,400+", label: "Simulations run" },
  { metric: "120+", label: "Engineering teams" },
  { metric: "99.9%", label: "Uptime SLA" },
  { metric: "< 3 min", label: "Avg. solve time" },
];

const TESTIMONIALS = [
  { quote: "FlowForge cut our HVAC design cycle from weeks to days.", author: "Maria Chen", title: "VP Engineering, AeroCool Systems" },
  { quote: "The AI anomaly detection caught a cleanroom excursion before it impacted production.", author: "James Okafor", title: "Facilities Director, PharmaTech" },
  { quote: "The AI Agent walked us through our first simulation setup in under 10 minutes.", author: "Priya Gupta", title: "CFD Engineer, ThermalWorks" },
];

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

export default function TrialSignup() {
  const [activeRole, setActiveRole] = useState<RoleProfile | null>(null);
  const defaultBenefits = ROLE_PROFILES[0];

  return (
    <div className="min-h-screen bg-background dark">
      <SEOHead
        title="Start Free 90-Day Trial — FlowForge CFD"
        description="Try FlowForge CFD free for 90 days. GPU-accelerated simulations, AI diagnostics, and ISO compliance for HVAC & cleanroom engineering."
      />

      {/* Nav */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Wind className="w-6 h-6 text-primary" />
            <span className="text-lg font-semibold text-foreground tracking-tight">FlowForge CFD</span>
          </Link>
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Already have an account? Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full mb-6">
          <Zap className="w-3.5 h-3.5" /> 90-Day Free Trial · No Credit Card
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight mb-4 max-w-3xl mx-auto">
          Enterprise CFD simulation,{" "}
          <span className="text-primary">built for your role.</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-10">
          Whether you're an engineer running simulations or a manager tracking compliance,
          FlowForge adapts to your workflow from day one.
        </p>

        {/* Social proof bar */}
        <div className="flex flex-wrap justify-center gap-8 mb-16">
          {SOCIAL_PROOF.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-foreground">{s.metric}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Main: Benefits + Wizard */}
      <section className="max-w-7xl mx-auto px-6 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        {/* Left — Role-specific benefits */}
        <div>
          <RoleBenefits role={activeRole || defaultBenefits} />

          <div className="mt-10 rounded-lg border border-border p-4 bg-muted/20">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">What happens after 90 days?</strong>{" "}
              Your data stays safe. Upgrade to a paid plan or export everything — no lock-in.
            </p>
          </div>
        </div>

        {/* Right — Signup wizard */}
        <div className="surface-panel rounded-xl border border-border p-8">
          <SignupWizard onRoleChange={setActiveRole} />
        </div>
      </section>

      {/* AI Agent Showcase */}
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

          {/* Chat mockup + features */}
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

      {/* Testimonials */}
      <section className="border-t border-border bg-muted/10">
        <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.author} className="rounded-xl border border-border p-6 bg-background">
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-foreground mb-4 italic">"{t.quote}"</p>
              <div>
                <p className="text-sm font-semibold text-foreground">{t.author}</p>
                <p className="text-xs text-muted-foreground">{t.title}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">No credit card · Full access · Cancel anytime</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Trusted by engineering teams at leading HVAC manufacturers, pharmaceutical cleanroom operators, and data center providers.
          </p>
        </div>
      </section>
    </div>
  );
}

/* ── Chat Bubble for AI Agent mockup ── */
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
