import { Wind, BarChart3, Settings2, FolderOpen, Cpu, HelpCircle, LogOut } from "lucide-react";

const NAV_ITEMS = [
  { icon: BarChart3, label: "Dashboard", active: true },
  { icon: Wind, label: "Simulations" },
  { icon: FolderOpen, label: "Projects" },
  { icon: Cpu, label: "Solver Queue" },
  { icon: Settings2, label: "Settings" },
];

export function AppSidebar() {
  return (
    <aside className="w-64 h-screen flex flex-col surface-panel border-r border-surface-border shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Wind className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground tracking-tight">FlowForge</span>
            <span className="text-[10px] ml-1.5 text-data-cyan font-mono font-medium">CFD</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              item.active
                ? "bg-surface-overlay text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-overlay/50"
            }`}
          >
            <item.icon className={`w-4 h-4 ${item.active ? "text-data-cyan" : ""}`} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-surface-border space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-overlay/50 transition-colors">
          <HelpCircle className="w-4 h-4" />
          Documentation
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-overlay/50 transition-colors">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Usage */}
      <div className="px-4 py-4 border-t border-surface-border">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Compute Usage</div>
        <div className="w-full h-1.5 rounded-full bg-surface-overlay overflow-hidden">
          <div className="h-full rounded-full bg-data-cyan w-[68%]" />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">342.7 / 500 CPU-hrs</p>
      </div>
    </aside>
  );
}
