import { describe, it, expect, beforeEach } from "vitest";
import { FedRampSecurityModule } from "./fedramp-security-module";

describe("FedRampSecurityModule", () => {
  let mod: FedRampSecurityModule;

  beforeEach(() => {
    mod = new FedRampSecurityModule();
  });

  // ── FIPS Encryption ─────────────────────────────────────────────────

  it("defaults to FIPS L3 AES-256-GCM", () => {
    const p = mod.getEncryptionPolicy();
    expect(p.level).toBe("L3");
    expect(p.algorithm).toBe("AES-256-GCM");
    expect(p.enforceAtRest).toBe(true);
    expect(p.enforceInTransit).toBe(true);
  });

  it("rejects non-FIPS algorithms", () => {
    const r = mod.validateEncryptionConfig({ algorithm: "RC4" });
    expect(r.valid).toBe(false);
    expect(r.violations[0]).toContain("RC4");
  });

  it("rejects disabled at-rest encryption", () => {
    const r = mod.validateEncryptionConfig({ atRest: false });
    expect(r.valid).toBe(false);
  });

  // ── Audit Logging ───────────────────────────────────────────────────

  it("records and filters audit events", () => {
    mod.recordAuditEvent({
      actor: "admin",
      action: "test",
      resource: "r",
      severity: "error",
      outcome: "success",
    });
    mod.recordAuditEvent({
      actor: "admin",
      action: "test2",
      resource: "r",
      severity: "info",
      outcome: "success",
    });

    expect(mod.getAuditLog()).toHaveLength(2);
    expect(mod.getAuditLog({ severity: "error" })).toHaveLength(1);
  });

  it("redacts PII in actor field", () => {
    const entry = mod.recordAuditEvent({
      actor: "john.doe@gov.mil",
      action: "login",
      resource: "auth",
      severity: "info",
      outcome: "success",
    });
    expect(entry?.actor).not.toContain("john.doe");
    expect(entry?.actor).toContain("***");
  });

  // ── Role Separation ─────────────────────────────────────────────────

  it("allows authorized role with MFA", () => {
    const r = mod.authorizeAction("modify-encryption-keys", "security-officer", true);
    expect(r.allowed).toBe(true);
  });

  it("denies prohibited role", () => {
    const r = mod.authorizeAction("modify-encryption-keys", "viewer", true);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("prohibited");
  });

  it("denies when MFA is missing", () => {
    const r = mod.authorizeAction("modify-encryption-keys", "security-officer", false);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("Multi-factor");
  });

  it("allows system-admin for any action with MFA", () => {
    const r = mod.authorizeAction("deploy-infrastructure", "system-admin", true);
    expect(r.allowed).toBe(true);
  });

  // ── PIV Auth ────────────────────────────────────────────────────────

  it("passes through when PIV not configured", () => {
    const r = mod.validatePivSession("system-admin", false);
    expect(r.valid).toBe(true);
  });

  it("blocks admin without PIV when configured", () => {
    mod.configurePiv({ status: "configured" });
    const r = mod.validatePivSession("system-admin", false);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("PIV/CAC");
  });

  it("blocks all users when PIV enforced", () => {
    mod.configurePiv({ status: "enforced" });
    const r = mod.validatePivSession("operator", false);
    expect(r.valid).toBe(false);
  });

  // ── Region Lock ─────────────────────────────────────────────────────

  it("allows GovCloud regions", () => {
    expect(mod.isRegionAllowed("us-gov-west-1")).toBe(true);
  });

  it("blocks non-GovCloud regions", () => {
    const r = mod.validateRegionRequest("eu-west-1");
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("outside the GovCloud boundary");
  });

  // ── Compliance Report ───────────────────────────────────────────────

  it("generates a clean compliance report with defaults", () => {
    const report = mod.generateComplianceReport();
    expect(report.fipsCompliant).toBe(true);
    expect(report.loggingCompliant).toBe(true);
    expect(report.roleSeparationCompliant).toBe(true);
    expect(report.regionLocked).toBe(true);
    expect(report.violations).toHaveLength(0);
  });

  it("reports violations when policies are weakened", () => {
    const weak = new FedRampSecurityModule({
      encryption: { level: "L1" },
      regionLock: { enforced: false },
    });
    const report = weak.generateComplianceReport();
    expect(report.fipsCompliant).toBe(false);
    expect(report.regionLocked).toBe(false);
    expect(report.violations.length).toBeGreaterThanOrEqual(2);
  });
});
