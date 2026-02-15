import { SimulationForm } from "@/components/builder/SimulationForm";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const BuilderPage = () => {
  return (
    <div className="flex h-screen overflow-hidden dark">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto bg-background grid-engineering">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-8 py-4 flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="h-5 w-px bg-border" />
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Simulation Builder</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Configure and validate your CFD simulation</p>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-8 py-8">
          <SimulationForm />
        </div>
      </main>
    </div>
  );
};

export default BuilderPage;
