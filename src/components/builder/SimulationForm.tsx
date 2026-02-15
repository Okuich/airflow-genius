import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SimulationBuilderSchema, type SimulationBuilderFormData } from "./builder-schemas";
import { TurbulenceSelector } from "./TurbulenceSelector";
import { MeshSettingsPanel } from "./MeshSettingsPanel";
import { BoundaryConditionEditor } from "./BoundaryConditionEditor";
import { RotatingFramePanel } from "./RotatingFramePanel";
import { SolverSettingsPanel } from "./SolverSettingsPanel";
import { FormField } from "./FormField";
import { FlowType, TurbulenceType, BoundaryType } from "@/modules/cfd/domain/models";
import { Rocket, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_VALUES: SimulationBuilderFormData = {
  name: "",
  description: "",
  turbulenceModel: {
    type: TurbulenceType.SST,
    wallFunction: false,
    turbulentIntensity: 0.05,
    turbulentViscosityRatio: 10,
    kInitial: 0.1,
    omegaInitial: 1.0,
  },
  meshSettings: {
    baseSize: 0.005,
    minSize: 0.001,
    maxSize: 0.02,
    refinementLevels: 3,
    boundaryLayerCount: 15,
    boundaryLayerGrowthRate: 1.2,
    targetCellCount: 2_000_000,
    featureAngle: 30,
    qualityThreshold: 0.8,
  },
  solverSettings: {
    flowType: FlowType.Steady,
    maxIterations: 2000,
    convergenceCriteria: 1e-6,
    relaxationPressure: 0.3,
    relaxationVelocity: 0.7,
    relaxationTurbulence: 0.8,
  },
  boundaryConditions: [
    {
      name: "Inlet",
      type: BoundaryType.Inlet,
      surfaceIds: "inlet-face",
      velocity: { x: 0, y: 0, z: 5 },
      pressure: 0,
    },
  ],
  fluidDensity: 1.184,
  fluidViscosity: 1.849e-5,
  enableHeatTransfer: false,
  referencePressure: 101325,
};

export function SimulationForm() {
  const [mrfEnabled, setMrfEnabled] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const methods = useForm<SimulationBuilderFormData>({
    resolver: zodResolver(SimulationBuilderSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onChange",
  });

  const { register, handleSubmit, formState: { errors, isValid, isDirty } } = methods;

  const onSubmit = (data: SimulationBuilderFormData) => {
    // Strip rotatingFrame if not enabled
    if (!mrfEnabled) {
      delete data.rotatingFrame;
    }

    console.log("Simulation config:", JSON.stringify(data, null, 2));
    setSubmitted(true);
    toast.success("Simulation configuration validated and ready for submission", {
      description: `${data.name} — ${data.solverSettings.flowType} flow with ${data.turbulenceModel.type}`,
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* General info */}
        <section className="surface-panel rounded-lg p-6 space-y-5">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">General</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Simulation Name" error={errors.name?.message}>
              <input
                {...register("name")}
                placeholder="e.g. Centrifugal Blower — Design Point"
                className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </FormField>
            <FormField label="Description" error={errors.description?.message}>
              <input
                {...register("description")}
                placeholder="Optional description…"
                className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="Fluid Density (kg/m³)" error={errors.fluidDensity?.message}>
              <input
                type="number"
                step="0.001"
                {...register("fluidDensity", { valueAsNumber: true })}
                className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
            </FormField>
            <FormField label="Fluid Viscosity (Pa·s)" error={errors.fluidViscosity?.message}>
              <input
                type="number"
                step="0.0000001"
                {...register("fluidViscosity", { valueAsNumber: true })}
                className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
            </FormField>
            <FormField label="Reference Pressure (Pa)" error={errors.referencePressure?.message}>
              <input
                type="number"
                {...register("referencePressure", { valueAsNumber: true })}
                className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("enableHeatTransfer")}
              className="rounded border-surface-border bg-surface-raised text-primary focus:ring-ring h-4 w-4"
            />
            <span className="text-sm text-muted-foreground">Enable heat transfer</span>
          </label>
        </section>

        <TurbulenceSelector />
        <MeshSettingsPanel />
        <SolverSettingsPanel />
        <BoundaryConditionEditor />
        <RotatingFramePanel enabled={mrfEnabled} onToggle={setMrfEnabled} />

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground">
            {isValid ? (
              <span className="flex items-center gap-1.5 text-data-emerald">
                <CheckCircle2 className="w-3.5 h-3.5" /> All fields valid
              </span>
            ) : (
              <span>Fix validation errors above to submit</span>
            )}
          </div>
          <button
            type="submit"
            disabled={!isDirty}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity text-sm font-medium"
          >
            <Rocket className="w-4 h-4" />
            Submit Simulation
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
