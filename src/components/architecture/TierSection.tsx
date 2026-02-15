import type { Tier } from "./types";
import { NodeCard } from "./NodeCard";

function ConnectionLine({ color }: { color: string }) {
  return (
    <div className="flex justify-center py-1">
      <div className="relative w-px h-6">
        <div className="absolute inset-0 w-px" style={{ backgroundColor: `hsl(var(--${color}) / 0.3)` }} />
        <div
          className="absolute w-1.5 h-1.5 rounded-full -bottom-0.5 -left-[2.5px] animate-pulse"
          style={{ backgroundColor: `hsl(var(--${color}))` }}
        />
      </div>
    </div>
  );
}

export function TierSection({
  tier,
  selectedNode,
  onSelectNode,
  isLast,
}: {
  tier: Tier;
  selectedNode: string | null;
  onSelectNode: (id: string) => void;
  isLast: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div
          className="h-px flex-1"
          style={{ backgroundImage: `linear-gradient(to right, transparent, hsl(var(--${tier.color}) / 0.3), transparent)` }}
        />
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.15em] font-mono px-3 py-1 rounded-full border"
          style={{
            color: `hsl(var(--${tier.color}))`,
            borderColor: `hsl(var(--${tier.color}) / 0.25)`,
            backgroundColor: `hsl(var(--${tier.color}) / 0.08)`,
          }}
        >
          {tier.label}
        </span>
        <div
          className="h-px flex-1"
          style={{ backgroundImage: `linear-gradient(to right, transparent, hsl(var(--${tier.color}) / 0.3), transparent)` }}
        />
      </div>

      <div className={`grid gap-3 ${tier.nodes.length === 1 ? "grid-cols-1 max-w-lg mx-auto" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {tier.nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            tierColor={tier.color}
            isSelected={selectedNode === node.id}
            onClick={() => onSelectNode(node.id)}
          />
        ))}
      </div>

      {!isLast && <ConnectionLine color={tier.color} />}
    </div>
  );
}
