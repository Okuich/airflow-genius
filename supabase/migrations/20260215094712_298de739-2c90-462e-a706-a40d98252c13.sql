
-- ═══════════════════════════════════════════════════════════════════════════
-- CRITICAL: Restrict compliance_knowledge_sync to org-scoped access
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop overly permissive policy
DROP POLICY IF EXISTS "Anyone authenticated can read compliance knowledge" ON public.compliance_knowledge_sync;

-- Since compliance_knowledge_sync has no organization_id column, we add one
-- to properly scope data. Existing rows get NULL (legacy/shared data).
ALTER TABLE public.compliance_knowledge_sync ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Allow org members to read their own compliance knowledge
CREATE POLICY "Org members can read compliance knowledge"
  ON public.compliance_knowledge_sync FOR SELECT
  USING (
    organization_id IS NULL OR is_org_member(auth.uid(), organization_id)
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- WARNING: Restrict compliance_sync_log similarly
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone authenticated can read sync logs" ON public.compliance_sync_log;

ALTER TABLE public.compliance_sync_log ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

CREATE POLICY "Org members can read sync logs"
  ON public.compliance_sync_log FOR SELECT
  USING (
    organization_id IS NULL OR is_org_member(auth.uid(), organization_id)
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- WARNING: Restrict organization creation (replace WITH CHECK (true))
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can create orgs" ON public.organizations;

CREATE POLICY "Authenticated users can create orgs"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ═══════════════════════════════════════════════════════════════════════════
-- WARNING: Add missing DELETE policies
-- ═══════════════════════════════════════════════════════════════════════════

-- simulation_results: admins+ can delete
CREATE POLICY "Admins+ can delete simulation results"
  ON public.simulation_results FOR DELETE
  USING (has_org_role_gte(auth.uid(), organization_id, 'admin'::app_role));

-- compute_usage: admins+ can delete
CREATE POLICY "Admins+ can delete compute usage"
  ON public.compute_usage FOR DELETE
  USING (has_org_role_gte(auth.uid(), organization_id, 'admin'::app_role));

-- feature_store: admins+ can delete
CREATE POLICY "Admins+ can delete features"
  ON public.feature_store FOR DELETE
  USING (has_org_role_gte(auth.uid(), organization_id, 'admin'::app_role));

-- ml_model_versions: admins+ can delete
CREATE POLICY "Admins+ can delete model versions"
  ON public.ml_model_versions FOR DELETE
  USING (has_org_role_gte(auth.uid(), organization_id, 'admin'::app_role));

-- training_jobs: admins+ can delete
CREATE POLICY "Admins+ can delete training jobs"
  ON public.training_jobs FOR DELETE
  USING (has_org_role_gte(auth.uid(), organization_id, 'admin'::app_role));

-- profiles: users can delete own profile (GDPR)
CREATE POLICY "Users can delete own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = user_id);

-- organizations: owners can delete
CREATE POLICY "Owners can delete org"
  ON public.organizations FOR DELETE
  USING (has_org_role(auth.uid(), id, 'owner'::app_role));
