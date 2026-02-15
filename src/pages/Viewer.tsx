import { CFDViewer } from "@/components/cfd/viewer";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SEOHead } from "@/components/SEOHead";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const ViewerPage = () => {
  return (
    <div className="flex h-screen overflow-hidden dark">
      <SEOHead title="3D Viewer — FlowForge CFD" description="Visualize CFD results with interactive 3D contour maps, velocity vectors, and slice planes." />
      <AppSidebar />

      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <header className="shrink-0 border-b border-border bg-background/80 backdrop-blur-xl px-8 py-4 flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="h-5 w-px bg-border" />
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">CFD Visualisation</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              3D field data — velocity vectors, pressure &amp; temperature contours
            </p>
          </div>
        </header>

        <div className="flex-1 relative">
          <CFDViewer />
        </div>
      </main>
    </div>
  );
};

export default ViewerPage;
