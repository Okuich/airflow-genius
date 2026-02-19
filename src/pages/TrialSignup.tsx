import { useState } from "react";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Wind, Zap, CheckCircle2, Star } from "lucide-react";
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
];

export default function TrialSignup() {
  const [activeRole, setActiveRole] = useState<RoleProfile | null>(null);

  // Listen for role changes from wizard (lifted state)
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

      {/* Testimonials */}
      <section className="border-t border-border bg-muted/10">
        <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-8">
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
