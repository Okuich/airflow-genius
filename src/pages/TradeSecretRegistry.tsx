import { useState, useEffect, useCallback } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/modules/tenant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  FileWarning,
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  KeyRound,
  Clock,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { TRADE_SECRET_SEEDS } from "./trade-secret-seed-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface TradeSecret {
  id: string;
  title: string;
  description: string;
  classification: string;
  category: string;
  related_invention: string | null;
  access_level: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
}

const CLASSIFICATIONS = [
  { value: "confidential", label: "Confidential", color: "text-data-amber", icon: ShieldCheck },
  { value: "restricted", label: "Restricted", color: "text-data-orange", icon: ShieldAlert },
  { value: "top_secret", label: "Top Secret", color: "text-data-red", icon: Shield },
];

const CATEGORIES = [
  { value: "threshold", label: "Threshold / Parameter" },
  { value: "weight", label: "Scoring Weight" },
  { value: "formula", label: "Algorithm / Formula" },
  { value: "model", label: "Trained Model" },
  { value: "dataset", label: "Dataset / Knowledge Base" },
  { value: "pricing", label: "Pricing Strategy" },
];

const INVENTIONS = [
  { value: "ID-001", label: "ID-001: AI Diagnostics Agent" },
  { value: "ID-002", label: "ID-002: Compliance Pipeline" },
  { value: "ID-003", label: "ID-003: Surrogate Pipeline" },
  { value: "ID-004", label: "ID-004: GPU Scheduling" },
  { value: "ID-005", label: "ID-005: Cleanroom Anomaly" },
  { value: "ID-006", label: "ID-006: ML Mesh Refinement" },
];

function classificationMeta(c: string) {
  return CLASSIFICATIONS.find((cl) => cl.value === c) ?? CLASSIFICATIONS[0];
}

