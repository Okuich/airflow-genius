// ─── RBAC Module ────────────────────────────────────────────────────────────
// Enterprise-grade Role-Based Access Control system.
// ──────────────────────────────────────────────────────────────────────────

// Core types and utilities
export {
  Role,
  Permission,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  isRoleAtLeast,
  isRoleAbove,
  roleHasPermission,
  roleGetPermissions,
  ownerOrAdminPolicy,
  adminOnlyPolicy,
  ownerOnlyPolicy,
  PolicyRegistry,
  defaultPolicyRegistry,
  type AccessPolicy,
  type PolicyContext,
  type AccessDecision,
  type PolicyEvaluation,
} from "./rbac-core";

// Middleware (for edge functions / server-side)
export {
  requirePermission,
  requireRole,
  enforcePolicy,
  createPermissionGuard,
  guards,
  buildRBACRequest,
  denyResponse,
  type RBACRequest,
  type EnforcementResult,
} from "./rbac-middleware";

// React hooks and components
export {
  useRole,
  usePermission,
  useOrgScope,
  RequirePermission,
  RequireRole,
  type UseRoleResult,
  type UsePermissionResult,
} from "./rbac-hooks";
