// ─── Enterprise RBAC Core ───────────────────────────────────────────────────
// Role enum, Permission enum, RolePermission mapping, AccessPolicy interface,
// hierarchical role utilities, and resource-level policy enforcement.
// ──────────────────────────────────────────────────────────────────────────

// ── Role Enum ───────────────────────────────────────────────────────────────

export enum Role {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
  VIEWER = "viewer",
}

/** Numeric rank for hierarchy comparisons. Higher = more privileged. */
export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.OWNER]: 400,
  [Role.ADMIN]: 300,
  [Role.MEMBER]: 200,
  [Role.VIEWER]: 100,
};

export function isRoleAtLeast(userRole: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export function isRoleAbove(userRole: Role, other: Role): boolean {
  return ROLE_HIERARCHY[userRole] > ROLE_HIERARCHY[other];
}

// ── Permission Enum ─────────────────────────────────────────────────────────

export enum Permission {
  // Simulations
  SIMULATION_CREATE = "simulation:create",
  SIMULATION_READ = "simulation:read",
  SIMULATION_UPDATE = "simulation:update",
  SIMULATION_DELETE = "simulation:delete",
  SIMULATION_EXECUTE = "simulation:execute",

  // Results
  RESULT_READ = "result:read",
  RESULT_DELETE = "result:delete",
  RESULT_EXPORT = "result:export",

  // Compliance
  COMPLIANCE_READ = "compliance:read",
  COMPLIANCE_EVALUATE = "compliance:evaluate",
  COMPLIANCE_EXPORT = "compliance:export",
  COMPLIANCE_DELETE = "compliance:delete",

  // ML Pipeline
  ML_TRAINING_CREATE = "ml_training:create",
  ML_TRAINING_READ = "ml_training:read",
  ML_TRAINING_DELETE = "ml_training:delete",
  ML_MODEL_DEPLOY = "ml_model:deploy",
  ML_MODEL_DELETE = "ml_model:delete",

  // Members & Org
  MEMBER_INVITE = "member:invite",
  MEMBER_REMOVE = "member:remove",
  MEMBER_CHANGE_ROLE = "member:change_role",
  ORG_UPDATE = "org:update",
  ORG_DELETE = "org:delete",
  ORG_VIEW_BILLING = "org:view_billing",

  // Compute
  COMPUTE_READ = "compute:read",
  COMPUTE_DELETE = "compute:delete",

  // Feature Store
  FEATURE_CREATE = "feature:create",
  FEATURE_READ = "feature:read",
  FEATURE_DELETE = "feature:delete",
}

// ── Role → Permission Mapping ───────────────────────────────────────────────

const VIEWER_PERMISSIONS: Permission[] = [
  Permission.SIMULATION_READ,
  Permission.RESULT_READ,
  Permission.COMPLIANCE_READ,
  Permission.ML_TRAINING_READ,
  Permission.COMPUTE_READ,
  Permission.FEATURE_READ,
];

const MEMBER_PERMISSIONS: Permission[] = [
  ...VIEWER_PERMISSIONS,
  Permission.SIMULATION_CREATE,
  Permission.SIMULATION_UPDATE,
  Permission.SIMULATION_EXECUTE,
  Permission.RESULT_EXPORT,
  Permission.COMPLIANCE_EVALUATE,
  Permission.COMPLIANCE_EXPORT,
  Permission.ML_TRAINING_CREATE,
  Permission.FEATURE_CREATE,
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...MEMBER_PERMISSIONS,
  Permission.SIMULATION_DELETE,
  Permission.RESULT_DELETE,
  Permission.COMPLIANCE_DELETE,
  Permission.ML_TRAINING_DELETE,
  Permission.ML_MODEL_DEPLOY,
  Permission.ML_MODEL_DELETE,
  Permission.MEMBER_INVITE,
  Permission.MEMBER_REMOVE,
  Permission.MEMBER_CHANGE_ROLE,
  Permission.ORG_UPDATE,
  Permission.ORG_VIEW_BILLING,
  Permission.COMPUTE_DELETE,
  Permission.FEATURE_DELETE,
];

const OWNER_PERMISSIONS: Permission[] = [
  ...ADMIN_PERMISSIONS,
  Permission.ORG_DELETE,
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  [Role.OWNER]: new Set(OWNER_PERMISSIONS),
  [Role.ADMIN]: new Set(ADMIN_PERMISSIONS),
  [Role.MEMBER]: new Set(MEMBER_PERMISSIONS),
  [Role.VIEWER]: new Set(VIEWER_PERMISSIONS),
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function roleGetPermissions(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

// ── Access Policy Interface ─────────────────────────────────────────────────

/** Describes a resource-level access policy. */
export interface AccessPolicy<TResource = unknown> {
  /** Unique policy identifier. */
  id: string;
  /** Human-readable description. */
  description: string;
  /** The permission this policy governs. */
  permission: Permission;
  /**
   * Evaluate whether the given context satisfies this policy.
   * Return `true` to allow, `false` to deny.
   */
  evaluate(ctx: PolicyContext<TResource>): boolean | Promise<boolean>;
}

export interface PolicyContext<TResource = unknown> {
  /** Authenticated user ID. */
  userId: string;
  /** User's role in the organization. */
  role: Role;
  /** Organization ID scope. */
  organizationId: string;
  /** The resource being accessed (if applicable). */
  resource?: TResource;
  /** Additional metadata (e.g., IP, timestamp). */
  metadata?: Record<string, unknown>;
}

// ── Resource-Level Policies ─────────────────────────────────────────────────

/** Built-in policy: only the resource owner or admins+ can modify. */
export function ownerOrAdminPolicy<T extends { created_by?: string; user_id?: string }>(
  permission: Permission,
  description: string
): AccessPolicy<T> {
  return {
    id: `builtin:owner_or_admin:${permission}`,
    description,
    permission,
    evaluate({ role, userId, resource }) {
      if (isRoleAtLeast(role, Role.ADMIN)) return true;
      const ownerId = resource?.created_by ?? resource?.user_id;
      return ownerId === userId;
    },
  };
}

/** Built-in policy: only admins+ can perform the action. */
export function adminOnlyPolicy(permission: Permission, description: string): AccessPolicy {
  return {
    id: `builtin:admin_only:${permission}`,
    description,
    permission,
    evaluate({ role }) {
      return isRoleAtLeast(role, Role.ADMIN);
    },
  };
}

/** Built-in policy: only the owner role can perform. */
export function ownerOnlyPolicy(permission: Permission, description: string): AccessPolicy {
  return {
    id: `builtin:owner_only:${permission}`,
    description,
    permission,
    evaluate({ role }) {
      return role === Role.OWNER;
    },
  };
}

// ── Policy Registry ─────────────────────────────────────────────────────────

/**
 * Registry for managing and evaluating access policies.
 * Supports layered policy composition — all policies for a permission must pass.
 */
export class PolicyRegistry {
  private policies = new Map<Permission, AccessPolicy[]>();

  register(policy: AccessPolicy): void {
    const existing = this.policies.get(policy.permission) ?? [];
    existing.push(policy);
    this.policies.set(policy.permission, existing);
  }

  registerMany(policies: AccessPolicy[]): void {
    policies.forEach((p) => this.register(p));
  }

  /**
   * Evaluate all policies for a permission. ALL must pass (AND logic).
   * If no resource-level policies exist, falls back to role-permission check.
   */
  async evaluate<T>(permission: Permission, ctx: PolicyContext<T>): Promise<AccessDecision> {
    // Step 1: Role-level check
    if (!roleHasPermission(ctx.role, permission)) {
      return {
        allowed: false,
        reason: `Role "${ctx.role}" lacks permission "${permission}"`,
        evaluatedPolicies: [],
      };
    }

    // Step 2: Resource-level policies
    const applicable = (this.policies.get(permission) ?? []) as AccessPolicy<T>[];
    if (applicable.length === 0) {
      return { allowed: true, reason: "Role permission granted, no resource policies", evaluatedPolicies: [] };
    }

    const results: PolicyEvaluation[] = [];
    for (const policy of applicable) {
      const result = await policy.evaluate({ ...ctx, resource: ctx.resource });
      results.push({ policyId: policy.id, allowed: result });
      if (!result) {
        return {
          allowed: false,
          reason: `Denied by policy "${policy.id}": ${policy.description}`,
          evaluatedPolicies: results,
        };
      }
    }

    return { allowed: true, reason: "All policies passed", evaluatedPolicies: results };
  }

  /** Get all registered policies for a permission. */
  getPolicies(permission: Permission): readonly AccessPolicy[] {
    return this.policies.get(permission) ?? [];
  }
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  evaluatedPolicies: PolicyEvaluation[];
}

export interface PolicyEvaluation {
  policyId: string;
  allowed: boolean;
}

// ── Default Policy Registry ─────────────────────────────────────────────────

export const defaultPolicyRegistry = new PolicyRegistry();

// Register built-in resource-level policies
defaultPolicyRegistry.registerMany([
  ownerOrAdminPolicy<{ created_by?: string }>(
    Permission.SIMULATION_UPDATE,
    "Only simulation creator or admins can update"
  ),
  ownerOrAdminPolicy<{ created_by?: string }>(
    Permission.SIMULATION_DELETE,
    "Only simulation creator or admins can delete"
  ),
  adminOnlyPolicy(Permission.MEMBER_INVITE, "Only admins can invite members"),
  adminOnlyPolicy(Permission.MEMBER_REMOVE, "Only admins can remove members"),
  adminOnlyPolicy(Permission.MEMBER_CHANGE_ROLE, "Only admins can change roles"),
  ownerOnlyPolicy(Permission.ORG_DELETE, "Only owner can delete organization"),
]);
