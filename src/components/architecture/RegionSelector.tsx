import { ArrowLeftRight, MapPin, ShieldAlert } from "lucide-react";
import type { Region, RegionConfig } from "./types";
import { StatusDot } from "./StatusDot";

export function RegionSelector({
  regions,
  activeRegion,
  onSelect,
}: {
  regions: RegionConfig[];
  activeRegion: Region;
  onSelect: (r: Region) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {regions.map((r, i) => {
        const isActive = r.id === activeRegion;
        const statusMap = { active: "healthy", standby: "degraded", syncing: "degraded" } as const;
        const isIsolated = r.isolated;
        return (
          <div key={r.id} className="flex items-center gap-2">
            {i > 0 && !isIsolated && (
              <div className="flex items-center gap-1 px-2">
                <ArrowLeftRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-mono">repl</span>
              </div>
            )}
            {isIsolated && i > 0 && (
              <div className="flex items-center gap-1 px-2">
                <ShieldAlert className="w-3 h-3 text-[hsl(var(--data-rose))]" />
                <span className="text-[10px] text-[hsl(var(--data-rose))] font-mono">isolated</span>
              </div>
            )}
            <button
              onClick={() => onSelect(r.id)}
              className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                isActive && isIsolated
                  ? "text-[hsl(var(--data-rose))] border-[hsl(var(--data-rose)/0.4)] bg-[hsl(var(--data-rose)/0.1)]"
                  : isActive
                    ? "text-[hsl(var(--data-cyan))] border-[hsl(var(--data-cyan)/0.4)] bg-[hsl(var(--data-cyan)/0.1)]"
                    : "text-muted-foreground border-surface-border hover:border-muted-foreground/30"
              }`}
            >
              {isIsolated ? <ShieldAlert className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
              <span>{r.label}</span>
              <span className="font-mono text-[10px] opacity-70">{r.location}</span>
              <StatusDot status={statusMap[r.status]} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
