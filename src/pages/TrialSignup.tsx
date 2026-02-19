import { useState, useEffect, useRef } from "react";
import { trackTrialEvent } from "@/components/trial/use-trial-analytics";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Wind, CheckCircle2 } from "lucide-react";
import SignupWizard from "@/components/trial/SignupWizard";
import RoleBenefits from "@/components/trial/RoleBenefits";
import HeroSection from "@/components/trial/HeroSection";
import AiAgentShowcase from "@/components/trial/AiAgentShowcase";
import TestimonialsSection from "@/components/trial/TestimonialsSection";
import { ROLE_PROFILES, type RoleProfile } from "@/components/trial/role-data";

export default function TrialSignup() {
  const [activeRole, setActiveRole] = useState<RoleProfile | null>(null);
  const wizardRef = useRef<HTMLDivElement>(null);
  const defaultBenefits = ROLE_PROFILES[0];

  useEffect(() => {
    trackTrialEvent("page_view", { page: "/trial" });
  }, []);

  const scrollToWizard = () => {
    wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

      {/* Hero with prominent CTA */}
      <HeroSection onStartTrial={scrollToWizard} />

      {/* Main: Benefits + Wizard */}
      <section
        ref={wizardRef}
        className="max-w-7xl mx-auto px-6 pb-20 scroll-mt-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start"
      >
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
      <AiAgentShowcase activeRole={activeRole} />

      {/* Testimonials */}
      <TestimonialsSection />

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
