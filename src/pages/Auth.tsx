import { useState } from "react";
import { useAuth } from "@/modules/tenant/auth-context";
import { useNavigate, Link } from "react-router-dom";
import { Wind, Mail, Lock, User, ArrowRight, AlertCircle } from "lucide-react";

const Auth = () => {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, displayName);
        setConfirmSent(true);
      } else {
        await signIn(email, password);
        navigate("/");
      }
    } catch (err: any) {
      setError(err.message ?? "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (confirmSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark">
        <div className="surface-panel rounded-lg p-8 max-w-md w-full mx-4 text-center">
          <Mail className="w-12 h-12 mx-auto mb-4 text-data-cyan" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
            Click the link to verify your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark grid-engineering">
      <div className="surface-panel rounded-lg p-8 max-w-md w-full mx-4">
        <div className="flex items-center gap-2 mb-6">
          <Wind className="w-6 h-6 text-data-cyan" />
          <h1 className="text-lg font-semibold text-foreground tracking-tight">FlowForge CFD</h1>
        </div>

        <h2 className="text-xl font-semibold text-foreground mb-1">
          {isSignUp ? "Create account" : "Sign in"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {isSignUp ? "Start running simulations today" : "Welcome back to FlowForge"}
        </p>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Display Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Your name"
                />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="you@company.com"
              />
            </div>
          </div>
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

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Please wait…" : isSignUp ? "Create Account" : "Sign In"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            className="text-data-cyan hover:underline font-medium"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
