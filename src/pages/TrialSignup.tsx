import { useState } from "react";
import { useAuth } from "@/modules/tenant/auth-context";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEOHead";
import {
  Wind, CheckCircle2, ArrowRight, Mail, Lock, User, Building2,
  Briefcase, Users, Zap, ShieldCheck, Brain, BarChart3, AlertCircle, UserCog,
} from "lucide-react";

const BENEFITS = [
  { icon: Zap, title: "GPU-Accelerated CFD", desc: "Run simulations on NVIDIA A100 clusters — no hardware required." },
  { icon: Brain, title: "AI Anomaly Detection", desc: "Automated cleanroom & HVAC anomaly alerts with root cause analysis." },
  { icon: ShieldCheck, title: "ISO 14644-1 Auto-Classification", desc: "Real-time compliance scoring across all monitored zones." },
  { icon: BarChart3, title: "Live Solver Monitoring", desc: "Residual tracking, convergence diagnostics, and GPU utilization dashboards." },
];

const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–500", "500+"];
const JOB_ROLES = ["Engineering Manager", "CFD Engineer", "Product Development", "R&D Director", "Facilities Manager", "Other"];

export default function TrialSignup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<"info" | "confirm">("info");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [useCase, setUseCase] = useState("");
  const [jobRole, setJobRole] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Create the auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { display_name: displayName || email },
        },
      });
      if (authError) throw authError;

      // 2. If user was created, insert trial signup row
      if (authData.user) {
        const { error: trialError } = await supabase
          .from("trial_signups" as any)
          .insert({
            user_id: authData.user.id,
            company_name: companyName,
            industry: "HVAC",
            company_size: companySize || null,
            use_case: useCase || null,
            job_role: jobRole || null,
          } as any);

        if (trialError) {
          console.warn("Trial signup record failed (user still created):", trialError.message);
        }
      }

      setStep("confirm");
    } catch (err: any) {
      setError(err.message ?? "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "confirm") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark grid-engineering">
        <SEOHead title="Trial Confirmed — FlowForge CFD" description="Your 90-day free trial is ready." />
        <div className="surface-panel rounded-xl p-10 max-w-lg w-full mx-4 text-center">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-data-emerald" />
          <h2 className="text-2xl font-bold text-foreground mb-2">You're all set!</h2>
          <p className="text-sm text-muted-foreground mb-6">
            We sent a confirmation link to <strong className="text-foreground">{email}</strong>.<br />
            Verify your email to activate your <span className="text-data-cyan font-semibold">90-day free trial</span>.
          </p>
          <div className="surface-raised rounded-lg border border-surface-border p-4 text-left text-xs text-muted-foreground space-y-1 mb-6">
            <p><strong className="text-foreground">Company:</strong> {companyName}</p>
            {jobRole && <p><strong className="text-foreground">Role:</strong> {jobRole}</p>}
            {companySize && <p><strong className="text-foreground">Size:</strong> {companySize} employees</p>}
            {useCase && <p><strong className="text-foreground">Use case:</strong> {useCase}</p>}
            <p><strong className="text-foreground">Workspace:</strong> Auto-created ✓</p>
            <p><strong className="text-foreground">Trial ends:</strong> {new Date(Date.now() + 90 * 86400000).toLocaleDateString()}</p>
          </div>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 text-sm text-data-cyan hover:underline font-medium"
          >
            Go to sign in <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark grid-engineering">
      <SEOHead
        title="Start Free 90-Day Trial — FlowForge CFD"
        description="Try FlowForge CFD free for 90 days. GPU-accelerated simulations, AI diagnostics, and ISO compliance for HVAC & cleanroom engineering."
      />

      {/* Hero */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Wind className="w-6 h-6 text-data-cyan" />
            <span className="text-lg font-semibold text-foreground tracking-tight">FlowForge CFD</span>
          </Link>
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Already have an account? Sign in
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        {/* Left — Value prop */}
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-data-cyan bg-data-cyan/10 px-3 py-1 rounded-full mb-6">
            <Zap className="w-3.5 h-3.5" /> 90-Day Free Trial
          </div>
          <h1 className="text-4xl font-bold text-foreground leading-tight mb-4">
            Enterprise CFD simulation,<br />
            <span className="text-data-cyan">zero upfront cost.</span>
          </h1>
          <p className="text-muted-foreground text-base mb-10 max-w-md">
            Built for HVAC OEMs, cleanroom operators, and data center engineers.
            Get full platform access — no credit card, no commitment.
          </p>

          <div className="space-y-5">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-data-cyan/10">
                  <b.icon className="w-4.5 h-4.5 text-data-cyan" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{b.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 surface-raised rounded-lg border border-surface-border p-4">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">What happens after 90 days?</strong> Your data stays safe. You can upgrade to a paid plan or export everything — no lock-in.
            </p>
          </div>
        </div>

        {/* Right — Signup form */}
        <div className="surface-panel rounded-xl border border-surface-border p-8">
          <h2 className="text-xl font-semibold text-foreground mb-1">Start your free trial</h2>
          <p className="text-sm text-muted-foreground mb-6">No credit card required. Full access for 90 days.</p>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Jane Smith"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="jane@hvac-company.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Company Name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Acme HVAC Systems"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Your Role</label>
              <div className="relative">
                <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <select
                  required
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
                >
                  <option value="">Select your role</option>
                  {JOB_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Company Size</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <select
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
                >
                  <option value="">Select size (optional)</option>
                  {COMPANY_SIZES.map((s) => (
                    <option key={s} value={s}>{s} employees</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Use Case */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Primary Use Case</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <textarea
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  rows={2}
                  className="w-full pl-10 pr-4 py-2.5 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="e.g. HVAC duct optimization, cleanroom airflow, data center cooling (optional)"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
            >
              {loading ? "Creating your trial…" : "Start 90-Day Free Trial"}
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-[11px] text-muted-foreground text-center mt-3">
              By signing up you agree to our terms of service. No credit card required.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
