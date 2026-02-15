import type { AirflowComplianceDomain } from "@/packages/types";
import { Factory, Wind, FlaskConical, Wheat, Server } from "lucide-react";

interface RegulationSelectorProps {
  selected: AirflowComplianceDomain;
  onChange: (domain: AirflowComplianceDomain) => void;
}

const DOMAINS: { id: AirflowComplianceDomain; label: string; icon: React.ElementType; standards: string[] }[] = [
  { id: "hvac", label: "HVAC", icon: Wind, standards: ["ASHRAE 62.1", "ASHRAE 55"] },
  { id: "cleanroom", label: "Cleanroom", icon: FlaskConical, standards: ["ISO 14644"] },
  { id: "exhaust", label: "Industrial Exhaust", icon: Factory, standards: ["OSHA PEL", "NFPA 45", "ACGIH"] },
  { id: "agriculture", label: "Agriculture", icon: Wheat, standards: ["OSHA NH₃ PEL", "ACGIH TLV"] },
  { id: "data-center", label: "Data Center", icon: Server, standards: ["ASHRAE 90.4", "TIA 942", "NEBS"] },
];

export function RegulationSelector({ selected, onChange }: RegulationSelectorProps) {
  return (
    <div className="surface-panel rounded-lg p-6">
      <h2 className="text-base font-semibold text-foreground mb-4">Regulation Domain</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {DOMAINS.map((d) => {
          const isActive = d.id === selected;
          const Icon = d.icon;
          return (
            <button
              key={d.id}
              onClick={() => onChange(d.id)}
              className={`flex flex-col items-start gap-2 p-4 rounded-lg border transition-all text-left ${
                isActive
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-surface-border bg-surface-raised text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
              <span className="text-sm font-medium">{d.label}</span>
              <div className="flex flex-wrap gap-1">
                {d.standards.map((s) => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-overlay text-muted-foreground">
                    {s}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
