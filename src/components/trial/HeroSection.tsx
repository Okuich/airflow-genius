import { Zap, ArrowRight } from "lucide-react";

const SOCIAL_PROOF = [
  { metric: "2,400+", label: "Simulations run" },
  { metric: "120+", label: "Engineering teams" },
  { metric: "99.9%", label: "Uptime SLA" },
  { metric: "< 3 min", label: "Avg. solve time" },
];

export default function HeroSection({ onStartTrial }: { onStartTrial: () => void }) {
  return (
    <section className="max-w-7xl mx-auto px-6 pt-20 pb-16 text-center">
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full mb-6">
        <Zap className="w-3.5 h-3.5" /> 90-Day Free Trial · No Credit Card
      </div>

      <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-[1.1] mb-5 max-w-3xl mx-auto">
        Enterprise CFD simulation,{" "}
        <span className="text-primary">built for your role.</span>
      </h1>

      <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-8">
        GPU-accelerated solvers, AI diagnostics, and ISO compliance — tailored to
        engineers, managers, and facilities teams from day one.
      </p>

      {/* Primary CTA */}
      <button
        onClick={onStartTrial}
        className="inline-flex items-center gap-2.5 px-8 py-4 rounded-lg bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-opacity shadow-lg mb-4"
        style={{ boxShadow: "var(--glow-primary)" }}
      >
        Start Your Free 90-Day Trial <ArrowRight className="w-5 h-5" />
      </button>
      <p className="text-xs text-muted-foreground mb-14">
        No credit card required · Full access · Cancel anytime
      </p>

      {/* Social proof bar */}
      <div className="flex flex-wrap justify-center gap-8">
        {SOCIAL_PROOF.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-2xl font-bold text-foreground">{s.metric}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
