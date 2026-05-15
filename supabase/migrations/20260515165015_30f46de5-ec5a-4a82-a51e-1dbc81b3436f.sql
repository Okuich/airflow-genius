CREATE OR REPLACE FUNCTION public.claim_org_ownership(org_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_org_id uuid;
  slug_val text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'must be authenticated';
  END IF;

  slug_val := lower(regexp_replace(coalesce(org_name, 'org'), '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substr(gen_random_uuid()::text, 1, 8);

  INSERT INTO public.organizations (name, slug, tier, max_members)
  VALUES (coalesce(org_name, 'My Org'), slug_val, 'full', 10)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, uid, 'owner');

  RETURN new_org_id;
END;
$$;