import { useFormContext } from "react-hook-form";
import type { SimulationBuilderFormData } from "./builder-schemas";
import { FormField } from "./FormField";

interface RotatingFramePanelProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function RotatingFramePanel({ enabled, onToggle }: RotatingFramePanelProps) {
  const { register, formState: { errors } } = useFormContext<SimulationBuilderFormData>();
  const rfErrors = errors.rotatingFrame;

  return (
    <section className="surface-panel rounded-lg p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">Rotating Reference Frame</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="rounded border-surface-border bg-surface-raised text-primary focus:ring-ring h-4 w-4"
          />
          <span className="text-xs text-muted-foreground">Enable MRF</span>
        </label>
      </div>

      {!enabled && (
        <p className="text-sm text-muted-foreground">Enable to configure a rotating reference frame for fan/blower simulations.</p>
      )}

      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Rotation Speed (RPM)" error={rfErrors?.rotationSpeed?.message}>
              <input
                type="number"
                step="1"
                {...register("rotatingFrame.rotationSpeed", { valueAsNumber: true })}
                className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
            </FormField>

            <FormField label="Zone ID" error={rfErrors?.zoneId?.message}>
              <input
                {...register("rotatingFrame.zoneId")}
                placeholder="rotating-zone-1"
                className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Rotation Axis</span>
              <div className="grid grid-cols-3 gap-2">
                {(["x", "y", "z"] as const).map((axis) => (
                  <FormField key={axis} label={axis.toUpperCase()}>
                    <input
                      type="number"
                      step="0.1"
                      {...register(`rotatingFrame.rotationAxis.${axis}`, { valueAsNumber: true })}
                      className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                    />
                  </FormField>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Origin (m)</span>
              <div className="grid grid-cols-3 gap-2">
                {(["x", "y", "z"] as const).map((axis) => (
                  <FormField key={axis} label={axis.toUpperCase()}>
                    <input
                      type="number"
                      step="0.001"
                      {...register(`rotatingFrame.origin.${axis}`, { valueAsNumber: true })}
                      className="w-full rounded-md surface-raised border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                    />
                  </FormField>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
