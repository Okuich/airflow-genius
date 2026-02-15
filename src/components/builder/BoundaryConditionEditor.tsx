import { useFormContext, useFieldArray } from "react-hook-form";
import { BoundaryType } from "@/modules/cfd/domain/models";
import type { SimulationBuilderFormData } from "./builder-schemas";
import { FormField } from "./FormField";
import { Plus, Trash2 } from "lucide-react";

export function BoundaryConditionEditor() {
  const { register, control, watch, formState: { errors } } = useFormContext<SimulationBuilderFormData>();
  const { fields, append, remove } = useFieldArray({ control, name: "boundaryConditions" });

  const addBoundary = () => {
    append({
      name: "",
      type: BoundaryType.Inlet,
      surfaceIds: "",
      pressure: undefined,
      temperature: undefined,
      heatFlux: undefined,
      velocity: undefined,
    });
  };

  return (
    <section className="surface-panel rounded-lg p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">Boundary Conditions</h3>
        <button
          type="button"
          onClick={addBoundary}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {errors.boundaryConditions?.root?.message && (
        <p className="text-xs text-data-rose">{errors.boundaryConditions.root.message}</p>
      )}

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">No boundary conditions defined. Add at least one.</p>
      )}

      <div className="space-y-4">
      {fields.map((field, index) => {
          const bcErrors = errors.boundaryConditions?.[index] as Record<string, { message?: string }> | undefined;
          const bcType = watch(`boundaryConditions.${index}.type`);

          return (
            <div key={field.id} className="surface-raised rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">BC #{index + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-muted-foreground hover:text-data-rose transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField label="Name" error={bcErrors?.name?.message}>
                  <input
                    {...register(`boundaryConditions.${index}.name`)}
                    placeholder="e.g. Inlet-1"
                    className="w-full rounded-md surface-overlay border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </FormField>

                <FormField label="Type" error={bcErrors?.type?.message}>
                  <select
                    {...register(`boundaryConditions.${index}.type`)}
                    className="w-full rounded-md surface-overlay border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value={BoundaryType.Inlet}>Inlet</option>
                    <option value={BoundaryType.Outlet}>Outlet</option>
                    <option value={BoundaryType.Wall}>Wall</option>
                    <option value={BoundaryType.Symmetry}>Symmetry</option>
                  </select>
                </FormField>

                <FormField label="Surface IDs" error={bcErrors?.surfaceIds?.message} hint="comma-separated">
                  <input
                    {...register(`boundaryConditions.${index}.surfaceIds`)}
                    placeholder="face-1, face-2"
                    className="w-full rounded-md surface-overlay border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  />
                </FormField>
              </div>

              {/* Conditional fields based on BC type */}
              {(bcType === BoundaryType.Inlet || bcType === BoundaryType.Outlet) && (
                <div className="grid grid-cols-4 gap-4">
                  <FormField label="Pressure (Pa)" error={bcErrors?.pressure?.message}>
                    <input
                      type="number"
                      {...register(`boundaryConditions.${index}.pressure`, { valueAsNumber: true })}
                      className="w-full rounded-md surface-overlay border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                    />
                  </FormField>

                  {bcType === BoundaryType.Inlet && (
                    <>
                      <FormField label="Vel X (m/s)">
                        <input
                          type="number"
                          step="0.1"
                          {...register(`boundaryConditions.${index}.velocity.x`, { valueAsNumber: true })}
                          className="w-full rounded-md surface-overlay border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                        />
                      </FormField>
                      <FormField label="Vel Y (m/s)">
                        <input
                          type="number"
                          step="0.1"
                          {...register(`boundaryConditions.${index}.velocity.y`, { valueAsNumber: true })}
                          className="w-full rounded-md surface-overlay border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                        />
                      </FormField>
                      <FormField label="Vel Z (m/s)">
                        <input
                          type="number"
                          step="0.1"
                          {...register(`boundaryConditions.${index}.velocity.z`, { valueAsNumber: true })}
                          className="w-full rounded-md surface-overlay border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                        />
                      </FormField>
                    </>
                  )}
                </div>
              )}

              {bcType === BoundaryType.Wall && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Temperature (K)" error={bcErrors?.temperature?.message}>
                    <input
                      type="number"
                      step="0.1"
                      {...register(`boundaryConditions.${index}.temperature`, { valueAsNumber: true })}
                      className="w-full rounded-md surface-overlay border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                    />
                  </FormField>
                  <FormField label="Heat Flux (W/m²)" error={bcErrors?.heatFlux?.message}>
                    <input
                      type="number"
                      step="0.1"
                      {...register(`boundaryConditions.${index}.heatFlux`, { valueAsNumber: true })}
                      className="w-full rounded-md surface-overlay border border-surface-border px-3 py-2 text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                    />
                  </FormField>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
