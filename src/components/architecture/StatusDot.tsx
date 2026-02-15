import type { ServiceNode } from "./types";

export function StatusDot({ status }: { status: ServiceNode["status"] }) {
  const colors: Record<ServiceNode["status"], string> = {
    healthy: "bg-[hsl(var(--data-emerald))]",
    degraded: "bg-[hsl(var(--data-amber))]",
    offline: "bg-[hsl(var(--data-rose))]",
  };
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === "healthy" && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${colors[status]}`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${colors[status]}`} />
    </span>
  );
}
