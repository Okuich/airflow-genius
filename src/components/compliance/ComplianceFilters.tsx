import { Globe, Building2, CalendarDays } from "lucide-react";

export type ComplianceRegion = "US" | "EU" | "Asia";
export type ComplianceIndustry = "Cleanroom" | "Exhaust" | "DataCenter";

interface ComplianceFiltersProps {
  region: ComplianceRegion;
  industry: ComplianceIndustry;
  effectiveDate: string;
  onRegionChange: (r: ComplianceRegion) => void;
  onIndustryChange: (i: ComplianceIndustry) => void;
  onEffectiveDateChange: (d: string) => void;
}

const REGIONS: { id: ComplianceRegion; label: string }[] = [
  { id: "US", label: "United States" },
  { id: "EU", label: "European Union" },
  { id: "Asia", label: "Asia-Pacific" },
];

const INDUSTRIES: { id: ComplianceIndustry; label: string }[] = [
  { id: "Cleanroom", label: "Cleanroom" },
  { id: "Exhaust", label: "Industrial Exhaust" },
  { id: "DataCenter", label: "Data Center" },
];

export function ComplianceFilters({
  region,
  industry,
  effectiveDate,
  onRegionChange,
  onIndustryChange,
  onEffectiveDateChange,
}: ComplianceFiltersProps) {
  return (
    <div className="surface-panel rounded-lg p-5">
      <h2 className="text-base font-semibold text-foreground mb-4">Compliance Scope</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Region */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Globe className="w-3.5 h-3.5" />
            Region
          </label>
          <div className="flex gap-1.5">
            {REGIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => onRegionChange(r.id)}
                className={`flex-1 px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                  region === r.id
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "surface-raised text-muted-foreground border border-surface-border hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                {r.id}
              </button>
            ))}
          </div>
        </div>

        {/* Industry */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5" />
            Industry
          </label>
          <div className="flex gap-1.5">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind.id}
                onClick={() => onIndustryChange(ind.id)}
                className={`flex-1 px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                  industry === ind.id
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "surface-raised text-muted-foreground border border-surface-border hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                {ind.id === "DataCenter" ? "DC" : ind.id === "Exhaust" ? "Exhaust" : "Clean"}
              </button>
            ))}
          </div>
        </div>

        {/* Effective Date */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <CalendarDays className="w-3.5 h-3.5" />
            Effective Date
          </label>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => onEffectiveDateChange(e.target.value)}
            className="w-full px-3 py-2 rounded-md text-xs font-medium surface-raised text-foreground border border-surface-border focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all bg-transparent [color-scheme:dark]"
          />
        </div>
      </div>
    </div>
  );
}
