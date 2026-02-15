
-- ─── Role Enum ──────────────────────────────────────────────────────────────
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- ─── Organizations ──────────────────────────────────────────────────────────
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  max_members INT NOT NULL DEFAULT 5,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ─── Profiles ───────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ─── Organization Members (roles live here, NOT on profiles) ────────────────
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ─── Simulations (org-scoped) ───────────────────────────────────────────────
CREATE TABLE public.simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  solver_config JSONB NOT NULL DEFAULT '{}',
  mesh_config JSONB NOT NULL DEFAULT '{}',
  fluid_properties JSONB NOT NULL DEFAULT '{}',
  boundary_conditions JSONB NOT NULL DEFAULT '[]',
  cell_count INT,
  current_iteration INT DEFAULT 0,
  progress NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

-- ─── Compute Usage (org-scoped) ─────────────────────────────────────────────
CREATE TABLE public.compute_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  simulation_id UUID REFERENCES public.simulations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  cpu_hours NUMERIC(10,4) NOT NULL DEFAULT 0,
  gpu_hours NUMERIC(10,4) NOT NULL DEFAULT 0,
  memory_gb_hours NUMERIC(10,4) NOT NULL DEFAULT 0,
  duration_seconds INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.compute_usage ENABLE ROW LEVEL SECURITY;

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX idx_simulations_org ON public.simulations(organization_id);
CREATE INDEX idx_compute_usage_org ON public.compute_usage(organization_id);
CREATE INDEX idx_compute_usage_sim ON public.compute_usage(simulation_id);

-- ─── Security Definer: membership check ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

-- ─── Security Definer: role check ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role = _role
  )
$$;

-- ─── Security Definer: at-least role (owner > admin > member > viewer) ──────
CREATE OR REPLACE FUNCTION public.has_org_role_gte(_user_id UUID, _org_id UUID, _min_role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND CASE role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'member' THEN 2
        WHEN 'viewer' THEN 1
      END >= CASE _min_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'member' THEN 2
        WHEN 'viewer' THEN 1
      END
  )
$$;

-- ─── RLS: profiles ─────────────────────────────────────────────────────────
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ─── RLS: organizations ────────────────────────────────────────────────────
CREATE POLICY "Members can read their orgs"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Owners can update org"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), id, 'owner'));

CREATE POLICY "Authenticated users can create orgs"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (true);

-- ─── RLS: organization_members ──────────────────────────────────────────────
CREATE POLICY "Members see fellow members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins+ can add members"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role_gte(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Admins+ can remove members"
  ON public.organization_members FOR DELETE TO authenticated
  USING (public.has_org_role_gte(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Admins+ can update member roles"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (public.has_org_role_gte(auth.uid(), organization_id, 'admin'));

-- ─── RLS: simulations ──────────────────────────────────────────────────────
CREATE POLICY "Org members can read simulations"
  ON public.simulations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members+ can create simulations"
  ON public.simulations FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role_gte(auth.uid(), organization_id, 'member'));

CREATE POLICY "Members+ can update simulations"
  ON public.simulations FOR UPDATE TO authenticated
  USING (public.has_org_role_gte(auth.uid(), organization_id, 'member'));

CREATE POLICY "Admins+ can delete simulations"
  ON public.simulations FOR DELETE TO authenticated
  USING (public.has_org_role_gte(auth.uid(), organization_id, 'admin'));

-- ─── RLS: compute_usage ────────────────────────────────────────────────────
CREATE POLICY "Org members can read compute usage"
  ON public.compute_usage FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members+ can insert compute usage"
  ON public.compute_usage FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role_gte(auth.uid(), organization_id, 'member') AND auth.uid() = user_id);

-- ─── Triggers: updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_simulations_updated_at BEFORE UPDATE ON public.simulations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Trigger: auto-create profile on signup ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Trigger: auto-add creator as org owner ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_org()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_org_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_org();
