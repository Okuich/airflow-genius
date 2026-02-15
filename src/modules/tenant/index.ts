export { AuthProvider, useAuth } from "./auth-context";
export { useOrganization, useOrgSimulations, useOrgComputeUsage } from "./hooks";
export {
  type AppRole,
  type Organization,
  type Profile,
  type OrganizationMember,
  type SimulationRow,
  type ComputeUsageRow,
  hasMinRole,
  canManageMembers,
  canEditSimulations,
  canDeleteSimulations,
} from "./types";

// Re-export RBAC module for convenience
export {
  Role,
  Permission,
  useRole,
  usePermission,
  useOrgScope,
  RequirePermission,
  RequireRole,
  guards,
} from "@/modules/rbac";
