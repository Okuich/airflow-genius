import { describe, it, expect } from "vitest";
import {
  Role,
  Permission,
  isRoleAtLeast,
  isRoleAbove,
  roleHasPermission,
  roleGetPermissions,
  ROLE_PERMISSIONS,
  PolicyRegistry,
  ownerOrAdminPolicy,
  adminOnlyPolicy,
  ownerOnlyPolicy,
} from "./rbac-core";
import {
  requirePermission,
  requireRole,
  enforcePolicy,
  buildRBACRequest,
  guards,
} from "./rbac-middleware";

// ── Role Hierarchy ──────────────────────────────────────────────────────────

describe("Role Hierarchy", () => {
  it("owner outranks all", () => {
    expect(isRoleAtLeast(Role.OWNER, Role.OWNER)).toBe(true);
    expect(isRoleAtLeast(Role.OWNER, Role.ADMIN)).toBe(true);
    expect(isRoleAtLeast(Role.OWNER, Role.MEMBER)).toBe(true);
    expect(isRoleAtLeast(Role.OWNER, Role.VIEWER)).toBe(true);
  });

  it("viewer cannot meet admin requirement", () => {
    expect(isRoleAtLeast(Role.VIEWER, Role.ADMIN)).toBe(false);
    expect(isRoleAtLeast(Role.VIEWER, Role.MEMBER)).toBe(false);
  });

  it("isRoleAbove is strict", () => {
    expect(isRoleAbove(Role.ADMIN, Role.ADMIN)).toBe(false);
    expect(isRoleAbove(Role.ADMIN, Role.MEMBER)).toBe(true);
  });
});

// ── Permission Mapping ──────────────────────────────────────────────────────

describe("Permission Mapping", () => {
  it("viewer can read but not create simulations", () => {
    expect(roleHasPermission(Role.VIEWER, Permission.SIMULATION_READ)).toBe(true);
    expect(roleHasPermission(Role.VIEWER, Permission.SIMULATION_CREATE)).toBe(false);
  });

  it("member can create but not delete simulations", () => {
    expect(roleHasPermission(Role.MEMBER, Permission.SIMULATION_CREATE)).toBe(true);
    expect(roleHasPermission(Role.MEMBER, Permission.SIMULATION_DELETE)).toBe(false);
  });

  it("admin can delete simulations", () => {
    expect(roleHasPermission(Role.ADMIN, Permission.SIMULATION_DELETE)).toBe(true);
  });

  it("only owner can delete org", () => {
    expect(roleHasPermission(Role.OWNER, Permission.ORG_DELETE)).toBe(true);
    expect(roleHasPermission(Role.ADMIN, Permission.ORG_DELETE)).toBe(false);
  });

  it("role inherits all lower permissions", () => {
    const ownerPerms = roleGetPermissions(Role.OWNER);
    const adminPerms = roleGetPermissions(Role.ADMIN);
    // Every admin perm should be in owner perms
    adminPerms.forEach((p) => {
      expect(ownerPerms).toContain(p);
    });
  });
});

// ── Middleware ───────────────────────────────────────────────────────────────

describe("Middleware", () => {
  it("requirePermission grants when role has permission", () => {
    const result = requirePermission(
      { userId: "u1", role: Role.ADMIN, organizationId: "o1" },
      Permission.SIMULATION_DELETE
    );
    expect(result.granted).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it("requirePermission denies when role lacks permission", () => {
    const result = requirePermission(
      { userId: "u1", role: Role.VIEWER, organizationId: "o1" },
      Permission.SIMULATION_DELETE
    );
    expect(result.granted).toBe(false);
    expect(result.statusCode).toBe(403);
  });

  it("requireRole checks hierarchy", () => {
    expect(requireRole({ userId: "u1", role: Role.MEMBER, organizationId: "o1" }, Role.MEMBER).granted).toBe(true);
    expect(requireRole({ userId: "u1", role: Role.VIEWER, organizationId: "o1" }, Role.MEMBER).granted).toBe(false);
  });

  it("buildRBACRequest sanitizes unknown roles to viewer", () => {
    const req = buildRBACRequest("u1", "hacker", "o1");
    expect(req.role).toBe(Role.VIEWER);
  });
});

// ── Policy Registry ─────────────────────────────────────────────────────────

describe("Policy Registry", () => {
  it("admin-only policy denies members", async () => {
    const registry = new PolicyRegistry();
    registry.register(adminOnlyPolicy(Permission.MEMBER_INVITE, "Admins only"));

    const result = await registry.evaluate(Permission.MEMBER_INVITE, {
      userId: "u1",
      role: Role.MEMBER,
      organizationId: "o1",
    });
    // Member doesn't have MEMBER_INVITE permission at role level
    expect(result.allowed).toBe(false);
  });

  it("owner-or-admin policy allows resource owner", async () => {
    const registry = new PolicyRegistry();
    registry.register(
      ownerOrAdminPolicy<{ created_by: string }>(
        Permission.SIMULATION_UPDATE,
        "Owner or admin"
      )
    );

    const result = await registry.evaluate(Permission.SIMULATION_UPDATE, {
      userId: "u1",
      role: Role.MEMBER,
      organizationId: "o1",
      resource: { created_by: "u1" },
    });
    expect(result.allowed).toBe(true);
  });

  it("owner-or-admin policy denies non-owner member", async () => {
    const registry = new PolicyRegistry();
    registry.register(
      ownerOrAdminPolicy<{ created_by: string }>(
        Permission.SIMULATION_UPDATE,
        "Owner or admin"
      )
    );

    const result = await registry.evaluate(Permission.SIMULATION_UPDATE, {
      userId: "u1",
      role: Role.MEMBER,
      organizationId: "o1",
      resource: { created_by: "u2" },
    });
    expect(result.allowed).toBe(false);
  });

  it("owner-only policy denies admin", async () => {
    const registry = new PolicyRegistry();
    registry.register(ownerOnlyPolicy(Permission.ORG_DELETE, "Owner only"));

    // Admin doesn't have ORG_DELETE at role level
    const result = await registry.evaluate(Permission.ORG_DELETE, {
      userId: "u1",
      role: Role.ADMIN,
      organizationId: "o1",
    });
    expect(result.allowed).toBe(false);
  });
});

// ── Guards ───────────────────────────────────────────────────────────────────

describe("Pre-built Guards", () => {
  it("simulation.create grants member", () => {
    const result = guards.simulation.create.check({
      userId: "u1",
      role: Role.MEMBER,
      organizationId: "o1",
    });
    expect(result.granted).toBe(true);
  });

  it("org.delete denies admin", () => {
    const result = guards.org.delete.check({
      userId: "u1",
      role: Role.ADMIN,
      organizationId: "o1",
    });
    expect(result.granted).toBe(false);
  });
});
