import { type LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: "cyan" | "emerald" | "amber" | "rose";
  pulse?: boolean;
}

const colorMap = {
  cyan: "text-data-cyan",
  emerald: "text-data-emerald",
  amber: "text-data-amber",
  rose: "text-data-rose",
} as const;

export function MetricCard({ label, value, icon: Icon, color, pulse }: MetricCardProps) {
  const valueColor = color ? colorMap[color] : "text-foreground";

  return (
    <div className="surface-panel rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`w-4 h-4 ${color ? colorMap[color] : "text-muted-foreground"}`} />
      </div>
      <span className={`text-2xl font-mono font-semibold tracking-tight ${valueColor} ${pulse ? "animate-pulse-glow" : ""}`}>
        {value}
      </span>
    </div>
  );
}
