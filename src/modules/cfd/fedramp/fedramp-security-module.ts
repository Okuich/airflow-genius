// ─── FedRAMP Security Module ────────────────────────────────────────────────
//
// Enforces FedRAMP High security controls:
//   • FIPS 140-2 encryption enforcement
//   • Strict audit logging policies
//   • Role-separation enforcement (separation of duties)
//   • PIV/CAC auth integration placeholder
//   • Government-only region locking
// ────────────────────────────────────────────────────────────────────────────

import type { RegionId, ResidencyZone } from "../multi-region/multi-region-config-service";

// ── Types ───────────────────────────────────────────────────────────────────

export type FipsLevel = "L1" | "L2" | "L3";

export type EncryptionAlgorithm = "AES-256-GCM" | "AES-256-CBC";

export interface FipsEncryptionPolicy {
  level: FipsLevel;
  algorithm: EncryptionAlgorithm;
  keyRotationDays: number;
  enforceAtRest: boolean;
  enforceInTransit: boolean;
}

export type AuditSeverity = "info" | "warn" | "error" | "critical";

export interface AuditLogPolicy {
  retentionYears: number;
  immutable: boolean;
  wormEnabled: boolean;
  realtimeAlerts: boolean;
  minSeverity: AuditSeverity;
  piiRedaction: boolean;
  externalEgress: false; // GovCloud: no log egress
}

export interface AuditEntry {
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  severity: AuditSeverity;
  outcome: "success" | "failure" | "denied";
  metadata?: Record<string, unknown>;
}

export type GovRole =
  | "system-admin"
  | "security-officer"
  | "auditor"
  | "operator"
  | "viewer";

export interface RoleSeparationRule {
  action: string;
  requiredRole: GovRole;
  prohibitedRoles: GovRole[];
  requiresMfa: boolean;
}

export type PivAuthStatus = "not-configured" | "configured" | "enforced";

export interface PivConfig {
  status: PivAuthStatus;
  certificateAuthority: string | null;
  requirePivForAdmin: boolean;
  sessionTimeoutMinutes: number;
}

export interface RegionLockPolicy {
  allowedZones: ResidencyZone[];
  allowedRegions: RegionId[];
  enforced: boolean;
}

export interface FedRampComplianceReport {
  timestamp: string;
  fipsCompliant: boolean;
  loggingCompliant: boolean;
  roleSeparationCompliant: boolean;
  pivStatus: PivAuthStatus;
  regionLocked: boolean;
  violations: string[];
}

// ── Constants ───────────────────────────────────────────────────────────────

const GOV_REGIONS: RegionId[] = ["us-gov-west-1"];

const SEVERITY_RANK: Record<AuditSeverity, number> = {
  info: 0,
  warn: 1,
  error: 2,
  critical: 3,
};

const DEFAULT_ROLE_RULES: RoleSeparationRule[] = [
  {
    action: "modify-encryption-keys",
    requiredRole: "security-officer",
    prohibitedRoles: ["operator", "viewer"],
    requiresMfa: true,
  },
  {
    action: "view-audit-logs",
    requiredRole: "auditor",
    prohibitedRoles: [],
    requiresMfa: false,
  },
  {
    action: "modify-audit-policy",
    requiredRole: "security-officer",
    prohibitedRoles: ["auditor", "operator", "viewer"],
    requiresMfa: true,
  },
  {
    action: "deploy-infrastructure",
    requiredRole: "operator",
    prohibitedRoles: ["auditor", "viewer"],
    requiresMfa: true,
  },
  {
    action: "manage-users",
    requiredRole: "system-admin",
    prohibitedRoles: ["operator", "auditor", "viewer"],
    requiresMfa: true,
  },
  {
    action: "configure-region-lock",
    requiredRole: "security-officer",
    prohibitedRoles: ["operator", "viewer"],
    requiresMfa: true,
  },
];

// ── Service ─────────────────────────────────────────────────────────────────

export class FedRampSecurityModule {
  private encryptionPolicy: FipsEncryptionPolicy;
  private auditPolicy: AuditLogPolicy;
  private roleSeparationRules: RoleSeparationRule[];
  private pivConfig: PivConfig;
  private regionLock: RegionLockPolicy;
  private auditLog: AuditEntry[] = [];

