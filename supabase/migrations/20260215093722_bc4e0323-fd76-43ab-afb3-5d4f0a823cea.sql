
-- Create compliance_reports table to persist generated reports
CREATE TABLE public.compliance_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  simulation_id TEXT,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  verdict TEXT NOT NULL,
  overall_score NUMERIC NOT NULL DEFAULT 0,
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  regulatory_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  format TEXT NOT NULL DEFAULT 'json',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;

-- Org members can read reports
CREATE POLICY "Org members can read compliance reports"
  ON public.compliance_reports FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

-- Members+ can generate reports
CREATE POLICY "Members+ can insert compliance reports"
  ON public.compliance_reports FOR INSERT
  WITH CHECK (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role) AND auth.uid() = created_by);

-- Admins+ can delete reports
CREATE POLICY "Admins+ can delete compliance reports"
  ON public.compliance_reports FOR DELETE
  USING (has_org_role_gte(auth.uid(), organization_id, 'admin'::app_role));
