
-- API Keys table
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes JSONB NOT NULL DEFAULT '["read"]'::jsonb,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read api keys" ON public.api_keys
  FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members+ can create api keys" ON public.api_keys
  FOR INSERT TO authenticated
  WITH CHECK (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role) AND auth.uid() = created_by);

CREATE POLICY "Members+ can update api keys" ON public.api_keys
  FOR UPDATE TO authenticated
  USING (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role));

CREATE POLICY "Admins+ can delete api keys" ON public.api_keys
  FOR DELETE TO authenticated
  USING (has_org_role_gte(auth.uid(), organization_id, 'admin'::app_role));

-- API Usage Logs table
CREATE TABLE public.api_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  status_code INTEGER NOT NULL DEFAULT 200,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  request_size_bytes INTEGER NOT NULL DEFAULT 0,
  response_size_bytes INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read usage logs" ON public.api_usage_logs
  FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members+ can insert usage logs" ON public.api_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role));

-- Indexes for performance
CREATE INDEX idx_api_usage_logs_key_id ON public.api_usage_logs(api_key_id);
CREATE INDEX idx_api_usage_logs_recorded_at ON public.api_usage_logs(recorded_at);
CREATE INDEX idx_api_keys_org_id ON public.api_keys(organization_id);
