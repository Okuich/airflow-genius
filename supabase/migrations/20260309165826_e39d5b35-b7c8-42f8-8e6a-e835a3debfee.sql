
-- Trade Secrets Registry table with strict access controls
CREATE TABLE public.trade_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  encrypted_content text NOT NULL DEFAULT '',
  encryption_iv text NOT NULL DEFAULT '',
  classification text NOT NULL DEFAULT 'confidential',
  category text NOT NULL DEFAULT 'threshold',
  related_invention text,
  access_level text NOT NULL DEFAULT 'owner_only',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz,
  last_accessed_by uuid
);

-- Only owner role can access trade secrets (strictest possible RLS)
ALTER TABLE public.trade_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only owners can read trade secrets"
  ON public.trade_secrets FOR SELECT
  TO authenticated
  USING (has_org_role(auth.uid(), organization_id, 'owner'::app_role));

CREATE POLICY "Only owners can insert trade secrets"
  ON public.trade_secrets FOR INSERT
  TO authenticated
  WITH CHECK (has_org_role(auth.uid(), organization_id, 'owner'::app_role) AND auth.uid() = created_by);

CREATE POLICY "Only owners can update trade secrets"
  ON public.trade_secrets FOR UPDATE
  TO authenticated
  USING (has_org_role(auth.uid(), organization_id, 'owner'::app_role));

CREATE POLICY "Only owners can delete trade secrets"
  ON public.trade_secrets FOR DELETE
  TO authenticated
  USING (has_org_role(auth.uid(), organization_id, 'owner'::app_role));

-- Audit log for trade secret access
CREATE TABLE public.trade_secret_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_secret_id uuid REFERENCES public.trade_secrets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL DEFAULT 'view',
  ip_address text,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_secret_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only owners can read access logs"
  ON public.trade_secret_access_log FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trade_secrets ts
    WHERE ts.id = trade_secret_id
    AND has_org_role(auth.uid(), ts.organization_id, 'owner'::app_role)
  ));

CREATE POLICY "Authenticated can insert access logs"
  ON public.trade_secret_access_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