  constructor(config?: {
    encryption?: Partial<FipsEncryptionPolicy>;
    audit?: Partial<AuditLogPolicy>;
    roleSeparationRules?: RoleSeparationRule[];
    piv?: Partial<PivConfig>;
    regionLock?: Partial<RegionLockPolicy>;
  }) {
    this.encryptionPolicy = {
      level: "L3",
      algorithm: "AES-256-GCM",
      keyRotationDays: 90,
      enforceAtRest: true,
      enforceInTransit: true,
      ...config?.encryption,
    };

    this.auditPolicy = {
      retentionYears: 7,
      immutable: true,
      wormEnabled: true,
      realtimeAlerts: true,
      minSeverity: "info",
      piiRedaction: true,
      externalEgress: false,
      ...config?.audit,
    };

    this.roleSeparationRules = config?.roleSeparationRules ?? [...DEFAULT_ROLE_RULES];

    this.pivConfig = {
      status: "not-configured",
      certificateAuthority: null,
      requirePivForAdmin: true,
      sessionTimeoutMinutes: 15,
      ...config?.piv,
    };

    this.regionLock = {
      allowedZones: ["GovCloud"],
      allowedRegions: [...GOV_REGIONS],
      enforced: true,
      ...config?.regionLock,
    };
  }

  // ── FIPS Encryption ───────────────────────────────────────────────────

  getEncryptionPolicy(): FipsEncryptionPolicy {
    return { ...this.encryptionPolicy };
  }

  validateEncryptionConfig(config: {
    algorithm?: string;
    atRest?: boolean;
    inTransit?: boolean;
  }): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    if (config.algorithm && config.algorithm !== this.encryptionPolicy.algorithm) {
      violations.push(
        `Algorithm ${config.algorithm} not permitted. Required: ${this.encryptionPolicy.algorithm}`,
      );
    }

    if (config.atRest === false && this.encryptionPolicy.enforceAtRest) {
      violations.push("Encryption at rest is mandatory under FIPS policy");
    }

    if (config.inTransit === false && this.encryptionPolicy.enforceInTransit) {
      violations.push("Encryption in transit is mandatory under FIPS policy");
    }

