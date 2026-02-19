import type { RoleProfile } from "./role-data";

export default function RoleBenefits({ role }: { role: RoleProfile | null }) {
  if (!role) return null;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300" key={role.id}>
      <div>
        <h3 className="text-2xl font-bold text-foreground leading-tight mb-2">{role.headline}</h3>
        <p className="text-muted-foreground text-sm max-w-md">{role.description}</p>
      </div>

      <div className="space-y-4">
        {role.benefits.map((b) => (
          <div key={b.title} className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
              <b.icon className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{b.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
