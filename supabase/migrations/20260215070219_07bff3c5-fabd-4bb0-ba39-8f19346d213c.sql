
-- ── Data Lake: raw simulation results ───────────────────────────────────
CREATE TABLE public.simulation_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulation_id UUID REFERENCES public.simulations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  mesh_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  residuals JSONB NOT NULL DEFAULT '[]'::jsonb,
  pressure_drop NUMERIC NOT NULL DEFAULT 0,
  efficiency_rating TEXT NOT NULL DEFAULT 'Average',
  converged BOOLEAN NOT NULL DEFAULT false,
  total_iterations INTEGER NOT NULL DEFAULT 0,
  solve_time_seconds NUMERIC NOT NULL DEFAULT 0,
  raw_output_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.simulation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read results"
  ON public.simulation_results FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members+ can insert results"
  ON public.simulation_results FOR INSERT
  WITH CHECK (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role) AND auth.uid() = user_id);

CREATE INDEX idx_sim_results_org ON public.simulation_results(organization_id);
CREATE INDEX idx_sim_results_sim ON public.simulation_results(simulation_id);

-- ── Feature Store: versioned feature vectors ────────────────────────────
CREATE TABLE public.feature_store (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulation_id UUID REFERENCES public.simulations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  feature_version TEXT NOT NULL DEFAULT 'v1',
  feature_vector JSONB NOT NULL DEFAULT '{}'::jsonb,
  labels JSONB NOT NULL DEFAULT '{}'::jsonb,
  geometry_cluster TEXT NOT NULL DEFAULT 'generic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read features"
  ON public.feature_store FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members+ can insert features"
  ON public.feature_store FOR INSERT
  WITH CHECK (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role));

CREATE INDEX idx_feature_store_org ON public.feature_store(organization_id);
CREATE INDEX idx_feature_store_cluster ON public.feature_store(geometry_cluster);
CREATE INDEX idx_feature_store_version ON public.feature_store(feature_version);

-- ── Training Jobs: track orchestrator runs ──────────────────────────────
CREATE TABLE public.training_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  model_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  sample_count INTEGER NOT NULL DEFAULT 0,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.training_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read training jobs"
  ON public.training_jobs FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members+ can insert training jobs"
  ON public.training_jobs FOR INSERT
  WITH CHECK (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role));

CREATE POLICY "Members+ can update training jobs"
  ON public.training_jobs FOR UPDATE
  USING (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role));

CREATE INDEX idx_training_jobs_org ON public.training_jobs(organization_id);
