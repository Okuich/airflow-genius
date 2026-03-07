import { useEffect } from "react";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/modules/tenant";
import { isPathAllowed } from "@/components/trial/trial-tiers";
import Index from "./pages/Index";
import Builder from "./pages/Builder";
import Viewer from "./pages/Viewer";
import Compliance from "./pages/Compliance";
import MLPipeline from "./pages/MLPipeline";
import ModelExplainability from "./pages/ModelExplainability";
import SolverStatus from "./pages/SolverStatus";
import CleanroomMetrics from "./pages/CleanroomMetrics";
import DataCenterHeatMap from "./pages/DataCenterHeatMap";
import Auth from "./pages/Auth";
import Architecture from "./pages/Architecture";
import TrialSignup from "./pages/TrialSignup";
import GpuUsage from "./pages/GpuUsage";
import IPTracking from "./pages/IPTracking";
import Billing from "./pages/Billing";
import DataFlywheel from "./pages/DataFlywheel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, currentOrg } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background dark">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  // Trial tier feature gating
  const orgTier = currentOrg?.tier ?? "full";
  const trialTier = orgTier.startsWith("trial-") ? orgTier.replace("trial-", "") : "full";
  if (!isPathAllowed(trialTier, location.pathname)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/trial" element={<TrialSignup />} />
      <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="/builder" element={<ProtectedRoute><Builder /></ProtectedRoute>} />
      <Route path="/viewer" element={<ProtectedRoute><Viewer /></ProtectedRoute>} />
      <Route path="/compliance" element={<ProtectedRoute><Compliance /></ProtectedRoute>} />
      <Route path="/ml-pipeline" element={<ProtectedRoute><MLPipeline /></ProtectedRoute>} />
      <Route path="/explainability" element={<ProtectedRoute><ModelExplainability /></ProtectedRoute>} />
      <Route path="/solver-status" element={<ProtectedRoute><SolverStatus /></ProtectedRoute>} />
      <Route path="/cleanroom" element={<ProtectedRoute><CleanroomMetrics /></ProtectedRoute>} />
      <Route path="/datacenter" element={<ProtectedRoute><DataCenterHeatMap /></ProtectedRoute>} />
      <Route path="/architecture" element={<ProtectedRoute><Architecture /></ProtectedRoute>} />
      <Route path="/gpu-usage" element={<ProtectedRoute><GpuUsage /></ProtectedRoute>} />
      <Route path="/ip-tracking" element={<ProtectedRoute><IPTracking /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
      <Route path="/data-flywheel" element={<ProtectedRoute><DataFlywheel /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      toast.error("An unexpected error occurred. Please try again.");
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
