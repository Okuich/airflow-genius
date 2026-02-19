import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTrialAnalytics } from "./use-trial-analytics";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight, ArrowLeft, Mail, Lock, User, Building2,
  Users, AlertCircle, CheckCircle2, Briefcase, ChevronDown, Brain, Sparkles, Factory,
} from "lucide-react";
import { ROLE_PROFILES, type RoleProfile } from "./role-data";
import { getConsentsForRole, type ConsentItem } from "./consent-data";

const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–500", "500+"];

const INDUSTRIES = [
  { value: "hvac", label: "HVAC & Ventilation" },
  { value: "data-center", label: "Data Center Cooling" },
  { value: "cleanroom", label: "Cleanroom & Pharma" },
  { value: "industrial", label: "Industrial Process" },
  { value: "automotive", label: "Automotive & Aerospace" },
  { value: "energy", label: "Energy & Power" },
  { value: "other", label: "Other" },
];

function getAiAgentTips(role: RoleProfile | null): string[] {
  const base = ["Ask the Agent to explain any dashboard metric in plain language"];
  const roleMap: Record<string, string[]> = {
    "cfd-engineer": [
      "Say \"Set up a duct simulation with a 90° bend\" to auto-configure mesh and solver",
      "Ask \"Why is my simulation diverging?\" for convergence diagnostics",
      "Try \"Recommend mesh refinement for this geometry\" for AI-guided meshing",
    ],
    "engineering-manager": [
      "Ask \"Show me this week's team compute usage\" for instant analytics",
      "Try \"Generate a compliance summary for Project X\" for stakeholder reports",
      "Say \"Which simulations are at risk of non-convergence?\" for proactive alerts",
    ],
    "facilities-manager": [
      "Say \"Set up anomaly alerts for Zone A particle counts\" for monitoring",
      "Ask \"What's the current ISO classification for all cleanrooms?\"",
      "Try \"Predict PUE for next week\" for cooling efficiency forecasts",
    ],
    "rd-director": [
      "Ask \"Train a surrogate model on last month's simulation data\"",
      "Try \"Benchmark this design against ASHRAE standards\"",
      "Say \"Compare performance across all design variants\" for sweeps",
    ],
    "product-development": [
      "Say \"Run a parameter sweep for inlet velocities 3–8 m/s\"",
      "Ask \"Generate a compliance report for this simulation\"",
      "Try \"What geometry changes would reduce pressure drop?\"",
    ],
  };
  return [...(roleMap[role?.id ?? ""] ?? []), ...base];
}

type Step = "role" | "details" | "confirm";

interface SignupWizardProps {
  onRoleChange?: (role: RoleProfile | null) => void;
}

