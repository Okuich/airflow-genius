import { Wind, Cpu, Thermometer, RotateCcw, Activity, BarChart3, Settings2, MessageSquare, Plus, ChevronRight } from "lucide-react";
import { getMockSimulations, getMockMetrics, getStatusLabel, getStatusClass } from "@/domain/cfd/mock-data";
import { SimulationCard } from "@/components/cfd/SimulationCard";
import { MetricCard } from "@/components/cfd/MetricCard";
import { ResidualChart } from "@/components/cfd/ResidualChart";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AiAssistantPanel } from "@/components/cfd/AiAssistantPanel";
import type { SimulationContext } from "@/components/cfd/ai-chat-types";
import { useState } from "react";
import { Link } from "react-router-dom";

const Index = () => {
  const simulations = getMockSimulations();
  const metrics = getMockMetrics();
  const activeSim = simulations.find((s) => s.status === "solving");
  const [showAi, setShowAi] = useState(false);

  const simContext: SimulationContext | undefined = activeSim
    ? {
        simulationId: activeSim.id,
        name: activeSim.name,
        status: activeSim.status,
        turbulenceModel: activeSim.solverConfig.turbulenceModel,
        cellCount: activeSim.cellCount,
        currentIteration: activeSim.currentIteration,
        maxIterations: activeSim.solverConfig.maxIterations,
        relaxationFactors: activeSim.solverConfig.relaxationFactors,
      }
    : undefined;

  return (
    <div className="flex h-screen overflow-hidden dark">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto bg-background grid-engineering">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Simulation Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">FlowForge CFD — HVAC & Turbomachinery Platform</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAi(!showAi)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg surface-raised text-surface-foreground hover:bg-surface-overlay transition-colors text-sm"
            >
              <MessageSquare className="w-4 h-4 text-data-cyan" />
              AI Agent
            </button>
            <Link to="/builder" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium">
              <Plus className="w-4 h-4" />
              New Simulation
            </Link>
          </div>
        </header>

        <div className="p-8 space-y-8">
          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard label="Total Simulations" value={metrics.totalSimulations} icon={BarChart3} />
            <MetricCard label="Running" value={metrics.running} icon={Activity} color="cyan" pulse />
            <MetricCard label="Completed" value={metrics.completed} icon={Wind} color="emerald" />
            <MetricCard label="Failed" value={metrics.failed} icon={Settings2} color="rose" />
            <MetricCard label="Avg Solve Time" value={`${metrics.avgSolveTime}h`} icon={Cpu} />
            <MetricCard label="CPU Hours" value={metrics.totalCpuHours.toFixed(1)} icon={Thermometer} />
          </div>

          {/* Active Simulation Residuals */}
          {activeSim && activeSim.residuals.length > 0 && (
            <div className="surface-panel rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{activeSim.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Iteration {activeSim.currentIteration.toLocaleString()} / {activeSim.solverConfig.maxIterations.toLocaleString()}
                    {activeSim.estimatedTimeRemaining && ` — ~${Math.round(activeSim.estimatedTimeRemaining / 60)} min remaining`}
                  </p>
                </div>
                <div className={getStatusClass(activeSim.status)}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-glow" />
                  {getStatusLabel(activeSim.status)}
                </div>
              </div>
              <ResidualChart residuals={activeSim.residuals} />
            </div>
          )}

          {/* Simulations List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">All Simulations</h2>
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {simulations.map((sim) => (
                <SimulationCard key={sim.id} simulation={sim} />
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* AI Assistant Panel */}
      {showAi && <AiAssistantPanel onClose={() => setShowAi(false)} simulationContext={simContext} />}
    </div>
  );
};

export default Index;
