import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Organization, OrganizationMember, Profile, AppRole } from "./types";

// ─── Context Shape ──────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  // Org context
  currentOrg: Organization | null;
  currentRole: AppRole | null;
  organizations: Organization[];
  switchOrg: (orgId: string) => Promise<void>;
  // Actions
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);

  // ── Fetch profile & orgs ─────────────────────────────────────────────
  const loadUserData = useCallback(async (userId: string) => {
    try {
      const [profileRes, orgsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("organization_members")
          .select("organization_id, role, organizations(*)")
          .eq("user_id", userId),
      ]);

      if (profileRes.data) setProfile(profileRes.data as unknown as Profile);

      if (orgsRes.data && orgsRes.data.length > 0) {
        const orgs = orgsRes.data.map((m: any) => m.organizations as Organization);
        setOrganizations(orgs);

        const lastOrgId = localStorage.getItem("ff_current_org");
        const match = orgs.find((o) => o.id === lastOrgId) ?? orgs[0];
        setCurrentOrg(match);

        const memberRow = orgsRes.data.find((m: any) => m.organization_id === match.id);
        setCurrentRole((memberRow?.role as AppRole) ?? null);
      }
    } catch (err) {
      console.error("Failed to load user data:", err);
    }
  }, []);

  // ── Auth state listener ──────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        if (!mounted) return;
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          await loadUserData(sess.user.id);
        } else {
          setProfile(null);
          setOrganizations([]);
          setCurrentOrg(null);
          setCurrentRole(null);
        }
        if (mounted) setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      if (!mounted) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        await loadUserData(sess.user.id);
      }
      if (mounted) setLoading(false);
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    // Safety timeout — never stay loading forever
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  // ── Switch org ────────────────────────────────────────────────────────
  const switchOrg = useCallback(async (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (!org || !user) return;

    setCurrentOrg(org);
    localStorage.setItem("ff_current_org", orgId);

    const { data } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();

    setCurrentRole((data?.role as AppRole) ?? null);
  }, [organizations, user]);

  // ── Auth actions ──────────────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName ?? email },
      },
    });
    if (error) throw error;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("ff_current_org");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user, session, profile, loading,
        currentOrg, currentRole, organizations, switchOrg,
        signUp, signIn, signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
