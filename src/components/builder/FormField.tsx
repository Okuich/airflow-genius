import { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FormField({ label, error, hint, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
        {hint && <span className="ml-1.5 normal-case tracking-normal text-muted-foreground/60">({hint})</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-data-rose">{error}</p>}
    </div>
  );
}
