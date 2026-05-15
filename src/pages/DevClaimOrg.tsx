import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export default function DevClaimOrg() {
  const { user, organizations } = useAuth();
  const [name, setName] = useState("My Org");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const claim = async () => {
    if (!user) {
      toast.error("Sign in first");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_org_ownership", {
      org_name: name,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Org created: ${data}. Reloading...`);
    // Force a full reload so AuthProvider re-fetches org membership.
    setTimeout(() => {
      window.location.href = "/trade-secrets";
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark p-6">
      <Card className="w-full max-w-md bg-surface-panel border-surface-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ShieldCheck className="w-5 h-5 text-data-cyan" />
            Dev: Claim Org Ownership
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Signed in as{" "}
            <span className="font-mono text-data-cyan">
              {user?.email ?? "(not signed in)"}
            </span>
            . Existing orgs: {organizations.length}.
          </p>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Organization name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-surface-overlay border-surface-border"
            />
          </div>
          <Button
            onClick={claim}
            disabled={busy || !user}
            className="w-full bg-data-cyan/20 text-data-cyan hover:bg-data-cyan/30"
          >
            {busy ? "Claiming..." : "Create org & become Owner"}
          </Button>
          {!user && (
            <Button
              variant="outline"
              onClick={() => navigate("/auth")}
              className="w-full"
            >
              Go to Sign In
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
            Dev-only utility. Calls{" "}
            <code className="text-data-amber">claim_org_ownership()</code> which
            creates an organization and inserts the current user as its owner in
            a single transaction.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
