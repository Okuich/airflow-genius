export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cleanroom_samples: {
        Row: {
          air_change_rate: number
          created_at: string
          id: string
          laminar_stability: number
          organization_id: string
          particle_retention: number
          timestamp: string
          zone_name: string
        }
        Insert: {
          air_change_rate: number
          created_at?: string
          id?: string
          laminar_stability: number
          organization_id: string
          particle_retention: number
          timestamp?: string
          zone_name?: string
        }
        Update: {
          air_change_rate?: number
          created_at?: string
          id?: string
          laminar_stability?: number
          organization_id?: string
          particle_retention?: number
          timestamp?: string
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleanroom_samples_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_knowledge_sync: {
        Row: {
          entry_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          organization_id: string | null
          payload: Json
          source: string
          sync_type: string
          synced_at: string
          version: number
        }
        Insert: {
          entry_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          payload?: Json
          source?: string
          sync_type: string
          synced_at?: string
          version?: number
        }
        Update: {
          entry_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          payload?: Json
          source?: string
          sync_type?: string
          synced_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "compliance_knowledge_sync_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_reports: {
        Row: {
          created_at: string
          created_by: string
          domain: string
          filters: Json
          findings: Json
          format: string
          id: string
          organization_id: string
          overall_score: number
          regulatory_references: Json
          simulation_id: string | null
          title: string
          verdict: string
        }
        Insert: {
          created_at?: string
          created_by: string
          domain: string
          filters?: Json
          findings?: Json
          format?: string
          id?: string
          organization_id: string
          overall_score?: number
          regulatory_references?: Json
          simulation_id?: string | null
          title: string
          verdict: string
        }
        Update: {
          created_at?: string
          created_by?: string
          domain?: string
          filters?: Json
          findings?: Json
          format?: string
          id?: string
          organization_id?: string
          overall_score?: number
          regulatory_references?: Json
          simulation_id?: string | null
          title?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_sync_log: {
        Row: {
          ai_model: string | null
          completed_at: string | null
          error_message: string | null
          id: string
          organization_id: string | null
          rules_synced: number
          standards_synced: number
          started_at: string
          status: string
        }
        Insert: {
          ai_model?: string | null
          completed_at?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string | null
          rules_synced?: number
          standards_synced?: number
          started_at?: string
          status?: string
        }
        Update: {
          ai_model?: string | null
          completed_at?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string | null
          rules_synced?: number
          standards_synced?: number
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_sync_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compute_usage: {
        Row: {
          cost_usd: number
          cpu_hours: number
          duration_seconds: number
          gpu_hours: number
          id: string
          memory_gb_hours: number
          organization_id: string
          recorded_at: string
          simulation_id: string | null
          user_id: string
        }
        Insert: {
          cost_usd?: number
          cpu_hours?: number
          duration_seconds?: number
          gpu_hours?: number
          id?: string
          memory_gb_hours?: number
          organization_id: string
          recorded_at?: string
          simulation_id?: string | null
          user_id: string
        }
        Update: {
          cost_usd?: number
          cpu_hours?: number
          duration_seconds?: number
          gpu_hours?: number
          id?: string
          memory_gb_hours?: number
          organization_id?: string
          recorded_at?: string
          simulation_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compute_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compute_usage_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_store: {
        Row: {
          created_at: string
          feature_vector: Json
          feature_version: string
          geometry_cluster: string
          id: string
          labels: Json
          organization_id: string
          simulation_id: string | null
        }
        Insert: {
          created_at?: string
          feature_vector?: Json
          feature_version?: string
          geometry_cluster?: string
          id?: string
          labels?: Json
          organization_id: string
          simulation_id?: string | null
        }
        Update: {
          created_at?: string
          feature_vector?: Json
          feature_version?: string
          geometry_cluster?: string
          id?: string
          labels?: Json
          organization_id?: string
          simulation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_store_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_store_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_model_versions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metrics: Json
          model_type: string
          normalization: Json
          organization_id: string
          training_sample_count: number
          version: number
          weights: Json
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metrics?: Json
          model_type: string
          normalization?: Json
          organization_id: string
          training_sample_count?: number
          version?: number
          weights?: Json
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metrics?: Json
          model_type?: string
          normalization?: Json
          organization_id?: string
          training_sample_count?: number
          version?: number
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ml_model_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_training_data: {
        Row: {
          created_at: string
          created_by: string
          feature_version: string
          features: Json
          id: string
          is_validated: boolean
          labels: Json
          organization_id: string
          simulation_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          feature_version?: string
          features?: Json
          id?: string
          is_validated?: boolean
          labels?: Json
          organization_id: string
          simulation_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          feature_version?: string
          features?: Json
          id?: string
          is_validated?: boolean
          labels?: Json
          organization_id?: string
          simulation_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ml_training_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_training_data_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          max_members: number
          name: string
          slug: string
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          max_members?: number
          name: string
          slug: string
          tier?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          max_members?: number
          name?: string
          slug?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      simulation_results: {
        Row: {
          config: Json
          converged: boolean
          created_at: string
          efficiency_rating: string
          id: string
          mesh_stats: Json
          organization_id: string
          pressure_drop: number
          raw_output_urls: Json
          residuals: Json
          simulation_id: string | null
          solve_time_seconds: number
          total_iterations: number
          user_id: string
        }
        Insert: {
          config?: Json
          converged?: boolean
          created_at?: string
          efficiency_rating?: string
          id?: string
          mesh_stats?: Json
          organization_id: string
          pressure_drop?: number
          raw_output_urls?: Json
          residuals?: Json
          simulation_id?: string | null
          solve_time_seconds?: number
          total_iterations?: number
          user_id: string
        }
        Update: {
          config?: Json
          converged?: boolean
          created_at?: string
          efficiency_rating?: string
          id?: string
          mesh_stats?: Json
          organization_id?: string
          pressure_drop?: number
          raw_output_urls?: Json
          residuals?: Json
          simulation_id?: string | null
          solve_time_seconds?: number
          total_iterations?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_results_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          boundary_conditions: Json
          cell_count: number | null
          completed_at: string | null
          created_at: string
          created_by: string
          current_iteration: number | null
          description: string | null
          fluid_properties: Json
          id: string
          mesh_config: Json
          name: string
          organization_id: string
          progress: number | null
          solver_config: Json
          status: string
          updated_at: string
        }
        Insert: {
          boundary_conditions?: Json
          cell_count?: number | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          current_iteration?: number | null
          description?: string | null
          fluid_properties?: Json
          id?: string
          mesh_config?: Json
          name: string
          organization_id: string
          progress?: number | null
          solver_config?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          boundary_conditions?: Json
          cell_count?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          current_iteration?: number | null
          description?: string | null
          fluid_properties?: Json
          id?: string
          mesh_config?: Json
          name?: string
          organization_id?: string
          progress?: number | null
          solver_config?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          metrics: Json
          model_type: string
          organization_id: string
          sample_count: number
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metrics?: Json
          model_type: string
          organization_id: string
          sample_count?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metrics?: Json
          model_type?: string
          organization_id?: string
          sample_count?: number
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_signups: {
        Row: {
          company_name: string
          company_size: string | null
          created_at: string
          id: string
          industry: string
          job_role: string | null
          status: string
          trial_end: string
          trial_start: string
          use_case: string | null
          user_id: string
        }
        Insert: {
          company_name: string
          company_size?: string | null
          created_at?: string
          id?: string
          industry?: string
          job_role?: string | null
          status?: string
          trial_end?: string
          trial_start?: string
          use_case?: string | null
          user_id: string
        }
        Update: {
          company_name?: string
          company_size?: string | null
          created_at?: string
          id?: string
          industry?: string
          job_role?: string | null
          status?: string
          trial_end?: string
          trial_start?: string
          use_case?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_org_role_gte: {
        Args: {
          _min_role: Database["public"]["Enums"]["app_role"]
          _org_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "member" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const
