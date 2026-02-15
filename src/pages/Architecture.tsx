import { useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Activity } from "lucide-react";
import type { Region } from "@/components/architecture/types";
import { REGIONS, getTiersForRegion } from "@/components/architecture/tier-data";
import { StatusDot } from "@/components/architecture/StatusDot";
import { TierSection } from "@/components/architecture/TierSection";
import { RegionSelector } from "@/components/architecture/RegionSelector";

export default function Architecture() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<Region>("primary");

  const tiers = getTiersForRegion(activeRegion);

  const handleSelect = (id: string) => {
    setSelectedNode((prev) => (prev === id ? null : id));
  };

  const allHealthy = tiers.every((t) => t.nodes.every((n) => n.status === "healthy"));
  const totalServices = tiers.reduce((acc, t) => acc + t.nodes.length, 0);

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
                  allHealthy
                    ? "text-[hsl(var(--data-emerald))] border-[hsl(var(--data-emerald)/0.3)] bg-[hsl(var(--data-emerald)/0.08)]"
                    : "text-[hsl(var(--data-amber))] border-[hsl(var(--data-amber)/0.3)] bg-[hsl(var(--data-amber)/0.08)]"
                }`}>
                  <StatusDot status={allHealthy ? "healthy" : "degraded"} />
                  {allHealthy ? "All Systems Operational" : "Degraded"}
                </div>
              </div>
            </div>
            <RegionSelector
              regions={REGIONS}
              activeRegion={activeRegion}
              onSelect={setActiveRegion}
            />
          </div>
        </header>

        <div className="px-8 py-8 max-w-4xl mx-auto space-y-1">
          {tiers.map((tier, i) => (
            <TierSection
              key={tier.id}
              tier={tier}
              selectedNode={selectedNode}
              onSelectNode={handleSelect}
              isLast={i === tiers.length - 1}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