export default function TradeSecretRegistry() {
  const { user, currentOrg } = useAuth();
  const [secrets, setSecrets] = useState<TradeSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [revealedContent, setRevealedContent] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    content: "",
    classification: "confidential",
    category: "threshold",
    related_invention: "",
    access_level: "owner_only",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchSecrets = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("trade-secret-vault", {
        body: { action: "list", organization_id: currentOrg.id },
      });
      if (data?.secrets) setSecrets(data.secrets);
    } catch {
      toast.error("Failed to load trade secrets");
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  const handleCreate = async () => {
    if (!currentOrg || !form.title || !form.content) {
      toast.error("Title and secret content are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await supabase.functions.invoke("trade-secret-vault", {
        body: {
          action: "encrypt_and_store",
          organization_id: currentOrg.id,
          ...form,
        },
      });
      if (data?.success) {
        toast.success("Trade secret encrypted and stored");
        setDialogOpen(false);
        setForm({
          title: "",
          description: "",
          content: "",
          classification: "confidential",
          category: "threshold",
          related_invention: "",
          access_level: "owner_only",
        });
        fetchSecrets();
      } else {
        toast.error(data?.error || "Failed to store secret");
      }
    } catch {
      toast.error("Encryption failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReveal = async (id: string) => {
    if (revealedContent[id]) {
      setRevealedContent((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    setRevealingId(id);
    try {
      const { data } = await supabase.functions.invoke("trade-secret-vault", {
        body: { action: "decrypt", id },
      });
      if (data?.content) {
        setRevealedContent((prev) => ({ ...prev, [id]: data.content }));
        toast.info("Access logged in audit trail");
      } else {
        toast.error("Decryption failed or access denied");
      }
    } catch {
      toast.error("Failed to decrypt");
    } finally {
      setRevealingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { data } = await supabase.functions.invoke("trade-secret-vault", {
        body: { action: "delete", id },
      });
      if (data?.success) {
        toast.success("Trade secret permanently deleted");
        setSecrets((prev) => prev.filter((s) => s.id !== id));
        setRevealedContent((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const stats = {
    total: secrets.length,
    topSecret: secrets.filter((s) => s.classification === "top_secret").length,
    restricted: secrets.filter((s) => s.classification === "restricted").length,
    confidential: secrets.filter((s) => s.classification === "confidential").length,
  };

  return (
    <>
      <SEOHead
        title="Trade Secret Registry — FlowForge"
        description="Encrypted trade secret vault with AES-256-GCM protection"
      />
      <div className="flex h-screen bg-background dark">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          {/* Header */}
          <div className="border-b border-surface-border surface-panel px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-data-red/10 flex items-center justify-center">
                  <Fingerprint className="w-6 h-6 text-data-red" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">
                    Trade Secret Registry
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    AES-256-GCM encrypted vault • Owner-only access •{" "}
                    <span className="text-data-cyan font-mono text-xs">
                      {user?.email}
                    </span>
                  </p>
                </div>
              </div>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-data-red hover:bg-data-red/80">
                    <Plus className="w-4 h-4" />
                    Register Secret
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg bg-background border-surface-border">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-foreground">
                      <KeyRound className="w-5 h-5 text-data-red" />
                      Register Trade Secret
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label className="text-muted-foreground">Title</Label>
                      <Input
                        value={form.title}
                        onChange={(e) =>
                          setForm({ ...form, title: e.target.value })
                        }
                        placeholder="e.g., Convergence threshold constants"
                        className="mt-1 bg-surface-overlay border-surface-border"
                      />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Description</Label>
                      <Input
                        value={form.description}
                        onChange={(e) =>
                          setForm({ ...form, description: e.target.value })
                        }
                        placeholder="Brief description of what this secret protects"
                        className="mt-1 bg-surface-overlay border-surface-border"
                      />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        Secret Content{" "}
                        <span className="text-data-red text-xs">
                          (will be AES-256-GCM encrypted)
                        </span>
                      </Label>
                      <Textarea
                        value={form.content}
                        onChange={(e) =>
                          setForm({ ...form, content: e.target.value })
                        }
                        placeholder="The actual secret values, formulas, thresholds..."
                        rows={4}
                        className="mt-1 bg-surface-overlay border-surface-border font-mono text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-muted-foreground">Classification</Label>
                        <Select
                          value={form.classification}
                          onValueChange={(v) =>
                            setForm({ ...form, classification: v })
                          }
                        >
                          <SelectTrigger className="mt-1 bg-surface-overlay border-surface-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CLASSIFICATIONS.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Category</Label>
                        <Select
                          value={form.category}
                          onValueChange={(v) =>
                            setForm({ ...form, category: v })
                          }
                        >
                          <SelectTrigger className="mt-1 bg-surface-overlay border-surface-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        Related Invention
                      </Label>
                      <Select
                        value={form.related_invention || "none"}
                        onValueChange={(v) =>
                          setForm({
                            ...form,
                            related_invention: v === "none" ? "" : v,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1 bg-surface-overlay border-surface-border">
                          <SelectValue placeholder="Select invention..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {INVENTIONS.map((inv) => (
                            <SelectItem key={inv.value} value={inv.value}>
                              {inv.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleCreate}
                      disabled={submitting}
                      className="w-full bg-data-red hover:bg-data-red/80 gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      {submitting ? "Encrypting..." : "Encrypt & Store"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="p-8 space-y-6">
            {/* Security Banner */}
            <div className="rounded-xl border border-data-red/20 bg-data-red/5 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-data-red mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Maximum Security Vault
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  All content is encrypted with AES-256-GCM (same standard used in
                  blockchain & military systems). Access is restricted to organization
                  owners only. Every decryption event is logged in the immutable audit
                  trail. Data is encrypted at rest and in transit.
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  label: "Total Secrets",
                  value: stats.total,
                  icon: KeyRound,
                  color: "text-data-cyan",
                },
                {
                  label: "Top Secret",
                  value: stats.topSecret,
                  icon: Shield,
                  color: "text-data-red",
                },
                {
                  label: "Restricted",
                  value: stats.restricted,
                  icon: ShieldAlert,
                  color: "text-data-orange",
                },
                {
                  label: "Confidential",
                  value: stats.confidential,
                  icon: ShieldCheck,
                  color: "text-data-amber",
                },
              ].map((stat) => (
                <Card
                  key={stat.label}
                  className="bg-surface-panel border-surface-border"
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <stat.icon className={`w-8 h-8 ${stat.color} opacity-60`} />
                    <div>
                      <div className="text-2xl font-bold text-foreground">
                        {stat.value}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stat.label}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Secrets List */}
            {loading ? (
              <div className="text-center text-muted-foreground py-20">
                Loading encrypted vault...
              </div>
            ) : secrets.length === 0 ? (
              <Card className="bg-surface-panel border-surface-border">
                <CardContent className="py-16 text-center">
                  <FileWarning className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No trade secrets registered yet.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click "Register Secret" to encrypt and store your first trade
                    secret.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {secrets.map((secret) => {
                  const cls = classificationMeta(secret.classification);
                  const isRevealed = !!revealedContent[secret.id];
                  const isRevealing = revealingId === secret.id;
                  const isDeleting = deletingId === secret.id;

                  return (
                    <Card
                      key={secret.id}
                      className="bg-surface-panel border-surface-border hover:border-surface-border/80 transition-colors"
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <cls.icon
                                className={`w-4 h-4 ${cls.color}`}
                              />
                              <h3 className="text-sm font-semibold text-foreground">
                                {secret.title}
                              </h3>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${cls.color} border-current/20`}
                              >
                                {cls.label}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-[10px] text-muted-foreground"
                              >
                                {CATEGORIES.find(
                                  (c) => c.value === secret.category
                                )?.label ?? secret.category}
                              </Badge>
                              {secret.related_invention && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] text-data-cyan border-data-cyan/20"
                                >
                                  {secret.related_invention}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground ml-7">
                              {secret.description}
                            </p>

                            {/* Revealed content */}
                            {isRevealed && (
                              <div className="mt-3 ml-7 p-3 rounded-lg bg-data-red/5 border border-data-red/20 font-mono text-xs text-foreground whitespace-pre-wrap">
                                {revealedContent[secret.id]}
                              </div>
                            )}

                            <div className="flex items-center gap-4 mt-3 ml-7">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Created{" "}
                                {new Date(
                                  secret.created_at
                                ).toLocaleDateString()}
                              </span>
                              {secret.last_accessed_at && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  Last accessed{" "}
                                  {new Date(
                                    secret.last_accessed_at
                                  ).toLocaleDateString()}
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                {secret.access_level === "owner_only"
                                  ? "Owner Only"
                                  : secret.access_level}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-4 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReveal(secret.id)}
                              disabled={isRevealing}
                              className="gap-1.5 text-xs border-surface-border"
                            >
                              {isRevealing ? (
                                "Decrypting..."
                              ) : isRevealed ? (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  Decrypt
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(secret.id)}
                              disabled={isDeleting}
                              className="gap-1.5 text-xs text-data-red border-data-red/20 hover:bg-data-red/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
