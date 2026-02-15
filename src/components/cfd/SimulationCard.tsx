import { Simulation } from "@/domain/cfd/types";
import { getStatusLabel, getStatusClass } from "@/domain/cfd/mock-data";
import { Clock, Layers, RotateCcw, Thermometer } from "lucide-react";

interface SimulationCardProps {
  simulation: Simulation;
}

export function SimulationCard({ simulation }: SimulationCardProps) {
  const isActive = simulation.status === "solving" || simulation.status === "meshing";

  return (
    <div className="surface-panel rounded-lg p-5 hover:bg-surface-raised transition-colors cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-data-cyan transition-colors">
            {simulation.name}
          </h3>
          {simulation.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{simulation.description}</p>
          )}
        </div>
        <div className={getStatusClass(simulation.status)}>
          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-glow" />}
          {getStatusLabel(simulation.status)}
        </div>
      </div>

      {/* Progress bar for active sims */}
      {isActive && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>Progress</span>
            <span className="font-mono">{simulation.progress}%</span>
          </div>
          <div className="w-full h-1 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full rounded-full bg-data-cyan transition-all duration-500"
              style={{ width: `${simulation.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Metadata chips */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Layers className="w-3 h-3" />
          <span className="font-mono">{simulation.cellCount ? `${(simulation.cellCount / 1e6).toFixed(1)}M cells` : "—"}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span className="font-mono">{simulation.solverConfig.turbulenceModel}</span>
        </div>
        {simulation.solverConfig.rotatingReferenceFrame?.enabled && (
          <div className="flex items-center gap-1 text-data-amber">
            <RotateCcw className="w-3 h-3" />
            <span className="font-mono">{simulation.solverConfig.rotatingReferenceFrame.rotationSpeed} RPM</span>
          </div>
        )}
        {simulation.solverConfig.enableHeatTransfer && (
          <div className="flex items-center gap-1 text-data-rose">
            <Thermometer className="w-3 h-3" />
            <span>Thermal</span>
          </div>
        )}
      </div>
    </div>
  );
}
