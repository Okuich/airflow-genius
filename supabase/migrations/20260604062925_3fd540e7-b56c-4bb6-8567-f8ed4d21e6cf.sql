
-- 1. Create private schema for internal helpers (not exposed via PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 2. Recreate helpers in private schema
CREATE OR REPLACE FUNCTION private.has_org_role(_user_id uuid, _org_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id AND organization_id = _org_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.has_org_role_gte(_user_id uuid, _org_id uuid, _min_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
      AND CASE role WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'member' THEN 2 WHEN 'viewer' THEN 1 END
       >= CASE _min_role WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'member' THEN 2 WHEN 'viewer' THEN 1 END
  )
$$;

CREATE OR REPLACE FUNCTION private.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id AND organization_id = _org_id)
$$;

REVOKE ALL ON FUNCTION private.has_org_role(uuid, uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_org_role_gte(uuid, uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_org_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_org_role(uuid, uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_org_role_gte(uuid, uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_org_member(uuid, uuid) TO authenticated, service_role;

-- 3. Rewrite all policies that reference the public helpers to use private.*
DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  using_clause text;
  check_clause text;
  roles_clause text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual ~ '\m(has_org_role|has_org_role_gte|is_org_member)\M'
        OR with_check ~ '\m(has_org_role|has_org_role_gte|is_org_member)\M')
  LOOP
    new_qual := regexp_replace(COALESCE(r.qual, ''), '\m(has_org_role_gte|has_org_role|is_org_member)\(', 'private.\1(', 'g');
    new_check := regexp_replace(COALESCE(r.with_check, ''), '\m(has_org_role_gte|has_org_role|is_org_member)\(', 'private.\1(', 'g');
    roles_clause := array_to_string(r.roles, ', ');
    using_clause := CASE WHEN r.qual IS NOT NULL THEN format(' USING (%s)', new_qual) ELSE '' END;
    check_clause := CASE WHEN r.with_check IS NOT NULL THEN format(' WITH CHECK (%s)', new_check) ELSE '' END;

    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      r.policyname, r.schemaname, r.tablename, r.permissive, r.cmd, roles_clause, using_clause, check_clause);
  END LOOP;
END $$;

-- 4. Drop the public helper functions (no longer referenced)
DROP FUNCTION IF EXISTS public.has_org_role(uuid, uuid, public.app_role);
DROP FUNCTION IF EXISTS public.has_org_role_gte(uuid, uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_org_member(uuid, uuid);
