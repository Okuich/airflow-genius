
-- 1. Fix public data exposure: require org membership for NULL org_id rows
DROP POLICY IF EXISTS "Org members can read compliance knowledge" ON public.compliance_knowledge_sync;
CREATE POLICY "Org members can read compliance knowledge"
  ON public.compliance_knowledge_sync FOR SELECT
  USING (
    CASE
      WHEN organization_id IS NOT NULL THEN is_org_member(auth.uid(), organization_id)
      ELSE auth.uid() IS NOT NULL
    END
  );

DROP POLICY IF EXISTS "Org members can read sync logs" ON public.compliance_sync_log;
CREATE POLICY "Org members can read sync logs"
  ON public.compliance_sync_log FOR SELECT
  USING (
    CASE
      WHEN organization_id IS NOT NULL THEN is_org_member(auth.uid(), organization_id)
      ELSE auth.uid() IS NOT NULL
    END
  );

-- 2. Add missing UPDATE policies
CREATE POLICY "Members+ can update cleanroom samples"
  ON public.cleanroom_samples FOR UPDATE
  USING (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role));

CREATE POLICY "Members+ can update features"
  ON public.feature_store FOR UPDATE
  USING (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role));

CREATE POLICY "Members+ can update simulation results"
  ON public.simulation_results FOR UPDATE
  USING (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role));

CREATE POLICY "Members+ can update compute usage"
  ON public.compute_usage FOR UPDATE
  USING (has_org_role_gte(auth.uid(), organization_id, 'member'::app_role));
