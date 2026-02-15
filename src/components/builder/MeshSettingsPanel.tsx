import { useFormContext } from "react-hook-form";
import type { SimulationBuilderFormData } from "./builder-schemas";
import { FormField } from "./FormField";

export function MeshSettingsPanel() {
  const { register, formState: { errors } } = useFormContext<SimulationBuilderFormData>();
  const meshErrors = errors.meshSettings;

  return (
    <section className="surface-panel rounded-lg p-6 space-y-5">
      <h3 className="text-sm font-semibold text-foreground tracking-tight">Mesh Settings</h3>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Base Size (m)" error={meshErrors?.baseSize?.message}>
          <input
            type="number"
            step="0.0001"
            {...register("meshSettings.baseSize", { valueAsNumber: true })}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>

        <FormField label="Min Size (m)" error={meshErrors?.minSize?.message}>
          <input
            type="number"
            step="0.0001"
            {...register("meshSettings.minSize", { valueAsNumber: true })}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>

        <FormField label="Max Size (m)" error={meshErrors?.maxSize?.message}>
          <input
            type="number"
            step="0.001"
            {...register("meshSettings.maxSize", { valueAsNumber: true })}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Refinement Levels" error={meshErrors?.refinementLevels?.message} hint="0–10">
          <input
            type="number"
            min={0}
            max={10}
            {...register("meshSettings.refinementLevels", { valueAsNumber: true })}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>

        <FormField label="BL Layers" error={meshErrors?.boundaryLayerCount?.message} hint="0–30">
          <input
            type="number"
            min={0}
            max={30}
            {...register("meshSettings.boundaryLayerCount", { valueAsNumber: true })}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>

        <FormField label="BL Growth Rate" error={meshErrors?.boundaryLayerGrowthRate?.message} hint="1.0–2.0">
          <input
            type="number"
            step="0.01"
            min={1}
            max={2}
            {...register("meshSettings.boundaryLayerGrowthRate", { valueAsNumber: true })}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Target Cell Count" error={meshErrors?.targetCellCount?.message}>
          <input
            type="number"
            {...register("meshSettings.targetCellCount", { valueAsNumber: true })}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>

        <FormField label="Feature Angle (°)" error={meshErrors?.featureAngle?.message} hint="0–180">
          <input
            type="number"
            min={0}
            max={180}
            {...register("meshSettings.featureAngle", { valueAsNumber: true })}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>

        <FormField label="Quality Threshold" error={meshErrors?.qualityThreshold?.message} hint="0–1">
          <input
            type="number"
            step="0.01"
            min={0}
            max={1}
            {...register("meshSettings.qualityThreshold", { valueAsNumber: true })}
            className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
        </FormField>
      </div>

      {meshErrors?.root?.message && (
        <p className="text-xs text-data-rose mt-1">{meshErrors.root.message}</p>
      )}
    </section>
  );
}
