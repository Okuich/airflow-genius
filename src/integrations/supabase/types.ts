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
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          rate_limit_per_minute: number
          scopes: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          rate_limit_per_minute?: number
          scopes?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          rate_limit_per_minute?: number
          scopes?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_logs: {
        Row: {
          api_key_id: string
          endpoint: string
          id: string
          latency_ms: number
          method: string
          organization_id: string
          recorded_at: string
          request_size_bytes: number
          response_size_bytes: number
          status_code: number
        }
        Insert: {
          api_key_id: string
          endpoint: string
          id?: string
          latency_ms?: number
          method?: string
          organization_id: string
          recorded_at?: string
          request_size_bytes?: number
          response_size_bytes?: number
          status_code?: number
        }
        Update: {
          api_key_id?: string
          endpoint?: string
          id?: string
          latency_ms?: number
          method?: string
          organization_id?: string
          recorded_at?: string
          request_size_bytes?: number
          response_size_bytes?: number
          status_code?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_usage_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          base_amount_usd: number
          cpu_hours_used: number
          created_at: string
          finalized_at: string | null
          gpu_hours_used: number
          id: string
          line_items: Json
          organization_id: string
          overage_amount_usd: number
          period_end: string
          period_start: string
          status: string
          storage_gb_used: number
          subscription_id: string | null
          total_amount_usd: number
        }
        Insert: {
          base_amount_usd?: number
          cpu_hours_used?: number
          created_at?: string
          finalized_at?: string | null
          gpu_hours_used?: number
          id?: string
          line_items?: Json
          organization_id: string
          overage_amount_usd?: number
          period_end: string
          period_start: string
          status?: string
          storage_gb_used?: number
          subscription_id?: string | null
          total_amount_usd?: number
        }
        Update: {
          base_amount_usd?: number
          cpu_hours_used?: number
          created_at?: string
          finalized_at?: string | null
          gpu_hours_used?: number
          id?: string
          line_items?: Json
          organization_id?: string
          overage_amount_usd?: number
          period_end?: string
          period_start?: string
          status?: string
          storage_gb_used?: number
          subscription_id?: string | null
          total_amount_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "org_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
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
      org_subscriptions: {
        Row: {
          billing_cycle_end: string
          billing_cycle_start: string
          created_at: string
          id: string
          organization_id: string
          plan_id: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_cycle_end?: string
          billing_cycle_start?: string
          created_at?: string
          id?: string
          organization_id: string
          plan_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_cycle_end?: string
          billing_cycle_start?: string
          created_at?: string
          id?: string
          organization_id?: string
          plan_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
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
      patent_filings: {
        Row: {
          created_at: string
          current_status: string
          id: string
          invention_id: string
          invention_number: string
          organization_id: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          current_status?: string
          id?: string
          invention_id: string
          invention_number: string
          organization_id?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          current_status?: string
          id?: string
          invention_id?: string
          invention_number?: string
          organization_id?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "patent_filings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      patent_status_history: {
        Row: {
          changed_at: string
          changed_by: string
          filing_id: string
          from_status: string | null
          id: string
          notes: string | null
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          filing_id: string
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          filing_id?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "patent_status_history_filing_id_fkey"
            columns: ["filing_id"]
            isOneToOne: false
            referencedRelation: "patent_filings"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          base_price_usd: number
          billing_period: string
          created_at: string
          features: Json
          id: string
          included_cpu_hours: number
          included_gpu_hours: number
          included_storage_gb: number
          is_active: boolean
          max_concurrent_jobs: number
          max_team_members: number
          name: string
          overage_cpu_rate: number
          overage_gpu_rate: number
          overage_storage_rate: number
          slug: string
          tier_level: number
          updated_at: string
        }
        Insert: {
          base_price_usd?: number
          billing_period?: string
          created_at?: string
          features?: Json
          id?: string
          included_cpu_hours?: number
          included_gpu_hours?: number
          included_storage_gb?: number
          is_active?: boolean
          max_concurrent_jobs?: number
          max_team_members?: number
          name: string
          overage_cpu_rate?: number
          overage_gpu_rate?: number
          overage_storage_rate?: number
          slug: string
          tier_level?: number
          updated_at?: string
        }
        Update: {
          base_price_usd?: number
          billing_period?: string
          created_at?: string
          features?: Json
          id?: string
          included_cpu_hours?: number
          included_gpu_hours?: number
          included_storage_gb?: number
          is_active?: boolean
          max_concurrent_jobs?: number
          max_team_members?: number
          name?: string
          overage_cpu_rate?: number
          overage_gpu_rate?: number
          overage_storage_rate?: number
          slug?: string
          tier_level?: number
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
      trade_secret_access_log: {
        Row: {
          accessed_at: string
          action: string
          id: string
          ip_address: string | null
          trade_secret_id: string
          user_id: string
        }
        Insert: {
          accessed_at?: string
          action?: string
          id?: string
          ip_address?: string | null
          trade_secret_id: string
          user_id: string
        }
        Update: {
          accessed_at?: string
          action?: string
          id?: string
          ip_address?: string | null
          trade_secret_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_secret_access_log_trade_secret_id_fkey"
            columns: ["trade_secret_id"]
            isOneToOne: false
            referencedRelation: "trade_secrets"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_secrets: {
        Row: {
          access_level: string
          category: string
          classification: string
          created_at: string
          created_by: string
          description: string
          encrypted_content: string
          encryption_iv: string
          id: string
          last_accessed_at: string | null
          last_accessed_by: string | null
          organization_id: string
          related_invention: string | null
          title: string
          updated_at: string
        }
        Insert: {
          access_level?: string
          category?: string
          classification?: string
          created_at?: string
          created_by: string
          description: string
          encrypted_content?: string
          encryption_iv?: string
          id?: string
          last_accessed_at?: string | null
          last_accessed_by?: string | null
          organization_id: string
          related_invention?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          access_level?: string
          category?: string
          classification?: string
          created_at?: string
          created_by?: string
          description?: string
          encrypted_content?: string
          encryption_iv?: string
          id?: string
          last_accessed_at?: string | null
          last_accessed_by?: string | null
          organization_id?: string
          related_invention?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_secrets_organization_id_fkey"
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
          trial_tier: string
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
          trial_tier?: string
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
          trial_tier?: string
          use_case?: string | null
          user_id?: string
        }
        Relationships: []
      }
      usage_meters: {
        Row: {
          billable: boolean
          billing_period_end: string
          billing_period_start: string
          id: string
          metadata: Json
          meter_type: string
          organization_id: string
          quantity: number
          recorded_at: string
          simulation_id: string | null
          unit_price_usd: number
          user_id: string
        }
        Insert: {
          billable?: boolean
          billing_period_end: string
          billing_period_start: string
          id?: string
          metadata?: Json
          meter_type?: string
          organization_id: string
          quantity?: number
          recorded_at?: string
          simulation_id?: string | null
          unit_price_usd?: number
          user_id: string
        }
        Update: {
          billable?: boolean
          billing_period_end?: string
          billing_period_start?: string
          id?: string
          metadata?: Json
          meter_type?: string
          organization_id?: string
          quantity?: number
          recorded_at?: string
          simulation_id?: string | null
          unit_price_usd?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_meters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_meters_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_org_ownership: { Args: { org_name: string }; Returns: string }
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
