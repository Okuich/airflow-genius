import { ChevronRight } from "lucide-react";
import type { ServiceNode } from "./types";
import { StatusDot } from "./StatusDot";

export function NodeCard({
  node,
  tierColor,
  isSelected,
  onClick,
}: {
  node: ServiceNode;
  tierColor: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = node.icon;
  return (
    <button
      onClick={onClick}
      className={`group relative w-full text-left rounded-xl border transition-all duration-200 ${
        isSelected
          ? "bg-surface-overlay border-[hsl(var(--" + tierColor + "))] shadow-lg shadow-[hsl(var(--" + tierColor + ")/0.1)]"
          : "bg-surface-raised border-surface-border hover:border-[hsl(var(--" + tierColor + "))/50] hover:bg-surface-overlay/60"
      }`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `hsl(var(--${tierColor}) / 0.15)` }}
            >
              <Icon className="w-4 h-4" style={{ color: `hsl(var(--${tierColor}))` }} />
            </div>
            <span className="text-sm font-medium text-foreground">{node.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot status={node.status} />
            <ChevronRight
              className={`w-4 h-4 text-muted-foreground transition-transform ${
                isSelected ? "rotate-90" : "group-hover:translate-x-0.5"
              }`}
            />
          </div>
        </div>

        {isSelected && (
          <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-xs text-muted-foreground leading-relaxed">{node.description}</p>
            {node.metrics && (
              <div className="grid grid-cols-2 gap-2">
                {node.metrics.map((m) => (
                  <div key={m.label} className="rounded-lg bg-surface/60 border border-surface-border px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</div>
                    <div
                      className="text-sm font-semibold font-mono mt-0.5"
                      style={{ color: `hsl(var(--${tierColor}))` }}
                    >
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
