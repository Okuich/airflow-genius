import { useFormContext } from "react-hook-form";
import { TurbulenceType } from "@/modules/cfd/domain/models";
import type { SimulationBuilderFormData } from "./builder-schemas";
import { FormField } from "./FormField";

export function TurbulenceSelector() {
  const { register, watch, formState: { errors } } = useFormContext<SimulationBuilderFormData>();
  const turbType = watch("turbulenceModel.type");
  const turbErrors = errors.turbulenceModel as Record<string, { message?: string }> | undefined;

  return (
    <section className="surface-panel rounded-lg p-6 space-y-5">
      <h3 className="text-sm font-semibold text-foreground tracking-tight">Turbulence Model</h3>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Model" error={turbErrors?.type?.message}>
          <select
            {...register("turbulenceModel.type")}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          >
            <option value={TurbulenceType.KEpsilon}>k-ε Standard</option>
            <option value={TurbulenceType.SST}>k-ω SST</option>
          </select>
        </FormField>

        <FormField label="Wall Function">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              {...register("turbulenceModel.wallFunction")}
              className="rounded border-surface-border bg-surface-raised text-primary focus:ring-ring h-4 w-4"
            />
            <span className="text-sm text-muted-foreground">Enable wall functions</span>
          </label>
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Turbulent Intensity" error={turbErrors?.turbulentIntensity?.message} hint="0–1">
          <input
            type="number"
            step="0.01"
            {...register("turbulenceModel.turbulentIntensity", { valueAsNumber: true })}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>

        <FormField label="Viscosity Ratio" error={turbErrors?.turbulentViscosityRatio?.message}>
          <input
            type="number"
            step="0.1"
            {...register("turbulenceModel.turbulentViscosityRatio", { valueAsNumber: true })}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>

        <FormField label="k Initial" error={turbErrors?.kInitial?.message}>
          <input
            type="number"
            step="0.001"
            {...register("turbulenceModel.kInitial", { valueAsNumber: true })}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>
      </div>

      {turbType === TurbulenceType.KEpsilon && (
        <FormField label="ε Initial" error={turbErrors?.epsilonInitial?.message}>
          <input
            type="number"
            step="0.0001"
            {...register("turbulenceModel.epsilonInitial", { valueAsNumber: true })}
            className="w-full max-w-xs rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>
      )}

      {turbType === TurbulenceType.SST && (
        <FormField label="ω Initial" error={turbErrors?.omegaInitial?.message}>
          <input
            type="number"
            step="0.01"
            {...register("turbulenceModel.omegaInitial", { valueAsNumber: true })}
            className="w-full max-w-xs rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>
      )}

      {turbErrors?.root?.message && (
        <p className="text-xs text-data-rose mt-1">{turbErrors.root.message}</p>
      )}
    </section>
  );
}