    return { valid: violations.length === 0, violations };
  }

  // ── Strict Logging ────────────────────────────────────────────────────

  getAuditPolicy(): AuditLogPolicy {
    return { ...this.auditPolicy };
  }

  recordAuditEvent(entry: Omit<AuditEntry, "timestamp">): AuditEntry | null {
    if (SEVERITY_RANK[entry.severity] < SEVERITY_RANK[this.auditPolicy.minSeverity]) {
      return null; // Below threshold
    }

    const full: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      // Redact actor if PII redaction is on and actor looks like an email
      actor: this.auditPolicy.piiRedaction && entry.actor.includes("@")
        ? entry.actor.replace(/(.{2}).*(@.*)/, "$1***$2")
        : entry.actor,
    };

    this.auditLog.push(full);
    return full;
  }

  getAuditLog(filter?: { severity?: AuditSeverity; actor?: string }): AuditEntry[] {
    return this.auditLog.filter((e) => {
      if (filter?.severity && e.severity !== filter.severity) return false;
      if (filter?.actor && !e.actor.includes(filter.actor)) return false;
      return true;
    });
  }

  // ── Role Separation ───────────────────────────────────────────────────

  getRoleSeparationRules(): RoleSeparationRule[] {
    return this.roleSeparationRules.map((r) => ({ ...r }));
  }

  authorizeAction(
    action: string,
    userRole: GovRole,
    hasMfa: boolean,
  ): { allowed: boolean; reason?: string } {
    const rule = this.roleSeparationRules.find((r) => r.action === action);

    if (!rule) {
      this.recordAuditEvent({
        actor: userRole,
        action,
        resource: "authorization",
        severity: "warn",
        outcome: "denied",
        metadata: { reason: "no rule found" },
      });
      return { allowed: false, reason: `No authorization rule found for action: ${action}` };
    }

    if (rule.prohibitedRoles.includes(userRole)) {
      this.recordAuditEvent({
        actor: userRole,
        action,
        resource: "authorization",
        severity: "error",
        outcome: "denied",
        metadata: { reason: "role prohibited" },
      });
      return { allowed: false, reason: `Role '${userRole}' is prohibited from '${action}'` };
    }

    // Check if user has the required role or is system-admin (super role)
    if (userRole !== rule.requiredRole && userRole !== "system-admin") {
      this.recordAuditEvent({
        actor: userRole,
        action,
        resource: "authorization",
        severity: "error",
        outcome: "denied",
        metadata: { reason: "insufficient role" },
      });
      return {
        allowed: false,
        reason: `Action '${action}' requires role '${rule.requiredRole}', user has '${userRole}'`,
      };
    }

    if (rule.requiresMfa && !hasMfa) {
      this.recordAuditEvent({
        actor: userRole,
        action,
        resource: "authorization",
        severity: "error",
        outcome: "denied",
        metadata: { reason: "MFA required" },
      });
      return { allowed: false, reason: "Multi-factor authentication is required for this action" };
    }

    this.recordAuditEvent({
      actor: userRole,
      action,
      resource: "authorization",
      severity: "info",
      outcome: "success",
    });

    return { allowed: true };
  }

  // ── PIV / CAC Auth ────────────────────────────────────────────────────

  getPivConfig(): PivConfig {
    return { ...this.pivConfig };
  }

  configurePiv(update: Partial<PivConfig>): void {
    this.pivConfig = { ...this.pivConfig, ...update };

    this.recordAuditEvent({
      actor: "system",
      action: "configure-piv",
      resource: "piv-config",
      severity: "critical",
      outcome: "success",
      metadata: { newStatus: this.pivConfig.status },
    });
  }

  validatePivSession(userRole: GovRole, hasPivCert: boolean): {
    valid: boolean;
    reason?: string;
  } {
    if (this.pivConfig.status === "not-configured") {
      return { valid: true, reason: "PIV not yet configured — passthrough" };
    }

    const isAdmin = userRole === "system-admin" || userRole === "security-officer";

    if (this.pivConfig.requirePivForAdmin && isAdmin && !hasPivCert) {
      return { valid: false, reason: "PIV/CAC certificate required for administrative roles" };
    }

    if (this.pivConfig.status === "enforced" && !hasPivCert) {
      return { valid: false, reason: "PIV/CAC certificate required for all users" };
    }

    return { valid: true };
  }

  // ── Region Lock ───────────────────────────────────────────────────────

  getRegionLockPolicy(): RegionLockPolicy {
    return { ...this.regionLock };
  }

  isRegionAllowed(regionId: RegionId): boolean {
    if (!this.regionLock.enforced) return true;
    return this.regionLock.allowedRegions.includes(regionId);
  }

  validateRegionRequest(regionId: RegionId): { allowed: boolean; reason?: string } {
    if (!this.regionLock.enforced) {
      return { allowed: true };
    }

    if (!this.regionLock.allowedRegions.includes(regionId)) {
      this.recordAuditEvent({
        actor: "system",
        action: "region-access",
        resource: regionId,
        severity: "critical",
        outcome: "denied",
        metadata: { allowedRegions: this.regionLock.allowedRegions },
      });
      return {
        allowed: false,
        reason: `Region '${regionId}' is outside the GovCloud boundary. Allowed: ${this.regionLock.allowedRegions.join(", ")}`,
      };
    }

    return { allowed: true };
  }

  // ── Compliance Report ─────────────────────────────────────────────────

  generateComplianceReport(): FedRampComplianceReport {
    const violations: string[] = [];

    // FIPS check
    const fipsOk =
      this.encryptionPolicy.enforceAtRest &&
      this.encryptionPolicy.enforceInTransit &&
      this.encryptionPolicy.level === "L3";
    if (!fipsOk) violations.push("FIPS encryption policy does not meet Level 3 requirements");

    // Logging check
    const loggingOk =
      this.auditPolicy.immutable &&
      this.auditPolicy.wormEnabled &&
      this.auditPolicy.retentionYears >= 7 &&
      this.auditPolicy.externalEgress === false;
    if (!loggingOk) violations.push("Audit logging policy does not meet FedRAMP High requirements");

    // Role separation check
    const roleSepOk = this.roleSeparationRules.length >= 5;
    if (!roleSepOk) violations.push("Insufficient role separation rules (minimum 5 required)");

    // Region lock check
    const regionOk = this.regionLock.enforced;
    if (!regionOk) violations.push("Government-only region lock is not enforced");

    return {
      timestamp: new Date().toISOString(),
      fipsCompliant: fipsOk,
      loggingCompliant: loggingOk,
      roleSeparationCompliant: roleSepOk,
      pivStatus: this.pivConfig.status,
      regionLocked: regionOk,
      violations,
    };
  }
}
