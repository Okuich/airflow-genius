-- 1. Remove dev backdoor RPC
DROP FUNCTION IF EXISTS public.claim_org_ownership(text);

-- 2. Lock down SECURITY DEFINER trigger functions (they're invoked by triggers, not by clients)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_org() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_trial_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;

-- 3. has_role helpers should only be callable by authenticated (not anon)
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role_gte(uuid, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role_gte(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;

-- 4. Tighten patent_filings RLS — admin/owner only for writes
DROP POLICY IF EXISTS "Authenticated users can insert patent filings" ON public.patent_filings;
DROP POLICY IF EXISTS "Authenticated users can update patent filings" ON public.patent_filings;

CREATE POLICY "Admins+ can insert patent filings"
  ON public.patent_filings FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = updated_by
    AND (
      organization_id IS NULL
      OR public.has_org_role_gte(auth.uid(), organization_id, 'admin'::public.app_role)
    )
  );

CREATE POLICY "Admins+ can update patent filings"
  ON public.patent_filings FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL
    OR public.has_org_role_gte(auth.uid(), organization_id, 'admin'::public.app_role)
  );

CREATE POLICY "Admins+ can delete patent filings"
  ON public.patent_filings FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.has_org_role_gte(auth.uid(), organization_id, 'admin'::public.app_role)
  );

-- 5. Tighten patent_status_history insert — must be admin of the parent filing's org
DROP POLICY IF EXISTS "Authenticated users can insert status history" ON public.patent_status_history;

CREATE POLICY "Admins+ can insert status history"
  ON public.patent_status_history FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = changed_by
    AND EXISTS (
      SELECT 1 FROM public.patent_filings pf
      WHERE pf.id = filing_id
        AND (
          pf.organization_id IS NULL
          OR public.has_org_role_gte(auth.uid(), pf.organization_id, 'admin'::public.app_role)
        )
    )
  );