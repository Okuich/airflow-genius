
-- Cleanroom telemetry samples table
CREATE TABLE public.cleanroom_samples (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  zone_name text NOT NULL DEFAULT 'default',
  timestamp timestamptz NOT NULL DEFAULT now(),
  air_change_rate numeric NOT NULL,
  particle_retention numeric NOT NULL,
  laminar_stability numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints via trigger for validation
  CONSTRAINT chk_particle_retention CHECK (particle_retention >= 0 AND particle_retention <= 1),
  CONSTRAINT chk_laminar_stability CHECK (laminar_stability >= 0 AND laminar_stability <= 1),
  CONSTRAINT chk_air_change_rate CHECK (air_change_rate >= 0 AND air_change_rate <= 1000)
);

-- Indexes
CREATE INDEX idx_cleanroom_samples_org_zone ON public.cleanroom_samples (organization_id, zone_name);
CREATE INDEX idx_cleanroom_samples_timestamp ON public.cleanroom_samples (organization_id, timestamp DESC);

-- Enable RLS
ALTER TABLE public.cleanroom_samples ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Org members can read cleanroom samples"
  ON public.cleanroom_samples FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members+ can insert cleanroom samples"
  ON public.cleanroom_samples FOR INSERT
  WITH CHECK (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role));

CREATE POLICY "Admins+ can delete cleanroom samples"
  ON public.cleanroom_samples FOR DELETE
  USING (has_org_role_gte(auth.uid(), organization_id, 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.cleanroom_samples;
