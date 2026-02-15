// ─── RBAC React Hooks & Components ──────────────────────────────────────────
// Frontend permission-aware hooks, guards, and query helpers.
// ──────────────────────────────────────────────────────────────────────────

import { useMemo, useCallback, type ReactNode } from "react";
import { useAuth } from "@/modules/tenant/auth-context";
import {
  Role,
  Permission,
  roleHasPermission,
  isRoleAtLeast,
  roleGetPermissions,
  ROLE_HIERARCHY,
} from "./rbac-core";
import type { AppRole } from "@/modules/tenant/types";

// ── useRole Hook ────────────────────────────────────────────────────────────

export interface UseRoleResult {
  /** Current user's role in the active organization. */
  role: Role | null;
  /** Numeric rank for the current role. */
  rank: number;
  /** Whether the user has at least the given role. */
  isAtLeast: (minRole: Role) => boolean;
  /** Whether the role matches exactly. */
  isExactly: (r: Role) => boolean;
  /** Convenience booleans. */
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isViewer: boolean;
  /** Whether the user has admin-or-above privileges. */
  isPrivileged: boolean;
}

export function useRole(): UseRoleResult {
  const { currentRole } = useAuth();

  return useMemo(() => {
    const role = (currentRole as Role) ?? null;
    const rank = role ? ROLE_HIERARCHY[role] : 0;

    return {
      role,
      rank,
      isAtLeast: (minRole: Role) => (role ? isRoleAtLeast(role, minRole) : false),
      isExactly: (r: Role) => role === r,
      isOwner: role === Role.OWNER,
      isAdmin: role === Role.ADMIN,
      isMember: role === Role.MEMBER,
      isViewer: role === Role.VIEWER,
      isPrivileged: role ? isRoleAtLeast(role, Role.ADMIN) : false,
    };
  }, [currentRole]);
}

// ── usePermission Hook ──────────────────────────────────────────────────────

export interface UsePermissionResult {
  /** Check a single permission. */
  can: (permission: Permission) => boolean;
  /** Check multiple permissions (ALL must pass). */
  canAll: (permissions: Permission[]) => boolean;
  /** Check multiple permissions (ANY must pass). */
  canAny: (permissions: Permission[]) => boolean;
  /** Get all permissions for the current role. */
  permissions: Permission[];
}

export function usePermission(): UsePermissionResult {
  const { currentRole } = useAuth();

  return useMemo(() => {
    const role = (currentRole as Role) ?? null;

    const can = (p: Permission) => (role ? roleHasPermission(role, p) : false);
    const canAll = (ps: Permission[]) => ps.every(can);
    const canAny = (ps: Permission[]) => ps.some(can);
    const permissions = role ? roleGetPermissions(role) : [];

    return { can, canAll, canAny, permissions };
  }, [currentRole]);
}

// ── RequirePermission Component ─────────────────────────────────────────────

interface RequirePermissionProps {
  /** Permission(s) required. If array, ALL must pass. */
  permission: Permission | Permission[];
  /** Content to render when permission is granted. */
  children: ReactNode;
  /** Optional fallback when denied. Defaults to null (hidden). */
  fallback?: ReactNode;
}

export function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const { can, canAll } = usePermission();

  const allowed = Array.isArray(permission) ? canAll(permission) : can(permission);

  return <>{allowed ? children : fallback}</>;
}

// ── RequireRole Component ───────────────────────────────────────────────────

interface RequireRoleProps {
  /** Minimum role required. */
  minRole: Role;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({ minRole, children, fallback = null }: RequireRoleProps) {
  const { isAtLeast } = useRole();
  return <>{isAtLeast(minRole) ? children : fallback}</>;
}

// ── Org-Scoped Query Helper ─────────────────────────────────────────────────

/**
 * Hook that returns org-scoped query parameters for Supabase queries.
 * Ensures all queries are automatically scoped to the current organization
 * and includes RBAC context.
 */
export function useOrgScope() {
  const { currentOrg, user } = useAuth();
  const { role } = useRole();
  const { can } = usePermission();

  const orgId = currentOrg?.id ?? null;
  const userId = user?.id ?? null;

  /**
   * Create org-scoped filter parameters for a Supabase query.
   */
  const scopeQuery = useCallback(
    <T extends Record<string, unknown>>(additionalFilters?: T) => {
      if (!orgId) throw new Error("No active organization");
      return {
        organization_id: orgId,
        ...additionalFilters,
      };
    },
    [orgId]
  );

  /**
   * Create org-scoped insert parameters (includes created_by).
   */
  const scopeInsert = useCallback(
    <T extends Record<string, unknown>>(data: T) => {
      if (!orgId || !userId) throw new Error("No active organization or user");
      return {
        organization_id: orgId,
        created_by: userId,
        ...data,
      };
    },
    [orgId, userId]
  );

  /**
   * Assert a permission before performing an action.
   * Throws if denied.
   */
  const assertPermission = useCallback(
    (permission: Permission) => {
      if (!can(permission)) {
        throw new Error(
          `Access denied: permission "${permission}" is not granted for role "${role}"`
        );
      }
    },
    [can, role]
  );

  return {
    orgId,
    userId,
    role,
    scopeQuery,
    scopeInsert,
    assertPermission,
    /** Whether the scope is ready (user authenticated + org selected). */
    ready: !!orgId && !!userId,
  };
}
