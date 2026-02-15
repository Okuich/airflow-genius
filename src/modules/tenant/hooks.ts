import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";
import type {
  Organization,
  OrganizationMember,
  SimulationRow,
  ComputeUsageRow,
  AppRole,
  Profile,
} from "./types";

// ─── Organization CRUD ──────────────────────────────────────────────────────

export function useOrganization() {
  const { currentOrg, user } = useAuth();

  const createOrg = useCallback(async (name: string, slug: string): Promise<Organization> => {
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name, slug })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Organization;
  }, []);

  const updateOrg = useCallback(async (updates: Partial<Pick<Organization, "name" | "logo_url">>) => {
    if (!currentOrg) throw new Error("No org selected");
    const { error } = await supabase
      .from("organizations")
      .update(updates as any)
      .eq("id", currentOrg.id);
    if (error) throw error;
  }, [currentOrg]);

  const getMembers = useCallback(async (): Promise<OrganizationMember[]> => {
    if (!currentOrg) return [];
    const { data, error } = await supabase
      .from("organization_members")
      .select("*, profiles:user_id(id, user_id, display_name, avatar_url, created_at, updated_at)")
      .eq("organization_id", currentOrg.id);
    if (error) throw error;
    return (data ?? []).map((m: any) => ({
      ...m,
      profile: m.profiles as Profile,
    })) as OrganizationMember[];
  }, [currentOrg]);

  const addMember = useCallback(async (userId: string, role: AppRole = "member") => {
    if (!currentOrg) throw new Error("No org selected");
    const { error } = await supabase
      .from("organization_members")
      .insert({ organization_id: currentOrg.id, user_id: userId, role });
    if (error) throw error;
  }, [currentOrg]);

  const removeMember = useCallback(async (memberId: string) => {
    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("id", memberId);
    if (error) throw error;
  }, []);

  const updateMemberRole = useCallback(async (memberId: string, role: AppRole) => {
    const { error } = await supabase
      .from("organization_members")
      .update({ role })
      .eq("id", memberId);
    if (error) throw error;
  }, []);

  return { createOrg, updateOrg, getMembers, addMember, removeMember, updateMemberRole };
}

// ─── Org-Scoped Simulations ─────────────────────────────────────────────────

export function useOrgSimulations() {
  const { currentOrg, user } = useAuth();

  const listSimulations = useCallback(async (): Promise<SimulationRow[]> => {
    if (!currentOrg) return [];
    const { data, error } = await supabase
      .from("simulations")
      .select("*")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as SimulationRow[];
  }, [currentOrg]);

  const createSimulation = useCallback(async (
    input: Pick<SimulationRow, "name" | "description" | "solver_config" | "mesh_config" | "fluid_properties" | "boundary_conditions">
  ): Promise<SimulationRow> => {
    if (!currentOrg || !user) throw new Error("No org/user");
    const { data, error } = await supabase
      .from("simulations")
      .insert({
        name: input.name,
        description: input.description,
        solver_config: input.solver_config as any,
        mesh_config: input.mesh_config as any,
        fluid_properties: input.fluid_properties as any,
        boundary_conditions: input.boundary_conditions as any,
        organization_id: currentOrg.id,
        created_by: user.id,
      } as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as SimulationRow;
  }, [currentOrg, user]);

  const deleteSimulation = useCallback(async (simId: string) => {
    const { error } = await supabase
      .from("simulations")
      .delete()
      .eq("id", simId);
    if (error) throw error;
  }, []);

  return { listSimulations, createSimulation, deleteSimulation };
}

// ─── Org-Scoped Compute Usage ───────────────────────────────────────────────

export function useOrgComputeUsage() {
  const { currentOrg, user } = useAuth();

  const recordUsage = useCallback(async (
    input: Pick<ComputeUsageRow, "cpu_hours" | "gpu_hours" | "memory_gb_hours" | "duration_seconds" | "cost_usd"> & { simulation_id?: string }
  ) => {
    if (!currentOrg || !user) throw new Error("No org/user");
    const { error } = await supabase
      .from("compute_usage")
      .insert({
        ...input,
        organization_id: currentOrg.id,
        user_id: user.id,
      } as any);
    if (error) throw error;
  }, [currentOrg, user]);

  const getUsageSummary = useCallback(async () => {
    if (!currentOrg) return null;
    const { data, error } = await supabase
      .from("compute_usage")
      .select("cpu_hours, gpu_hours, memory_gb_hours, duration_seconds, cost_usd")
      .eq("organization_id", currentOrg.id);
    if (error) throw error;

    const rows = (data ?? []) as unknown as ComputeUsageRow[];
    return {
      totalCpuHours: rows.reduce((s, r) => s + Number(r.cpu_hours), 0),
      totalGpuHours: rows.reduce((s, r) => s + Number(r.gpu_hours), 0),
      totalMemoryGBHours: rows.reduce((s, r) => s + Number(r.memory_gb_hours), 0),
      totalDurationSeconds: rows.reduce((s, r) => s + Number(r.duration_seconds), 0),
      totalCostUSD: rows.reduce((s, r) => s + Number(r.cost_usd), 0),
      recordCount: rows.length,
    };
  }, [currentOrg]);

  return { recordUsage, getUsageSummary };
}
