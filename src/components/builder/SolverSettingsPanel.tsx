import { useFormContext } from "react-hook-form";
import { FlowType } from "@/modules/cfd/domain/models";
import type { SimulationBuilderFormData } from "./builder-schemas";
import { FormField } from "./FormField";

export function SolverSettingsPanel() {
  const { register, watch, formState: { errors } } = useFormContext<SimulationBuilderFormData>();
  const flowType = watch("solverSettings.flowType");
  const solverErrors = errors.solverSettings;

  return (
    <section className="surface-panel rounded-lg p-6 space-y-5">
      <h3 className="text-sm font-semibold text-foreground tracking-tight">Solver Settings</h3>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Flow Type" error={solverErrors?.flowType?.message}>
          <select
            {...register("solverSettings.flowType")}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          >
            <option value={FlowType.Steady}>Steady</option>
            <option value={FlowType.Transient}>Transient</option>
          </select>
        </FormField>

        <FormField label="Max Iterations" error={solverErrors?.maxIterations?.message}>
          <input
            type="number"
            {...register("solverSettings.maxIterations", { valueAsNumber: true })}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>

        <FormField label="Convergence Criteria" error={solverErrors?.convergenceCriteria?.message}>
          <input
            type="number"
            step="0.000001"
            {...register("solverSettings.convergenceCriteria", { valueAsNumber: true })}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>
      </div>

      <div>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-3">Relaxation Factors</span>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Pressure" error={solverErrors?.relaxationPressure?.message} hint="0–1">
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              {...register("solverSettings.relaxationPressure", { valueAsNumber: true })}
              className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </FormField>
          <FormField label="Velocity" error={solverErrors?.relaxationVelocity?.message} hint="0–1">
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              {...register("solverSettings.relaxationVelocity", { valueAsNumber: true })}
              className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </FormField>
          <FormField label="Turbulence" error={solverErrors?.relaxationTurbulence?.message} hint="0–1">
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              {...register("solverSettings.relaxationTurbulence", { valueAsNumber: true })}
              className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </FormField>
        </div>
      </div>

      {flowType === FlowType.Transient && (
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Time Step (s)" error={solverErrors?.timeStep?.message}>
            <input
              type="number"
              step="0.0001"
              {...register("solverSettings.timeStep", { valueAsNumber: true })}
              className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </FormField>
          <FormField label="Total Time (s)" error={solverErrors?.totalTime?.message}>
            <input
              type="number"
              step="0.1"
              {...register("solverSettings.totalTime", { valueAsNumber: true })}
              className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </FormField>
        </div>
      )}

      {solverErrors?.root?.message && (
        <p className="text-xs text-data-rose mt-1">{solverErrors.root.message}</p>
      )}
    </section>
  );
}
