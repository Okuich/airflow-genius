// ─── RBAC Enforcement Middleware ─────────────────────────────────────────────
// Utilities for enforcing RBAC in edge functions and server-side logic.
// ──────────────────────────────────────────────────────────────────────────

import {
  Role,
  Permission,
  roleHasPermission,
  isRoleAtLeast,
  type PolicyContext,
  type AccessDecision,
  defaultPolicyRegistry,
} from "./rbac-core";

// ── Types ───────────────────────────────────────────────────────────────────

export interface RBACRequest {
  userId: string;
  role: Role;
  organizationId: string;
}

export interface EnforcementResult {
  granted: boolean;
  decision: AccessDecision;
  /** HTTP status code to return on denial. */
  statusCode: 200 | 403;
}

// ── Middleware Functions ────────────────────────────────────────────────────

/**
 * Check if a request has a specific permission (role-level only).
 * Use for fast checks that don't need resource context.
 */
export function requirePermission(req: RBACRequest, permission: Permission): EnforcementResult {
  const allowed = roleHasPermission(req.role as Role, permission);
  return {
    granted: allowed,
    statusCode: allowed ? 200 : 403,
    decision: {
      allowed,
      reason: allowed
        ? `Role "${req.role}" has permission "${permission}"`
        : `Role "${req.role}" lacks permission "${permission}"`,
      evaluatedPolicies: [],
    },
  };
}

/**
 * Check if a request has at least a minimum role.
 */
export function requireRole(req: RBACRequest, minRole: Role): EnforcementResult {
  const allowed = isRoleAtLeast(req.role as Role, minRole);
  return {
    granted: allowed,
    statusCode: allowed ? 200 : 403,
    decision: {
      allowed,
      reason: allowed
        ? `Role "${req.role}" meets minimum "${minRole}"`
        : `Role "${req.role}" is below minimum "${minRole}"`,
      evaluatedPolicies: [],
    },
  };
}

/**
 * Full policy-based enforcement with resource context.
 * Evaluates role permissions AND resource-level policies.
 */
export async function enforcePolicy<TResource>(
  permission: Permission,
  ctx: PolicyContext<TResource>
): Promise<EnforcementResult> {
  const decision = await defaultPolicyRegistry.evaluate(permission, ctx);
  return {
    granted: decision.allowed,
    statusCode: decision.allowed ? 200 : 403,
    decision,
  };
}

/**
 * Create a reusable enforcement guard for a specific permission.
 * Useful for composing in edge function handlers.
 */
export function createPermissionGuard(permission: Permission) {
  return {
    /** Quick role-level check. */
    check(req: RBACRequest): EnforcementResult {
      return requirePermission(req, permission);
    },
    /** Full policy evaluation with resource context. */
    async enforce<T>(ctx: PolicyContext<T>): Promise<EnforcementResult> {
      return enforcePolicy(permission, ctx);
    },
  };
}

// ── Pre-built Guards ────────────────────────────────────────────────────────

export const guards = {
  simulation: {
    create: createPermissionGuard(Permission.SIMULATION_CREATE),
    read: createPermissionGuard(Permission.SIMULATION_READ),
    update: createPermissionGuard(Permission.SIMULATION_UPDATE),
    delete: createPermissionGuard(Permission.SIMULATION_DELETE),
    execute: createPermissionGuard(Permission.SIMULATION_EXECUTE),
  },
  result: {
    read: createPermissionGuard(Permission.RESULT_READ),
    delete: createPermissionGuard(Permission.RESULT_DELETE),
    export: createPermissionGuard(Permission.RESULT_EXPORT),
  },
  compliance: {
    read: createPermissionGuard(Permission.COMPLIANCE_READ),
    evaluate: createPermissionGuard(Permission.COMPLIANCE_EVALUATE),
    export: createPermissionGuard(Permission.COMPLIANCE_EXPORT),
    delete: createPermissionGuard(Permission.COMPLIANCE_DELETE),
  },
  ml: {
    trainingCreate: createPermissionGuard(Permission.ML_TRAINING_CREATE),
    trainingRead: createPermissionGuard(Permission.ML_TRAINING_READ),
    trainingDelete: createPermissionGuard(Permission.ML_TRAINING_DELETE),
    modelDeploy: createPermissionGuard(Permission.ML_MODEL_DEPLOY),
    modelDelete: createPermissionGuard(Permission.ML_MODEL_DELETE),
  },
  member: {
    invite: createPermissionGuard(Permission.MEMBER_INVITE),
    remove: createPermissionGuard(Permission.MEMBER_REMOVE),
    changeRole: createPermissionGuard(Permission.MEMBER_CHANGE_ROLE),
  },
  org: {
    update: createPermissionGuard(Permission.ORG_UPDATE),
    delete: createPermissionGuard(Permission.ORG_DELETE),
    viewBilling: createPermissionGuard(Permission.ORG_VIEW_BILLING),
  },
} as const;

// ── Edge Function Helper ────────────────────────────────────────────────────

/**
 * Helper to extract RBAC context from a Supabase user + org membership query.
 * Use in edge functions after authenticating the user.
 */
export function buildRBACRequest(
  userId: string,
  role: string,
  organizationId: string
): RBACRequest {
  const validRoles = Object.values(Role);
  const safeRole = validRoles.includes(role as Role) ? (role as Role) : Role.VIEWER;
  return { userId, role: safeRole, organizationId };
}

/**
 * JSON error response for denied access.
 */
export function denyResponse(result: EnforcementResult): Response {
  return new Response(
    JSON.stringify({
      error: "Forbidden",
      reason: result.decision.reason,
      required_permission: result.decision.evaluatedPolicies.length > 0
        ? result.decision.evaluatedPolicies.map((p) => p.policyId)
        : undefined,
    }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    }
  );
}