export default function SignupWizard({ onRoleChange }: SignupWizardProps) {
  const [step, setStep] = useState<Step>("role");
  const [selectedRole, setSelectedRole] = useState<RoleProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { track } = useTrialAnalytics();

  // Form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [industry, setIndustry] = useState("");
  const [useCase, setUseCase] = useState("");

  // Consents
  const [checkedConsents, setCheckedConsents] = useState<Record<string, boolean>>({});
  const [expandedConsent, setExpandedConsent] = useState<string | null>(null);

  const consents = useMemo(() => getConsentsForRole(selectedRole), [selectedRole]);
  const requiredConsents = useMemo(() => consents.filter((c) => c.required), [consents]);
  const allRequiredChecked = requiredConsents.every((c) => checkedConsents[c.id]);

  const toggleConsent = (id: string) => {
    const newVal = !checkedConsents[id];
    setCheckedConsents((prev) => ({ ...prev, [id]: newVal }));
    track("consent_toggled", { consent_id: id, checked: newVal, role: selectedRole?.id });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || !allRequiredChecked) return;
    setError(null);
    setLoading(true);
    track("signup_submitted", { role: selectedRole?.id, company_size: companySize });

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { display_name: displayName || email },
        },
      });
      if (authError) throw authError;

      if (authData.user) {
        const { error: trialError } = await supabase
          .from("trial_signups" as any)
          .insert({
            user_id: authData.user.id,
            company_name: companyName,
            industry: INDUSTRIES.find((i) => i.value === industry)?.label || industry || "HVAC",
            company_size: companySize || null,
            use_case: useCase || null,
            job_role: selectedRole.label,
          } as any);

        if (trialError) {
          console.warn("Trial signup record failed:", trialError.message);
        }
      }

      track("signup_succeeded", { role: selectedRole?.id, company_size: companySize });
      setStep("confirm");
    } catch (err: any) {
      setError(err.message ?? "Signup failed. Please try again.");
      track("signup_failed", { role: selectedRole?.id, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 1: Role Selection ── */
  if (step === "role") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">What best describes your role?</h2>
          <p className="text-sm text-muted-foreground">We'll tailor your trial experience accordingly.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ROLE_PROFILES.map((role) => (
            <button
              key={role.id}
               onClick={() => {
                const prevRole = selectedRole;
                setSelectedRole(role);
                onRoleChange?.(role);
                setCheckedConsents({});
                track(prevRole ? "role_changed" : "role_selected", {
                  role: role.id,
                  previous_role: prevRole?.id ?? null,
                });
              }}
              className={`group flex items-start gap-3 p-4 rounded-lg border text-left transition-all ${
                selectedRole?.id === role.id
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                selectedRole?.id === role.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground group-hover:text-foreground"
              }`}>
                <role.icon className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{role.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{role.description}</p>
              </div>
            </button>
          ))}
        </div>

        <button
          disabled={!selectedRole}
          onClick={() => {
            track("form_started", { role: selectedRole?.id });
            setStep("details");
          }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  /* ── Step 3: Confirmation ── */
  if (step === "confirm") {
    const aiTips = getAiAgentTips(selectedRole);
    // Fire once when confirmation is viewed
    track("confirmation_viewed", { role: selectedRole?.id });
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-primary" />
        <h2 className="text-2xl font-bold text-foreground mb-2">You're all set!</h2>
        <p className="text-sm text-muted-foreground mb-6">
          We sent a confirmation link to <strong className="text-foreground">{email}</strong>.<br />
          Verify your email to activate your <span className="text-primary font-semibold">90-day free trial</span>.
        </p>
        <div className="surface-raised rounded-lg border border-border p-4 text-left text-xs text-muted-foreground space-y-1 mb-4">
          <p><strong className="text-foreground">Role:</strong> {selectedRole?.label}</p>
          <p><strong className="text-foreground">Company:</strong> {companyName}</p>
          {companySize && <p><strong className="text-foreground">Size:</strong> {companySize} employees</p>}
          {useCase && <p><strong className="text-foreground">Use case:</strong> {useCase}</p>}
          <p><strong className="text-foreground">Workspace:</strong> Auto-created ✓</p>
          <p><strong className="text-foreground">Trial ends:</strong> {new Date(Date.now() + 90 * 86400000).toLocaleDateString()}</p>
        </div>

        {/* AI Agent first-login tips */}
        <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4 text-left mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Your AI Agent is ready</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            When you first log in, the AI Agent will greet you with guidance tailored to your role. Here's what to try:
          </p>
          <ul className="space-y-2">
            {aiTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <Sparkles className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                <span className="text-foreground">{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        <Link
          to="/auth"
          onClick={() => track("signin_clicked", { role: selectedRole?.id, from: "confirmation" })}
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
        >
          Go to sign in <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  /* ── Step 2: Details Form ── */
  return (
    <div>
      <button
        onClick={() => setStep("role")}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Change role
      </button>

      {selectedRole && (
        <div className="flex items-center gap-2 mb-5 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <selectedRole.icon className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">{selectedRole.label}</p>
            <p className="text-xs text-muted-foreground">{selectedRole.headline}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full Name" icon={User}>
          <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            className="form-input" placeholder="Jane Smith" />
        </Field>

        <Field label="Work Email" icon={Mail}>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="form-input" placeholder="jane@company.com" />
        </Field>

        <Field label="Password" icon={Lock}>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            className="form-input" placeholder="••••••••" />
        </Field>

        <Field label="Company Name" icon={Building2}>
          <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)}
            className="form-input" placeholder="Acme HVAC Systems" />
        </Field>

        <Field label="Industry" icon={Factory}>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="form-input appearance-none" required>
            <option value="">Select your industry</option>
            {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </Field>

        <Field label="Company Size" icon={Users}>
          <select value={companySize} onChange={(e) => setCompanySize(e.target.value)} className="form-input appearance-none">
            <option value="">Select size (optional)</option>
            {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
          </select>
        </Field>

        <Field label="Primary Use Case" icon={Briefcase} alignTop>
          <textarea value={useCase} onChange={(e) => setUseCase(e.target.value)} rows={2}
            className="form-input resize-none"
            placeholder="e.g. HVAC duct optimization, cleanroom airflow (optional)" />
        </Field>

        {/* ── Consent & Policy Checkboxes ── */}
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Agreements & Consent
          </p>
          {consents.map((consent, idx) => (
            <ConsentCheckbox
              key={consent.id}
              consent={consent}
              checked={!!checkedConsents[consent.id]}
              onToggle={() => toggleConsent(consent.id)}
              expanded={expandedConsent === consent.id}
              onExpand={() => setExpandedConsent(expandedConsent === consent.id ? null : consent.id)}
              isRoleSpecific={idx >= 2}
            />
          ))}
        </div>

        <button type="submit" disabled={loading || !allRequiredChecked}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
        >
          {loading ? "Creating your trial…" : "Start 90-Day Free Trial"}
          <ArrowRight className="w-4 h-4" />
        </button>

        {!allRequiredChecked && (
          <p className="text-[11px] text-muted-foreground text-center">
            Please accept all required agreements to continue.
          </p>
        )}
      </form>
    </div>
  );
}

/* ── Consent Checkbox ── */
function ConsentCheckbox({ consent, checked, onToggle, expanded, onExpand, isRoleSpecific }: {
  consent: ConsentItem;
  checked: boolean;
  onToggle: () => void;
  expanded: boolean;
  onExpand: () => void;
  isRoleSpecific: boolean;
}) {
  return (
    <div className={`rounded-lg border transition-all ${
      isRoleSpecific
        ? "border-primary/20 bg-primary/[0.03] animate-in fade-in slide-in-from-bottom-2 duration-300"
        : "border-border"
    } ${checked ? "bg-muted/20" : ""}`}>
      <label className="flex items-start gap-3 p-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-ring shrink-0 accent-primary"
        />
        <div className="flex-1 min-w-0">
          <span className="text-xs text-foreground leading-snug">
            {consent.label}
            {consent.required && <span className="text-destructive ml-0.5">*</span>}
          </span>
          {isRoleSpecific && (
            <span className="ml-1.5 inline-flex items-center text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              Role-specific
            </span>
          )}
        </div>
        {consent.description && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onExpand(); }}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </label>
      {expanded && consent.description && (
        <div className="px-3 pb-3 pl-10 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-[11px] text-muted-foreground leading-relaxed">{consent.description}</p>
        </div>
      )}
    </div>
  );
}

/* ── Shared Field wrapper ── */
function Field({ label, icon: Icon, alignTop, children }: {
  label: string; icon: any; alignTop?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <div className="relative">
        <Icon className={`absolute left-3 w-4 h-4 text-muted-foreground ${alignTop ? "top-3" : "top-1/2 -translate-y-1/2"}`} />
        <div className="[&>.form-input]:w-full [&>.form-input]:pl-10 [&>.form-input]:pr-4 [&>.form-input]:py-2.5 [&>.form-input]:rounded-md [&>.form-input]:bg-background [&>.form-input]:border [&>.form-input]:border-border [&>.form-input]:text-foreground [&>.form-input]:text-sm [&>.form-input]:focus:outline-none [&>.form-input]:focus:ring-2 [&>.form-input]:focus:ring-ring">
          {children}
        </div>
      </div>
    </div>
  );
}
