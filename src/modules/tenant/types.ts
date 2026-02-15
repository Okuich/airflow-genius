// ─── Multi-Tenant Domain Types ──────────────────────────────────────────────

export type AppRole = "owner" | "admin" | "member" | "viewer";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  max_members: number;
  tier: "free" | "pro" | "enterprise";
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: AppRole;
  joined_at: string;
  profile?: Profile;
}

export interface SimulationRow {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  description: string | null;
  status: string;
  solver_config: Record<string, unknown>;
  mesh_config: Record<string, unknown>;
  fluid_properties: Record<string, unknown>;
  boundary_conditions: Record<string, unknown>[];
  cell_count: number | null;
  current_iteration: number | null;
  progress: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ComputeUsageRow {
  id: string;
  organization_id: string;
  simulation_id: string | null;
  user_id: string;
  cpu_hours: number;
  gpu_hours: number;
  memory_gb_hours: number;
  duration_seconds: number;
  cost_usd: number;
  recorded_at: string;
}

// ─── Permission Helpers ─────────────────────────────────────────────────────

const ROLE_RANK: Record<AppRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

export function hasMinRole(userRole: AppRole, minRole: AppRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

export function canManageMembers(role: AppRole): boolean {
  return hasMinRole(role, "admin");
}

export function canEditSimulations(role: AppRole): boolean {
  return hasMinRole(role, "member");
}

export function canDeleteSimulations(role: AppRole): boolean {
  return hasMinRole(role, "admin");
}
