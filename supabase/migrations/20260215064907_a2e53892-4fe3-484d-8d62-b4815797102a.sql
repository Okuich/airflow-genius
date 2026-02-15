
-- Training data table for ML surrogate models
CREATE TABLE public.ml_training_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  simulation_id UUID REFERENCES public.simulations(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  features JSONB NOT NULL DEFAULT '{}',
  labels JSONB NOT NULL DEFAULT '{}',
  feature_version TEXT NOT NULL DEFAULT 'v1',
  is_validated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ml_training_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read training data"
  ON public.ml_training_data FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members+ can insert training data"
  ON public.ml_training_data FOR INSERT
  WITH CHECK (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role) AND auth.uid() = created_by);

CREATE POLICY "Members+ can update training data"
  ON public.ml_training_data FOR UPDATE
  USING (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role));

CREATE POLICY "Admins+ can delete training data"
  ON public.ml_training_data FOR DELETE
  USING (has_org_role_gte(auth.uid(), organization_id, 'admin'::app_role));

-- Model versions table
CREATE TABLE public.ml_model_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  model_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  weights JSONB NOT NULL DEFAULT '{}',
  normalization JSONB NOT NULL DEFAULT '{}',
  metrics JSONB NOT NULL DEFAULT '{}',
  training_sample_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, model_type, version)
);

ALTER TABLE public.ml_model_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read model versions"
  ON public.ml_model_versions FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members+ can insert model versions"
  ON public.ml_model_versions FOR INSERT
  WITH CHECK (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role));

CREATE POLICY "Members+ can update model versions"
  ON public.ml_model_versions FOR UPDATE
  USING (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role));

-- Indexes
CREATE INDEX idx_ml_training_org ON public.ml_training_data(organization_id);
CREATE INDEX idx_ml_training_sim ON public.ml_training_data(simulation_id);
CREATE INDEX idx_ml_model_versions_org_type ON public.ml_model_versions(organization_id, model_type, is_active);

-- Trigger for updated_at
CREATE TRIGGER update_ml_training_data_updated_at
  BEFORE UPDATE ON public.ml_training_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
