import { useState, useCallback } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Activity } from "lucide-react";
import type { Region } from "@/components/architecture/types";
import { REGIONS, getTiersForRegion } from "@/components/architecture/tier-data";
import { StatusDot } from "@/components/architecture/StatusDot";
import { TierSection } from "@/components/architecture/TierSection";
import { RegionSelector } from "@/components/architecture/RegionSelector";
import { FailoverSimulator } from "@/components/architecture/FailoverSimulator";

export default function Architecture() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<Region>("primary");
  const [failoverStep, setFailoverStep] = useState<string | null>(null);
  const [failoverRunning, setFailoverRunning] = useState(false);

  // During failover, auto-switch region view based on step
  const handleFailoverStep = useCallback((stepId: string | null, running: boolean) => {
    setFailoverStep(stepId);
    setFailoverRunning(running);
    if (stepId === null) {
      setActiveRegion("primary");
    } else if (stepId === "traffic" || stepId === "promote" || stepId === "gpu" || stepId === "operational") {
      setActiveRegion("secondary");
    } else {
      setActiveRegion("primary");
    }
  }, []);

  const tiers = getTiersForRegion(activeRegion);

  const handleSelect = (id: string) => {
    setSelectedNode((prev) => (prev === id ? null : id));
  };

  // During failover, override statuses
  const displayTiers = tiers.map((tier) => {
    if (!failoverStep) return tier;
    return {
      ...tier,
      nodes: tier.nodes.map((node) => {
        // Outage step: primary services go offline
        if (failoverStep === "outage" && activeRegion === "primary") {
          return { ...node, status: "offline" as const };
        }
        // DNS step: LB degraded
        if (failoverStep === "dns" && node.id === "lb") {
          return { ...node, status: "degraded" as const };
        }
        // GPU activation step: GPU pools warming up
        if (failoverStep === "gpu" && (node.id === "gpu-pool" || node.id === "ml-nodes")) {
          return { ...node, status: "degraded" as const };
        }
        // Operational: all healthy
        if (failoverStep === "operational") {
          return { ...node, status: "healthy" as const };
        }
        return node;
      }),
    };
  });

  const allHealthy = displayTiers.every((t) => t.nodes.every((n) => n.status === "healthy"));
  const anyOffline = displayTiers.some((t) => t.nodes.some((n) => n.status === "offline"));
  const totalServices = displayTiers.reduce((acc, t) => acc + t.nodes.length, 0);

  const statusLabel = anyOffline ? "Outage Detected" : allHealthy ? "All Systems Operational" : "Degraded";
  const statusType = anyOffline ? "offline" : allHealthy ? "healthy" : "degraded";

  return (
    <div className="flex h-screen bg-surface dark">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 backdrop-blur-xl bg-surface/80 border-b border-surface-border">
          <div className="px-8 py-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-foreground tracking-tight">
                  System Architecture
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  FlowForge CFD infrastructure topology
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Activity className="w-3.5 h-3.5" />
                  <span>{totalServices} services</span>
                </div>
                <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${
                  statusType === "healthy"
                    ? "text-[hsl(var(--data-emerald))] border-[hsl(var(--data-emerald)/0.3)] bg-[hsl(var(--data-emerald)/0.08)]"
                    : statusType === "offline"
                      ? "text-[hsl(var(--data-rose))] border-[hsl(var(--data-rose)/0.3)] bg-[hsl(var(--data-rose)/0.08)]"
                      : "text-[hsl(var(--data-amber))] border-[hsl(var(--data-amber)/0.3)] bg-[hsl(var(--data-amber)/0.08)]"
                }`}>
                  <StatusDot status={statusType} />
                  {statusLabel}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <RegionSelector
                regions={REGIONS}
                activeRegion={activeRegion}
                onSelect={failoverRunning ? () => {} : setActiveRegion}
              />
            </div>
          </div>
        </header>

        <div className="px-8 py-8 max-w-4xl mx-auto space-y-6">
          <FailoverSimulator onStepChange={handleFailoverStep} />

          <div className="space-y-1">
            {displayTiers.map((tier, i) => (
              <TierSection
                key={tier.id}
                tier={tier}
                selectedNode={selectedNode}
                onSelectNode={handleSelect}
                isLast={i === displayTiers.length - 1}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
